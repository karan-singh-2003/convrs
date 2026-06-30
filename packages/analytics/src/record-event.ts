// packages/analytics/src/record-event.ts
import { fetchWithRetry, capitalize, getDomainWithoutWWW } from "@repo/utils";
import type { RequestContext } from "./types";
import { detectBot } from "./utils/detect-bot";
import { parseUserAgent } from "./utils/parse-user-agent";
import {
  getGeoData,
  getGeoRegion,
  getVercelRegion,
  getContinent,
} from "./utils/get-geo-data";
import type { AnalyticsEvent } from "./schemas/event.schema";
import type { FastifyBaseLogger } from "fastify";

export async function recordEvent({
  req,
  payload,
  logger,
}: {
  req: Request;
  payload: AnalyticsEvent;
  logger: FastifyBaseLogger;
}) {
  const {
    website_id,
    visitor_id,

    workspace_id,
    country,
    city,
    latitude,
    longitude,
    region,
    continent,
    vercelRegion,
  } = payload;
  console.log("Recording event:", {
    website_id,
    visitor_id,
    workspace_id,
    type: payload.type,
  });

  // ── Guard: only website_id and visitor_id are required
  // session_id is optional — revenue events from Stripe webhooks may not have it
  if (!website_id || !visitor_id || !workspace_id) {
    logger.warn(
      "[recordEvent] Missing website_id or visitor_id or workspace_id — skipping"
    );
    return null;
  }

  // ── Bot detection ─────────────────────────────────────────────────────────
  const uaString = req.headers.get("user-agent") || "";
  const isBot = detectBot(req);

  if (isBot) {
    logger.info("[recordEvent] Bot detected — skipping");
    return null;
  }

  const ua = parseUserAgent(uaString);

  if (ua.isBot) {
    logger.info("[recordEvent] Bot UA detected — skipping");
    return null;
  }

  // ── Self-referer fix ──────────────────────────────────────────────────────
  // When a page loads, the browser sends its own URL as the Referer header.
  // This makes localhost appear as a referrer of itself — treat as (direct).
  const rawReferer = payload.referrer || req.headers.get("referer") || "";
  const eventHostname = payload.hostname || safeHostname(payload.url || "");

  const isSelfReferer =
    rawReferer.length > 0 &&
    eventHostname.length > 0 &&
    safeHostname(rawReferer) === eventHostname.split(":")[0]; // strip port for comparison

  const cleanReferer = isSelfReferer ? "" : rawReferer;

  // ── Build request context ─────────────────────────────────────────────────
  const forwardedFor = req.headers.get("x-forwarded-for");
  const forwardedIp = forwardedFor ? forwardedFor.split(",")[0]?.trim() : null;

  const geoFromReq = getGeoData(req);
  const regionFromReq = getGeoRegion(req);
  const vercelRegionFromReq = getVercelRegion();
  const continentFromReq = getContinent(req);

  const ctx: RequestContext = {
    url: req.url,
    method: req.method,
    ip:
      req.headers.get("x-debug-ip") ||
      forwardedIp ||
      req.headers.get("x-real-ip") ||
      "unknown",
    userAgent: ua,
    geo: {
      country: country ?? geoFromReq.country ?? "Unknown",
      city: city ?? geoFromReq.city ?? "Unknown",
      latitude: latitude ?? geoFromReq.latitude ?? "Unknown",
      longitude: longitude ?? geoFromReq.longitude ?? "Unknown",
      region: region ?? regionFromReq ?? "Unknown",
      continent: continent ?? continentFromReq ?? "Unknown",
      vercelRegion: vercelRegion ?? vercelRegionFromReq ?? "Unknown",
    },
    referer: cleanReferer,
    headers: {
      get(name: string) {
        return req.headers.get(name);
      },
    },
  };

  // ── Identity hash ─────────────────────────────────────────────────────────
  const identityHash = await hashFromContext(ctx);
  const eventId = `${visitor_id}_${Date.now()}`;

  // ── Build Tinybird event payload ──────────────────────────────────────────
  const eventData = {
    event_id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),

    event_type:
      payload.type === "event"
        ? "goals"
        : payload.type === "payment"
          ? "revenue"
          : payload.type,
    event_name: payload.event_name ?? null,

    workspace_id: workspace_id,
    visitor_id: visitor_id,
    session_id: payload.session_id ?? null,
    identity_hash: identityHash ?? null,
    user_id: payload.user_id ?? null,

    // Revenue — always send 0 for non-revenue events (Float64 is non-nullable)
    revenue: payload.revenue?.amount ?? 0,
    currency: payload.revenue?.currency ?? "",


    // UTM
    utm_source: null,
    utm_medium: null,
    utm_campaign: null,
    utm_content: null,
    utm_term: null,

    // Page
    url: payload.url ?? "",
    hostname: payload.hostname ?? safeHostname(payload.url ?? ""),
    page: safePath(payload.url ?? ""),
    entrypage: payload.entrypage ?? null,
    exitlink: payload.exitlink ?? null,

    // Referer — (direct) if no referrer or self-referrer
    referer: cleanReferer
      ? getDomainWithoutWWW(cleanReferer) || "(direct)"
      : "(direct)",
    referer_url: cleanReferer || "(direct)",

    // Geo
    country: ctx.geo.country,
    city: ctx.geo.city,
    region: ctx.geo.region,
    continent: ctx.geo.continent,
    latitude: ctx.geo.latitude,
    longitude: ctx.geo.longitude,

    // Device / UA
    device: capitalize(ctx.userAgent.device.type ?? "") || "Desktop",
    device_model: ctx.userAgent.device.model ?? "Unknown",
    device_vendor: ctx.userAgent.device.vendor ?? "Unknown",
    browser: ctx.userAgent.browser.name ?? "Unknown",
    browser_version: ctx.userAgent.browser.version ?? "Unknown",
    os: ctx.userAgent.os.name ?? "Unknown",
    os_version: ctx.userAgent.os.version ?? "Unknown",
    engine: ctx.userAgent.engine.name ?? "Unknown",
    engine_version: ctx.userAgent.engine.version ?? "Unknown",
    cpu_architecture: ctx.userAgent.cpu?.architecture ?? "Unknown",
    ua: uaString || "Unknown",

    // Infra
    bot: 0,
    ip: ctx.ip,
    vercel_region: ctx.geo.vercelRegion ?? null,
    qr: 0,

    // Trigger
    trigger:
      payload.type === "payment"
        ? "payment"
        : payload.type === "event"
          ? "goal"
          : "page",

    // Custom event properties
    event_properties: JSON.stringify(payload.props ?? {}),
  };

  logger.info(
    { event_id: eventId, type: payload.type, website_id },
    "[recordEvent] Sending to Tinybird"
  );

  // ── Fire to Tinybird (non-blocking) ───────────────────────────────────────
  (async () => {
    try {
      const apiUrl = process.env.TINYBIRDS_API_URL;
      const apiKey = process.env.TINYBIRDS_API_KEY;

      if (!apiUrl || !apiKey) {
        logger.error(
          { apiUrl, apiKey },
          "[recordEvent] Missing Tinybird credentials"
        );
        return;
      }

      const response = await fetchWithRetry(
        `${apiUrl}/v0/events?name=dub_click_events&wait=true`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(eventData),
        }
      );

      const responseBody = await response.json().catch(() => ({}));

      if (!response.ok || (responseBody as any).error) {
        logger.error(
          { status: response.status, body: responseBody },
          "[recordEvent] Tinybird error"
        );
      } else {
        logger.info(
          { status: response.status, body: responseBody },
          "[recordEvent] Tinybird success"
        );
      }
    } catch (error) {
      logger.error({ error }, "[recordEvent] Failed");
    }
  })().catch((error) => {
    logger.error({ error }, "[recordEvent] Unhandled error");
  });

  return eventData;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function hashFromContext(ctx: RequestContext): Promise<string | null> {
  const { hashStringSHA256 } = await import("@repo/utils");
  return hashStringSHA256(`${ctx.ip}-${ctx.userAgent.ua}`);
}

function safeHostname(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
}

function safePath(url: string): string | null {
  try {
    return new URL(url).pathname;
  } catch {
    return null;
  }
}
