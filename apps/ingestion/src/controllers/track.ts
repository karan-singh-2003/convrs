import { Request, Response } from "express";
import {
  AnalyticsEventSchema,
  recordEvent,
  sendAlertsForEvent,
  upsertCustomer,
  upsertAnonymousCustomer,
} from "@repo/analytics";
import { prisma } from "@repo/db";
import email from "@repo/email";
import UsageLimitWarningEmailModule from "@repo/email/templates/usage-limit-warning";
import * as UAParserLib from "ua-parser-js";
import React from "react";

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

    // ── IP EXTRACTION (GEO handled in recordEvent) ──────────────────────────────
    // Geo is now centralized in recordEvent() → getGeoData()
    // IP is extracted once here and passed through (no splitting)
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
      where: { projectToken: workspaceId },
      select: {
        id: true,
        name: true,
        slug: true,
        blockedHostnames: true,
        blockedIpAddresses: true,
        blockedPages: true,
        subscriptionStatus: true,
        usage: true,
        usageLimit: true,
      },
    });

    if (!workspace) {
      return res.status(404).json({
        success: false,
        error: "Workspace not found",
      });
    }

    if (workspace.subscriptionStatus === "canceled") {
      return res.status(403).json({
        success: false,
        error: "Subscription canceled",
      });
    }

    const eventHostname = (parsed.data.hostname || "").toLowerCase();
    const eventPage = (safePath(parsed.data.url) || "").toLowerCase();

    // Hostname filter
    if (
      workspace.blockedHostnames &&
      workspace.blockedHostnames.length > 0 &&
      workspace.blockedHostnames.some(
        (h: string) => h && eventHostname === h.toLowerCase()
      )
    ) {
      return res.status(403).json({
        success: false,
        error: "Blocked by hostname filter",
      });
    }

    // IP filter (now supports CIDR via ip-range-check)
    if (
      workspace.blockedIpAddresses &&
      workspace.blockedIpAddresses.length > 0
    ) {
      const ipRangeCheck = (await import("ip-range-check")).default;
      if (
        workspace.blockedIpAddresses.some((blocked: string) =>
          ipRangeCheck(ip, blocked)
        )
      ) {
        return res.status(403).json({
          success: false,
          error: "Blocked by IP filter",
        });
      }
    }

    // Page filter — blocks pages starting with the blocked path
    if (
      workspace.blockedPages &&
      workspace.blockedPages.length > 0 &&
      workspace.blockedPages.some(
        (p: string) => p && eventPage.startsWith(p.toLowerCase())
      )
    ) {
      return res.status(403).json({
        success: false,
        error: "Blocked by page filter",
      });
    }

    const usageLimit = workspace.usageLimit ?? 0;
    const usage = workspace.usage ?? 0;

    if (usageLimit > 0 && usage >= usageLimit) {
      return res.status(403).json({
        success: false,
        error: "Usage limit exceeded",
        code: "exceeded_limit",
      });
    }
    // ── IDENTIFY ─────────────────────────────────────────────────────────────
    let customer = null;

    if (parsed.data.type === "identify") {
      customer = await upsertCustomer({
        workspaceId: workspace.id,
        traits: (parsed.data.traits ?? {}) as Record<string, any>,
        visitorId: parsed.data.visitor_id ?? undefined, // ← pass so it can upgrade anon record
      });
    }

    // ── PAGEVIEW → create/find anonymous customer ─────────────────────────────
    else if (parsed.data.type === "pageview" && parsed.data.visitor_id) {
      customer = await upsertAnonymousCustomer({
        workspaceId: workspace.id,
        visitorId: parsed.data.visitor_id,
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

      //  MUST be string
      event_properties: JSON.stringify(parsed.data.props ?? {}),

      //  ensure bot is UInt8
      bot: 0,
    };

    const nativeReq = toNativeRequest(req);

    const recordedEvent = await recordEvent({
      req: nativeReq,
      payload: { ...enrichedPayload, customer_id: customer?.id ?? "" },
      logger: console as any,
    });

    if (recordedEvent) {
      const updatedWorkspace = await prisma.workspace.update({
        where: { id: workspace.id },
        data: { usage: { increment: 1 } },
        select: { usage: true, usageLimit: true, slug: true },
      });

      void maybeSendUsageLimitWarning({
        workspaceId: workspace.id,
        workspaceName: workspace.name,
        workspaceSlug: updatedWorkspace.slug ?? workspace.slug,
        usageBefore: usage,
        usageAfter: updatedWorkspace.usage,
        usageLimit: updatedWorkspace.usageLimit,
      }).catch((error) => {
        console.error("[Track POST] Failed to send usage warning", error);
      });

      void sendAlertsForEvent({
        workspaceId: workspace.id,
        eventName: parsed.data.event_name ?? parsed.data.type ?? "event",
        event: {
          ...recordedEvent,
          workspaceName: workspace.name,
        },
      });
    }

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

const UsageLimitWarningEmail =
  (UsageLimitWarningEmailModule as any).default ?? UsageLimitWarningEmailModule;

async function maybeSendUsageLimitWarning({
  workspaceId,
  workspaceName,
  workspaceSlug,
  usageBefore,
  usageAfter,
  usageLimit,
}: {
  workspaceId: string;
  workspaceName: string;
  workspaceSlug: string;
  usageBefore: number;
  usageAfter: number;
  usageLimit: number;
}) {
  if (!usageLimit || usageLimit <= 0) return;

  const warningThreshold = Math.ceil(usageLimit * 0.95);
  if (usageBefore >= warningThreshold || usageAfter < warningThreshold) return;

  const existingEmail = await prisma.sentEmail.findFirst({
    where: { workspaceId, type: "usage_limit_95" },
    select: { id: true },
  });

  if (existingEmail) return;

  const owner = await prisma.workspaceUsers.findFirst({
    where: { workspaceId, role: "owner" },
    select: { user: { select: { email: true, name: true } } },
  });

  const recipientEmail = owner?.user?.email ?? null;
  if (!recipientEmail) return;

  const upgradeUrl = `https://app.boilercode.dev/${workspaceSlug}/settings/billing`;
  const ownerName = owner?.user?.name ?? null;

  await email.sendEmail({
    to: recipientEmail,
    subject: `You're at 95% of your ${workspaceName} event limit`,
    react: React.createElement(UsageLimitWarningEmail, {
      email: recipientEmail,
      workspaceName,
      ownerName,
      usage: usageAfter,
      usageLimit,
      upgradeUrl,
    }),
  });

  await prisma.sentEmail.create({
    data: { type: "usage_limit_95", workspaceId },
  });
}
