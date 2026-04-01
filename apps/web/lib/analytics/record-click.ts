import { userAgent } from "next/server";
import { geolocation, waitUntil } from "@vercel/functions";
import { fetchWithRetry, capitalize } from "@repo/utils";
import { detectBot } from "@/lib/middlewarre/utils/detect-bot";
import { getIdentityHash } from "@/lib/middlewarre/utils/get-identity-hash";
import { getDomainWithoutWWW } from "@repo/utils";

export async function recordClick({
  req,
  payload,
}: {
  req: Request;
  payload: Record<string, any>;
}) {
  const { visitor_id, website_id, hostname, url, timestamp, ip_address, user_agent } = payload;
  console.log("pauload", payload);

  if (!visitor_id || !website_id) return null;

  // Skip if no-track header or query param present
  const searchParams = new URL(req.url).searchParams;
  if (req.headers.has("dub-no-track") || searchParams.has("dub-no-track")) return null;

  // Parse user agent
  const ua = userAgent(req);
  const isBot = detectBot(req);

  if (isBot) {
    console.log(`[Track] Bot detected — not recording`);
    return null;
  }

  // Get identity hash
  const identityHash = await getIdentityHash(req);

  // Geo data — Vercel headers in prod, fallback for local
  const isVercel = process.env.VERCEL === "1";

  const continent = isVercel
    ? (req.headers.get("x-vercel-ip-continent") ?? "")
    : "Localhost";

  const region = isVercel
    ? (req.headers.get("x-vercel-ip-country-region") ?? "")
    : "Localhost";

  const vercelRegion = isVercel
    ? (req.headers.get("x-vercel-edge-region") ?? null)
    : null;

  const geo = isVercel ? geolocation(req) : {
    country: "Localhost",
    city: "Localhost",
    latitude: "0",
    longitude: "0",
  };

  const referer = payload.referrer || req.headers.get("referer") || "";

  // Generate a click_id — reuse visitor_id + timestamp for local dev
  // In production you'd use a proper nanoid/cuid
  const clickId = `${visitor_id}_${Date.now()}`;

  // ── Map to exact Tinybird schema field names ──────────────────────────────
  const eventData = {
    // Required by schema — map your concepts to dub's field names
    timestamp: new Date(payload.timestamp).toISOString().replace("T", " ").replace("Z", "").slice(0, 23), // DateTime64(3) format
    click_id:        clickId,
    link_id:         website_id,           // your website_id maps to link_id
    alias_link_id:   null,
    url:             url || "",
    hostname:        hostname || null,
    page:            payload.url ? new URL(payload.url).pathname : null,
    entrypage:       null,
    exitlink:        null,

    // Geo
    country:         geo.country   ?? "Unknown",
    city:            geo.city      ?? "Unknown",
    region:          region        || "Unknown",
    latitude:        geo.latitude  ?? "Unknown",
    longitude:       geo.longitude ?? "Unknown",
    continent:       continent     || "Unknown",
    vercel_region:   vercelRegion,

    // Device / Browser — exact schema field names
    device:          capitalize(ua.device.type ?? "") || "Desktop",
    device_model:    ua.device.model   ?? "Unknown",
    device_vendor:   ua.device.vendor  ?? "Unknown",
    browser:         ua.browser.name   ?? "Unknown",
    browser_version: ua.browser.version ?? "Unknown",
    os:              ua.os.name        ?? "Unknown",
    os_version:      ua.os.version     ?? "Unknown",
    engine:          ua.engine.name    ?? "Unknown",
    engine_version:  ua.engine.version ?? "Unknown",
    cpu_architecture: ua.cpu?.architecture ?? "Unknown",
    ua:              user_agent || ua.ua || "Unknown",  // schema calls it `ua` not `user_agent`

    // Referrer — schema calls it `referer` (single r)
    referer:         referer ? getDomainWithoutWWW(referer) || "(direct)" : "(direct)",
    referer_url:     referer || "(direct)",

    // Identity
    identity_hash:   identityHash ?? null,
    user_id:         payload.user_id ?? null,
    ip:              ip_address || "unknown",  // schema calls it `ip` not `ip_address`

    // Flags
    bot:             0,   // UInt8 — already filtered bots above
    qr:              payload.qr ? 1 : 0,  // UInt8

    // Optional metadata
    trigger:         payload.trigger     || "page",
    workspace_id:    payload.workspace_id ?? website_id ?? null,
    domain:          payload.domain       ?? null,
    key:             payload.key          ?? null,
  };

  console.log("[Tinybird] Sending event:", JSON.stringify(eventData, null, 2));

  waitUntil(
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
    })()
  );

  return eventData;
}