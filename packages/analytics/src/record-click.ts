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

export async function recordClick({
  context,
  req,
  payload,
}: {
  context?: RequestContext;
  req?: Request;
  payload: Record<string, any>;
}) {
  const {
    visitor_id,
    website_id,
    hostname,
    url,

    ip_address,
    user_agent,
  } = payload;

  console.log("payload", payload);

  if (!visitor_id || !website_id) return null;

  // Use provided context or build from req
  let ctx: RequestContext;
  if (context) {
    ctx = context;
  } else if (req) {
    // Legacy Express support: build context from Request
    const searchParams = new URL(req.url).searchParams;
    if (req.headers.has("dub-no-track") || searchParams.has("dub-no-track")) {
      return null;
    }

    const uaString = req.headers.get("user-agent") || "";
    const isBot = detectBot(req);

    if (isBot) {
      console.log(`[Track] Bot detected — not recording`);
      return null;
    }

    const geo = getGeoData(req);
    const region = getGeoRegion(req);
    const vercelRegion = getVercelRegion();
    const continent = getContinent(req);

    ctx = {
      url: req.url,
      method: req.method,
      ip: ip_address || "unknown",
      userAgent: parseUserAgent(uaString),
      geo: {
        country: geo.country ?? "Unknown",
        city: geo.city ?? "Unknown",
        latitude: geo.latitude ?? "Unknown",
        longitude: geo.longitude ?? "Unknown",
        region: region || "Unknown",
        continent: continent || "Unknown",
        vercelRegion: vercelRegion,
      },
      referer: payload.referrer || req.headers.get("referer") || "",
      headers: {
        get(name: string) {
          return req.headers.get(name);
        },
      },
    };
  } else {
    throw new Error("Either context or req must be provided");
  }

  // Check for no-track headers from context
  if (ctx.headers.get("dub-no-track")) {
    return null;
  }

  // Check if bot
  if (ctx.userAgent.isBot) {
    console.log(`[Track] Bot detected — not recording`);
    return null;
  }

  // Generate identity hash from context
  const identityHash = await hashFromContext(ctx);

  // Generate a click_id
  const clickId = `${visitor_id}_${Date.now()}`;

  // ── Map to exact Tinybird schema field names ──────────────────────────────
  const eventData = {
    timestamp: new Date(payload.timestamp)
      .toISOString()
      .replace("T", " ")
      .replace("Z", "")
      .slice(0, 23),
    click_id: clickId,
    link_id: website_id,
    alias_link_id: null,
    url: url || "",
    hostname: hostname || null,
    page: payload.url ? new URL(payload.url).pathname : null,
    entrypage: null,
    exitlink: null,

    // Geo
    country: ctx.geo.country ?? "Unknown",
    city: ctx.geo.city ?? "Unknown",
    region: ctx.geo.region || "Unknown",
    latitude: ctx.geo.latitude ?? "Unknown",
    longitude: ctx.geo.longitude ?? "Unknown",
    continent: ctx.geo.continent || "Unknown",
    vercel_region: ctx.geo.vercelRegion,

    // Device / Browser
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
    ua: user_agent || ctx.userAgent.ua || "Unknown",

    // Referrer
    referer: ctx.referer
      ? getDomainWithoutWWW(ctx.referer) || "(direct)"
      : "(direct)",
    referer_url: ctx.referer || "(direct)",

    // Identity
    identity_hash: identityHash ?? null,
    user_id: payload.user_id ?? null,
    ip: ctx.ip || "unknown",

    // Flags
    bot: 0,
    qr: payload.qr ? 1 : 0,

    // Optional metadata
    trigger: payload.trigger || "page",
    workspace_id: payload.workspace_id ?? website_id ?? null,
    domain: payload.domain ?? null,
    key: payload.key ?? null,
  };

  console.log("[Tinybird] Sending event:", JSON.stringify(eventData, null, 2));

  // Fire off the async Tinybird request without blocking
  // Using .catch() to prevent unhandled rejections
  (async () => {
    try {
      const tinybirdUrl = `${process.env.TINYBIRD_API_URL}/v0/events?name=dub_click_events`;
      console.log("[Tinybird] POST URL:", tinybirdUrl);

      const response = await fetchWithRetry(tinybirdUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.TINYBIRD_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(eventData),
      });

      if (!response.ok) {
        const errBody = await response.json().catch(() => ({}));
        console.error("[Tinybird] Error:", response.status, errBody);
      } else {
        console.log("[Tinybird] Event ingested ✓");
      }
    } catch (error) {
      console.error("[Tinybird] Failed:", error);
    }
  })().catch((error) => {
    console.error("[Tinybird] Unhandled error:", error);
  });

  return eventData;
}

/**
 * Helper to generate identity hash from request context
 */
async function hashFromContext(ctx: RequestContext): Promise<string | null> {
  const { hashStringSHA256 } = await import("@repo/utils");
  return hashStringSHA256(`${ctx.ip}-${ctx.userAgent.ua}`);
}
