import { Request, Response } from "express";
import {
  AnalyticsEventSchema,
  recordEvent,
  upsertCustomer,
} from "@repo/analytics";
import { prisma } from "@repo/db";
import * as UAParserLib from "ua-parser-js";

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

    // ── GEO / IP ────────────────────────────────────────────────────────────
    const countryHeader = req.headers["x-vercel-ip-country"];
    const country = Array.isArray(countryHeader)
      ? (countryHeader[0] ?? "")
      : (countryHeader ?? "");

    // Prefer x-forwarded-for (first IP in chain), fall back to socket address
    const ip =
      ((req.headers["x-forwarded-for"] as string | undefined)
        ?.split(",")[0]
        ?.trim() ??
        "") ||
      req.socket?.remoteAddress ||
      req.ip ||
      "";

    // ── ENFORCE TRACKING FILTERS ─────────────────────────────────────────────
    const workspaceId = parsed.data.website_id;
    if (!workspaceId) {
      return res.status(400).json({
        success: false,
        error: "Missing workspace ID in payload",
      });
    }

    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: {
        blockedHostnames: true,
        blockedIpAddresses: true,
        blockedPages: true,
      },
    });

    if (!workspace) {
      return res.status(404).json({
        success: false,
        error: "Workspace not found",
      });
    }

    const eventHostname = (parsed.data.hostname || "").toLowerCase();
    // const eventPage = (parsed.data.page || "").toLowerCase();

    // Hostname filter
    if (
      workspace.blockedHostnames &&
      workspace.blockedHostnames.length > 0 &&
      workspace.blockedHostnames.some(
        (h) => h && eventHostname === h.toLowerCase()
      )
    ) {
      return res.status(403).json({
        success: false,
        error: "Blocked by hostname filter",
      });
    }

    // IP filter (supports comma-separated IPs in x-forwarded-for)
    if (
      workspace.blockedIpAddresses &&
      workspace.blockedIpAddresses.length > 0
    ) {
      const eventIps = ip.split(",").map((i) => i.trim());
      if (
        eventIps.some((i) =>
          workspace.blockedIpAddresses.some(
            (blocked) => blocked && i === blocked
          )
        )
      ) {
        return res.status(403).json({
          success: false,
          error: "Blocked by IP filter",
        });
      }
    }

    // Page filter — fixed syntax error (removed dangling comma)
    if (
      workspace.blockedPages &&
      workspace.blockedPages.length > 0
      //   workspace.blockedPages.some((p) => p && eventPage === p.toLowerCase())
    ) {
      return res.status(403).json({
        success: false,
        error: "Blocked by page filter",
      });
    }

    // ── IDENTIFY ─────────────────────────────────────────────────────────────
    let customer = null;
    if (parsed.data.type === "identify") {
      customer = await upsertCustomer({
        workspaceId: parsed.data.website_id,
        traits: parsed.data.traits,
        geo: country,
      });
    }

    // ── UA PARSING ───────────────────────────────────────────────────────────
    const ua = (req.headers["user-agent"] as string) || "";
    const parsedUA = new UAParserLib.UAParser(ua).getResult();

    // helper → NEVER send undefined/null to Tinybird for String fields
    const safe = (v: any) => (v === undefined || v === null ? "" : String(v));

    // ── ENRICH PAYLOAD ───────────────────────────────────────────────────────
    const enrichedPayload = {
      ...parsed.data,

      // Identity
      customer_id: customer?.id ?? null,

      // 🔥 REQUIRED FIX: timestamp format for DateTime64
      timestamp: parsed.data.timestamp
        ? parsed.data.timestamp.replace("T", " ").replace("Z", "")
        : new Date().toISOString().replace("T", " ").replace("Z", ""),

      // Raw UA
      ua,

      // Device
      device: safe(parsedUA.device.type || "desktop"),
      device_model: safe(parsedUA.device.model),
      device_vendor: safe(parsedUA.device.vendor),

      // Browser
      browser: safe(parsedUA.browser.name),
      browser_version: safe(parsedUA.browser.version),

      // OS
      os: safe(parsedUA.os.name),
      os_version: safe(parsedUA.os.version),

      // Engine
      engine: safe(parsedUA.engine.name),
      engine_version: safe(parsedUA.engine.version),

      // CPU
      cpu_architecture: safe(parsedUA.cpu.architecture),

      // Geo / infra
      ip: ip ?? null,
      country: safe(country || "Unknown"),

      // ⚠️ MUST be string
      event_properties: JSON.stringify(parsed.data.props ?? {}),

      // ⚠️ ensure bot is UInt8
      bot: 0,
    };

    const nativeReq = toNativeRequest(req);

    await recordEvent({
      req: nativeReq,
      payload: { ...enrichedPayload, customer_id: customer?.id ?? "" },
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
  console.log("NORMALIZER VERSION: v2");
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

  // ── Custom event ─────────────────────────────────────────────────────────
  else if (raw.type === "custom") {
    const customEventName =
      raw.event_name ??
      raw.eventName ??
      raw.extraData?.eventName ??
      "unknown_event";

    const customProps: Record<string, any> = {};
    if (raw.extraData && typeof raw.extraData === "object") {
      Object.assign(customProps, raw.extraData);
    }
    if (raw.props && typeof raw.props === "object") {
      Object.assign(customProps, raw.props);
    }
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

  // ── Generic event ─────────────────────────────────────────────────────────
  else if (raw.type === "event") {
    normalized.type = "event";
    normalized.event_name = raw.event_name ?? "unknown_event";
    normalized.props = raw.props ?? {};
    normalized.trigger = "goal";
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
