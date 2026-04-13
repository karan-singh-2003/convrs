import { Request, Response } from "express";
import { AnalyticsEventSchema, recordEvent } from "@repo/analytics";

export async function trackClickController(req: Request, res: Response) {
  try {
    const rawBody = req.body ?? {};
    console.log("[Track Controller] Raw body:", rawBody);

    const normalized = normalizeTrackPayload(rawBody);
    console.log("[Track Controller] Normalized:", normalized);

    const parsed = AnalyticsEventSchema.safeParse(normalized);
    if (!parsed.success) {
      console.warn("[Track POST] Invalid payload:", parsed.error.flatten());
      return res.status(400).json({
        success: false,
        error: "Invalid tracking payload",
        details: parsed.error.flatten(),
      });
    }

    const nativeReq = toNativeRequest(req);
    await recordEvent({
      req: nativeReq,
      payload: parsed.data,
      logger: console as any,
    });

    return res.json({ success: true, recorded: true });
  } catch (error) {
    console.error("[Track POST] Error:", error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

function normalizeTrackPayload(raw: Record<string, any>) {
  const websiteId = raw.website_id || raw.websiteId;
  const visitorId = raw.visitor_id || raw.visitorId;
  const sessionId = raw.session_id || raw.sessionId;
  const href = raw.url || raw.href;
  const hostname = raw.hostname || raw.domain || safeHostname(href);

  // ── UTM params from URL ──────────────────────────────────────────────────
  let utmParams: Record<string, string | null> = {
    utm_source: null,
    utm_medium: null,
    utm_campaign: null,
    utm_content: null,
    utm_term: null,
  };
  try {
    const urlObj = new URL(href);
    utmParams = {
      utm_source: urlObj.searchParams.get("utm_source"),
      utm_medium: urlObj.searchParams.get("utm_medium"),
      utm_campaign: urlObj.searchParams.get("utm_campaign"),
      utm_content: urlObj.searchParams.get("utm_content"),
      utm_term: urlObj.searchParams.get("utm_term"),
    };
  } catch {}

  const normalized: Record<string, any> = {
    website_id: websiteId,
    visitor_id: visitorId,
    session_id: sessionId,
    url: href,
    hostname,
    page: safePath(href),
    referrer: raw.referrer ?? null,
    language: raw.language ?? "",
    timezone: raw.timezone ?? "",
    screen_w: raw.screen_w ?? raw.screenWidth ?? 0,
    screen_h: raw.screen_h ?? raw.screenHeight ?? 0,
    viewport_w: raw.viewport_w ?? raw.viewport?.width ?? 0,
    viewport_h: raw.viewport_h ?? raw.viewport?.height ?? 0,
    timestamp: raw.timestamp || new Date().toISOString(),
    ...utmParams,
  };

  // ── Pageview ─────────────────────────────────────────────────────────────
  if (raw.type === "pageview") {
    normalized.type = "pageview";
    normalized.event_type = "pageview";
    normalized.event_name = "pageview";
    normalized.props = {};
    normalized.trigger = "page";
  }

  // ── Custom event (analytics.js sends type: "custom") ─────────────────────
  else if (raw.type === "custom") {
    const customEventName =
      raw.event_name ??
      raw.eventName ??
      raw.extraData?.eventName ??
      "unknown_event";

    // Merge extraData + any top-level prop keys as props
    const customProps: Record<string, any> = {};

    if (raw.extraData && typeof raw.extraData === "object") {
      Object.assign(customProps, raw.extraData);
    }
    if (raw.props && typeof raw.props === "object") {
      Object.assign(customProps, raw.props);
    }

    // Remove eventName from props since it's promoted to event_name
    delete customProps.eventName;
    delete customProps.event_name;

    normalized.type = "event";
    normalized.event_type = "goals";
    normalized.event_name = customEventName;
    normalized.props = customProps;
    normalized.trigger = "goal";
  }

  // ── Identify ──────────────────────────────────────────────────────────────
  else if (raw.type === "identify") {
    normalized.type = "identify";
    normalized.event_type = "identify";
    normalized.event_name = "identify";
    normalized.traits = raw.traits ?? {};
    normalized.props = {};
    normalized.trigger = null;
  }

  return normalized;
}

// ── Convert Express req → native Web API Request for recordEvent ────────────
function toNativeRequest(req: Request): globalThis.Request {
  const protocol = req.protocol || "http";
  const host = req.headers.host || "localhost";
  const fullUrl = `${protocol}://${host}${req.originalUrl}`;

  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (value) headers.set(key, Array.isArray(value) ? value[0] : value);
  }

  return new globalThis.Request(fullUrl, {
    method: req.method,
    headers,
  });
}

function safeHostname(url?: string): string | undefined {
  if (!url) return undefined;
  try {
    return new URL(url).hostname;
  } catch {
    return undefined;
  }
}

function safePath(url?: string): string | null {
  if (!url) return null;
  try {
    return new URL(url).pathname;
  } catch {
    return null;
  }
}
