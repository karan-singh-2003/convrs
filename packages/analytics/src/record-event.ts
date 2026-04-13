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
  const { website_id, visitor_id, session_id } = payload;
  console.log("[Tinybird] URL:", process.env.TINYBIRDS_API_URL);
  if (!website_id || !visitor_id || !session_id) return null;

  // ── Build context from req (same pattern as recordClick) ─────────────────
  const uaString = req.headers.get("user-agent") || "";
  const isBot = detectBot(req);

  if (isBot) {
    logger.info("[recordEvent] Bot detected — skipping");
    return null;
  }

  const geo = getGeoData(req);
  const region = getGeoRegion(req);
  const vercelRegion = getVercelRegion();
  const continent = getContinent(req);
  const ua = parseUserAgent(uaString);

  if (ua.isBot) {
    logger.info("[recordEvent] Bot UA detected — skipping");
    return null;
  }

  const ctx: RequestContext = {
    url: req.url,
    method: req.method,
    ip:
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      req.headers.get("x-real-ip") ??
      "unknown",
    userAgent: ua,
    geo: {
      country: geo.country ?? "Unknown",
      city: geo.city ?? "Unknown",
      latitude: geo.latitude ?? "Unknown",
      longitude: geo.longitude ?? "Unknown",
      region: region ?? "Unknown",
      continent: continent ?? "Unknown",
      vercelRegion: vercelRegion,
    },
    referer: payload.referrer || req.headers.get("referer") || "",
    headers: {
      get(name: string) {
        return req.headers.get(name);
      },
    },
  };

  // ── Identity hash (same as recordClick) ───────────────────────────────────
  const identityHash = await hashFromContext(ctx);

  const eventId = `${visitor_id}_${Date.now()}`;

  console.log("recording geo data", ctx.geo);
  // ── Map to exact Tinybird schema field names ──────────────────────────────
  // const eventData = {
  //   // Base
  //   event_id: crypto.randomUUID(), // pure UUID
  //   timestamp: new Date().toISOString(), // ISO format
  //   website_id: website_id,
  //   workspace_id: website_id,
  //   visitor_id: visitor_id,
  //   session_id: session_id,
  //   type: payload.type,
  //   event_type: payload.type === "event" ? "goals" : payload.type,

  //   // Page
  //   url: payload.url ?? "",
  //   hostname: payload.hostname ?? safeHostname(payload.url),
  //   page: safePath(payload.url),
  //   referrer: payload.referrer ?? null,
  //   title: payload.title ?? null,

  //   // Client (from SDK — not enriched server-side)
  //   language: payload.language ?? "",
  //   timezone: payload.timezone ?? "",
  //   screen_w: payload.screen_w ?? 0,
  //   screen_h: payload.screen_h ?? 0,
  //   viewport_w: payload.viewport_w ?? 0,
  //   viewport_h: payload.viewport_h ?? 0,

  //   // Geo (server-enriched — same as recordClick)
  //   country: ctx.geo.country,
  //   city: ctx.geo.city,
  //   region: ctx.geo.region,
  //   latitude: ctx.geo.latitude,
  //   longitude: ctx.geo.longitude,
  //   continent: ctx.geo.continent,
  //   vercel_region: ctx.geo.vercelRegion,

  //   // Device (server-enriched — same as recordClick)
  //   device: capitalize(ctx.userAgent.device.type ?? "") || "Desktop",
  //   device_model: ctx.userAgent.device.model ?? "Unknown",
  //   device_vendor: ctx.userAgent.device.vendor ?? "Unknown",
  //   browser: ctx.userAgent.browser.name ?? "Unknown",
  //   browser_version: ctx.userAgent.browser.version ?? "Unknown",
  //   os: ctx.userAgent.os.name ?? "Unknown",
  //   os_version: ctx.userAgent.os.version ?? "Unknown",
  //   engine: ctx.userAgent.engine.name ?? "Unknown",
  //   engine_version: ctx.userAgent.engine.version ?? "Unknown",
  //   cpu_architecture: ctx.userAgent.cpu?.architecture ?? "Unknown",
  //   ua: uaString || "Unknown",

  //   // Referrer (same as recordClick)
  //   referer: ctx.referer
  //     ? getDomainWithoutWWW(ctx.referer) || "(direct)"
  //     : "(direct)",
  //   referer_url: ctx.referer || "(direct)",

  //   // Identity (same as recordClick)
  //   identity_hash: identityHash ?? null,
  //   ip: ctx.ip,
  //   bot: 0,

  //   // ── type = "event" ──────────────────────────────────────────────────────
  //   event_name: payload.event_name ?? null,
  //   props: JSON.stringify(payload.props ?? {}),
  //   event_properties: JSON.stringify(payload.props ?? {}),
  //   trigger: payload.type === "event" ? "goal" : "page",

  //   // ── type = "identify" ───────────────────────────────────────────────────
  //   user_id: (payload.traits?.user_id as string) ?? null,
  //   traits: JSON.stringify(payload.traits ?? {}),

  //   // ── type = "payment" | "refund" ─────────────────────────────────────────
  //   revenue_amount: revenue?.amount ?? null,
  //   revenue_currency: revenue?.currency ?? "",
  //   revenue_provider: revenue?.provider ?? "",
  //   revenue_plan: revenue?.plan ?? null,
  //   revenue_email: revenue?.email ?? null,
  //   payment_type: revenue?.payment_type ?? "",
  // };
  const eventData = {
    event_id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),

    event_type: payload.type === "event" ? "goals" : payload.type,
    event_name: payload.event_name ?? null,

    workspace_id: website_id, // ← only workspace_id, drop website_id
    visitor_id: visitor_id,
    session_id: session_id,
    identity_hash: identityHash ?? null,

    // UTM (send nulls explicitly)
    utm_source: null,
    utm_medium: null,
    utm_campaign: null,
    utm_content: null,
    utm_term: null,

    // Page
    url: payload.url ?? "",
    hostname: payload.hostname ?? safeHostname(payload.url),
    page: safePath(payload.url),
    entrypage: null,
    exitlink: null,
    referer: ctx.referer
      ? getDomainWithoutWWW(ctx.referer) || "(direct)"
      : "(direct)",
    referer_url: ctx.referer || "(direct)",

    // Geo
    country: ctx.geo.country,
    city: ctx.geo.city,
    region: ctx.geo.region,
    continent: ctx.geo.continent,
    latitude: ctx.geo.latitude,
    longitude: ctx.geo.longitude,

    // Device
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

    bot: 0,
    ip: ctx.ip,
    vercel_region: ctx.geo.vercelRegion ?? null,

    qr: 0, // ← was missing
    trigger: payload.type === "event" ? "goal" : "page",

    event_properties: JSON.stringify(payload.props ?? {}),
  };

  logger.info(
    { event_id: eventId, type: payload.type, website_id },
    "[recordEvent] Sending to Tinybird"
  );

  console.log("[recordEvent] Event data:", eventData);
  // ── Fire off async Tinybird request without blocking (same as recordClick) ─
  (async () => {
    try {
      const apiUrl = process.env.TINYBIRDS_API_URL;
      const apiKey = process.env.TINYBIRDS_API_KEY;

      console.log("Tinybird URL:", apiUrl);
      console.log("Tinybird Key:", apiKey);

      if (!apiUrl || !apiKey) {
        logger.error(
          { apiUrl, apiKey },
          "[recordEvent] Missing Tinybird credentials"
        );
        return;
      }

      const tinybirdUrl = `${apiUrl}/v0/events?name=dub_click_events&wait=true`;

      const response = await fetchWithRetry(tinybirdUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(eventData),
      });
      console.log("Tinybird response:", response);

      if (!response.ok) {
        const errBody = await response.json().catch(() => ({}));
        logger.error(
          { status: response.status, errBody },
          "[recordEvent] Tinybird error"
        );
      } else {
        logger.info({ event_id: eventId }, "[recordEvent] Ingested ✓");
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
