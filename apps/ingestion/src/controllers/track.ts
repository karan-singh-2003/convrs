import { Request, Response } from "express";
import crypto from "crypto";
import {
  AnalyticsEventSchema,
  recordEvent,
  sendAlertsForEvent,
  upsertCustomer,
  upsertAnonymousCustomer,
  isWorkspaceEntitled,
  claimWorkspaceUsage,
  releaseWorkspaceUsage,
  detectBotSignals,
  isHostnameAuthorized,
  localhostTrackingAllowed,
  resolveEventHostname,
} from "@repo/analytics";
import { prisma } from "@repo/db";
import email from "@repo/email";
import UsageLimitWarningEmailModule from "@repo/email/templates/usage-limit-warning";
import * as UAParserLib from "ua-parser-js";
import React from "react";
import { COUNTRIES, COUNTRY_NAMES_TO_CODES } from "@repo/utils";
import { registerTrackedEvent } from "./register-tracked-event.js";
import { getClientContext } from "../lib/client-context.js";
import { claimIdempotencyKey, releaseIdempotencyKey } from "../lib/idempotency.js";

// Cookieless pseudonymous visitor ID
function getDailySalt(): string {
  const utcDate = new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"
  const secret = process.env.COOKIELESS_SALT_SECRET;
  if (!secret) {
    // Fail closed: a hardcoded fallback salt would make "cookieless" visitor
    // IDs trivially reversible from (ip, ua, hostname, date), defeating the
    // privacy guarantee. Only cookieless requests hit this path — the
    // caller's try/catch turns this into a 500 without affecting other traffic.
    throw new Error(
      "COOKIELESS_SALT_SECRET is not set — refusing to compute a cookieless visitor ID with a public fallback salt"
    );
  }
  return `${utcDate}:${secret}`;
}

function computeCookielessVisitorId(ip: string, userAgent: string, hostname: string): string {
  const raw = `${ip}|${userAgent}|${hostname}|${getDailySalt()}`;
  return crypto.createHash("sha256").update(raw).digest("hex");
}

/**
 * POST /api/track. Order matters — each step only runs once the previous
 * ones passed, so rejected and bot traffic never creates Customer rows,
 * idempotency keys, or consumes the workspace's event quota:
 *
 *   validate → workspace → entitlement → hostname → block rules → bot gate
 *   → (human only) idempotency → usage → Customer → event → goals/alerts
 */
export async function trackClickController(req: Request, res: Response) {
  let usageClaimedFor: string | null = null;
  let idempotencyKey: string | null = null;

  try {
    // ── 1. Validate ──────────────────────────────────────────────────────────
    const normalized = normalizeTrackPayload(req.body ?? {});
    const parsed = AnalyticsEventSchema.safeParse(normalized);
    if (!parsed.success) {
      console.warn("[Track POST] Invalid payload:", parsed.error.flatten());
      return res.status(400).json({
        success: false,
        error: "Invalid tracking payload",
        details: parsed.error.flatten(),
      });
    }

    const websiteId = parsed.data.website_id;
    if (!websiteId) {
      return res.status(400).json({ success: false, error: "Missing website ID in payload" });
    }

    // The event hostname is the page URL's host. The tracker's data-domain
    // hint is a cookie-scope setting and must never decide which site an
    // event belongs to.
    const host = resolveEventHostname(parsed.data.url, headerValue(req, "origin"));
    if (!host.ok) {
      return res.status(host.reason === "invalid_url" ? 400 : 403).json({
        success: false,
        error: host.reason === "invalid_url" ? "Invalid page URL" : "Origin does not match page URL",
        code: host.reason,
      });
    }
    const eventHostname = host.hostname;

    // ── 2. Resolve workspace ─────────────────────────────────────────────────
    const workspace = await prisma.workspace.findUnique({
      where: { projectToken: websiteId },
      select: {
        id: true,
        name: true,
        slug: true,
        domain: true,
        blockedHostnames: true,
        blockedIpAddresses: true,
        blockedPages: true,
        blockedCountries: true,
        subscriptionStatus: true,
        freeTrialEndDate: true,
        paymentFailedAt: true,
        usage: true,
        usageLimit: true,
        allowedHostnames: true,
        allowAllDomains: true,
      },
    });

    if (!workspace) {
      return res.status(404).json({ success: false, error: "Workspace not found" });
    }

    // ── 3. Entitlement ───────────────────────────────────────────────────────
    // D6: same entitlement policy as the dashboard (apps/web/lib/billing/entitlement.ts)
    // — active/canceling always pass, trialing while unexpired, past_due for a
    // 7-day grace from paymentFailedAt, everything else (inactive/canceled/expired) blocked.
    if (!isWorkspaceEntitled(workspace)) {
      return res.status(403).json({ success: false, error: "Subscription inactive" });
    }

    // ── 4. Hostname authorization ────────────────────────────────────────────
    if (!isHostnameAuthorized(eventHostname, workspace, { allowLocalhost: localhostTrackingAllowed() })) {
      console.warn("[Track] Rejected event from unauthorized hostname", {
        workspaceId: workspace.id,
        hostname: eventHostname,
      });
      return res.status(403).json({
        success: false,
        error: "Hostname not allowed for this website",
        code: "hostname_not_allowed",
      });
    }

    // ── 5. Block rules (trusted IP + geo only) ───────────────────────────────
    const client = getClientContext(req);
    const ip = client.ip;
    const eventPage = (safePath(parsed.data.url) || "").toLowerCase();

    if (workspace.blockedHostnames?.some((h: string) => h && eventHostname === h.toLowerCase())) {
      return res.status(403).json({ success: false, error: "Blocked by hostname filter" });
    }

    if (ip && workspace.blockedIpAddresses?.length) {
      const ipRangeCheck = (await import("ip-range-check")).default;
      if (workspace.blockedIpAddresses.some((blocked: string) => ipRangeCheck(ip, blocked))) {
        return res.status(403).json({ success: false, error: "Blocked by IP filter" });
      }
    }

    if (workspace.blockedPages?.some((p: string) => p && eventPage.startsWith(p.toLowerCase()))) {
      return res.status(403).json({ success: false, error: "Blocked by page filter" });
    }

    const visitorCountry = client.geo.country ?? "";
    const isCountryBlocked =
      !!visitorCountry &&
      (workspace.blockedCountries?.some((country) => {
        const value = country.trim();
        if (COUNTRIES[value.toUpperCase()]) return value.toUpperCase() === visitorCountry;
        return COUNTRY_NAMES_TO_CODES[value.toLowerCase()] === visitorCountry;
      }) ??
        false);

    if (isCountryBlocked) {
      return res.status(403).json({ success: false, error: "Blocked by country filter" });
    }

    // ── 6. Bot gate — before any Customer / idempotency / quota state ────────
    const uaHeader = headerValue(req, "user-agent") ?? "";
    const bot = detectBotSignals({
      userAgent: uaHeader,
      referer: parsed.data.referrer ?? headerValue(req, "referer"),
      ip,
      method: req.method,
      url: `http://ingest.local${req.originalUrl}`,
    });

    if (bot.isBot) {
      return res.json({ success: true, recorded: false, bot: true });
    }

    // ── 7. Usage fast-path reject (keeps over-limit traffic from burning
    //       idempotency keys; the atomic claim below is authoritative) ───────
    const usageLimit = workspace.usageLimit ?? 0;
    const usage = workspace.usage ?? 0;
    if (usageLimit > 0 && usage >= usageLimit) {
      return res.status(403).json({ success: false, error: "Usage limit exceeded", code: "exceeded_limit" });
    }

    const isCookielessPayload = parsed.data.cookieless === true;
    if (isCookielessPayload && !ip) {
      console.warn("[Track POST] Cookieless event without a trusted client IP — visitors will collapse", {
        workspaceId: workspace.id,
        source: client.source,
      });
    }
    const effectiveVisitorId: string | null | undefined = isCookielessPayload
      ? computeCookielessVisitorId(ip ?? "", uaHeader, eventHostname)
      : parsed.data.visitor_id;

    // ── 8. Idempotency ───────────────────────────────────────────────────────
    // Dedupe a replayed/duplicated delivery of the same client-generated
    // event. Older cached tracker builds don't send event_id — skip the check
    // for them rather than reject, so they keep working unchanged.
    if (parsed.data.event_id) {
      idempotencyKey = `idem:track:${workspace.id}:${parsed.data.event_id}`;
      if ((await claimIdempotencyKey(idempotencyKey)) === "duplicate") {
        idempotencyKey = null;
        return res.json({
          success: true,
          recorded: false,
          duplicate: true,
          ...(isCookielessPayload && { visitorId: effectiveVisitorId }),
        });
      }
    }

    // ── 9. Usage — atomic guarded increment, claimed before anything is stored
    if (!(await claimWorkspaceUsage(workspace.id, usageLimit)) && usageLimit > 0) {
      await rollback();
      return res.status(403).json({ success: false, error: "Usage limit exceeded", code: "exceeded_limit" });
    }
    usageClaimedFor = workspace.id;

    // ── 10. Customer ─────────────────────────────────────────────────────────
    const parsedUA = new UAParserLib.UAParser(uaHeader).getResult();
    const safe = (v: any) => (v === undefined || v === null ? "" : String(v));
    const deviceName = safe(parsedUA.device.type || "desktop");
    const browserName = safe(parsedUA.browser.name);
    const geoCountry = client.geo.country ?? "Unknown";

    let customer = null;
    // identify is not meaningful in cookieless mode (no persistent visitor to
    // attach traits to), so it's skipped rather than upserting a customer
    // keyed to a same-day-only pseudonymous hash.
    if (parsed.data.type === "identify" && !isCookielessPayload) {
      customer = await upsertCustomer({
        workspaceId: workspace.id,
        traits: (parsed.data.traits ?? {}) as Record<string, any>,
        visitorId: effectiveVisitorId ?? undefined,
        geo: COUNTRIES[geoCountry] ?? geoCountry,
        device: deviceName,
        browser: browserName,
      });
    } else if (parsed.data.type === "pageview" && effectiveVisitorId) {
      customer = await upsertAnonymousCustomer({
        workspaceId: workspace.id,
        visitorId: effectiveVisitorId,
        country: COUNTRIES[geoCountry] ?? geoCountry,
        device: deviceName,
        browser: browserName,
      });
    }

    // ── 11. Event ────────────────────────────────────────────────────────────
    const workspaceOwner = await prisma.workspaceUsers.findFirst({
      where: { workspaceId: workspace.id, role: "owner" },
      select: { user: { select: { id: true } } },
    });

    const enrichedPayload = {
      ...parsed.data,
      hostname: eventHostname,
      visitor_id: effectiveVisitorId, // server-computed hash replaces the client placeholder when cookieless
      workspace_id: workspace.id,
      user_id: workspaceOwner?.user?.id ?? "",
      customer_id: customer?.id ?? "",
      timestamp: parsed.data.timestamp
        ? parsed.data.timestamp.replace("T", " ").replace("Z", "")
        : new Date().toISOString().replace("T", " ").replace("Z", ""),
      ua: uaHeader,
      device: deviceName,
      device_model: safe(parsedUA.device.model),
      device_vendor: safe(parsedUA.device.vendor),
      browser: browserName,
      browser_version: safe(parsedUA.browser.version),
      os: safe(parsedUA.os.name),
      os_version: safe(parsedUA.os.version),
      engine: safe(parsedUA.engine.name),
      engine_version: safe(parsedUA.engine.version),
      cpu_architecture: safe(parsedUA.cpu.architecture),
      ip: ip ?? null,
      event_properties: JSON.stringify(parsed.data.props ?? {}),
      bot: 0,
      country: geoCountry,
      city: client.geo.city ?? "Unknown",
      latitude: client.geo.latitude ?? "Unknown",
      longitude: client.geo.longitude ?? "Unknown",
      region: client.geo.region ?? "Unknown",
      continent: client.geo.continent ?? "Unknown",
      vercelRegion: "Unknown",
    };

    const recordedEvent = await recordEvent({
      req: toNativeRequest(req),
      payload: enrichedPayload as any,
      logger: console as any,
      clientIp: ip,
    });

    if (!recordedEvent) {
      await rollback();
      return res.json({
        success: true,
        recorded: false,
        ...(isCookielessPayload && { visitorId: effectiveVisitorId }),
      });
    }
    usageClaimedFor = null;
    idempotencyKey = null;

    // ── 12. Goals / tracked-event registry / alerts (fire-and-forget) ────────
    void registerTrackedEvent({
      workspaceId: workspace.id,
      eventName: parsed.data.event_name ?? parsed.data.type ?? "unknown",
      eventType: recordedEvent.event_type,
      trigger: recordedEvent.trigger,
    });

    void prisma.workspace
      .findUniqueOrThrow({
        where: { id: workspace.id },
        select: { usage: true, usageLimit: true, slug: true },
      })
      .then((updated) =>
        maybeSendUsageLimitWarning({
          workspaceId: workspace.id,
          workspaceName: workspace.name,
          workspaceSlug: updated.slug ?? workspace.slug,
          usageBefore: usage,
          usageAfter: updated.usage,
          usageLimit: updated.usageLimit,
        })
      )
      .catch((error) => {
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

    // The server-computed visitorId is returned so cookieless clients can cache it.
    return res.json({
      success: true,
      recorded: true,
      ...(isCookielessPayload && { visitorId: effectiveVisitorId }),
    });
  } catch (error) {
    console.error("[Track POST] Error:", error);
    await rollback().catch(() => undefined);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }

  async function rollback() {
    if (usageClaimedFor) await releaseWorkspaceUsage(usageClaimedFor);
    if (idempotencyKey) await releaseIdempotencyKey(idempotencyKey);
    usageClaimedFor = null;
    idempotencyKey = null;
  }
}

function headerValue(req: Request, name: string): string | null {
  const value = req.headers[name];
  const first = Array.isArray(value) ? value[0] : value;
  return first ? first : null;
}

export function normalizeTrackPayload(raw: Record<string, any>) {
  const websiteId = raw.website_id || raw.websiteId;
  const visitorId = raw.visitor_id || raw.visitorId;
  const sessionId = raw.session_id || raw.sessionId;
  const href = raw.url || raw.href;
  // Always the page URL's host — never the client-supplied `domain` /
  // `hostname` fields, which come from the tracker's data-domain attribute.
  const hostname = safeHostname(href);
  const cookieless = raw.cookieless === true;
  const eventId = raw.event_id || raw.eventId; // idempotency key, absent on older cached tracker builds

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
    entrypage: raw.entrypage ?? null,
    page: safePath(href),
    referrer: raw.referrer ?? null,
    language: raw.language ?? "",
    timezone: raw.timezone ?? "",
    screen_w: raw.screen_w ?? raw.screenWidth ?? 0,
    screen_h: raw.screen_h ?? raw.screenHeight ?? 0,
    viewport_w: raw.viewport_w ?? raw.viewport?.width ?? 0,
    viewport_h: raw.viewport_h ?? raw.viewport?.height ?? 0,
    timestamp: raw.timestamp || new Date().toISOString(),
    cookieless,
    event_id: eventId,
    ...utmParams,
  };

  if (raw.type === "pageview") {
    normalized.type = "pageview";
    normalized.event_type = "pageview";
    normalized.event_name = "pageview";
    normalized.props = {};
    normalized.trigger = "page";
  } else if (raw.type === "custom") {
    const customEventName =
      raw.event_name ?? raw.eventName ?? raw.extraData?.eventName ?? "unknown_event";

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
    normalized.entrypage = raw.entrypage ?? null;
  } else if (raw.type === "identify") {
    normalized.type = "identify";
    normalized.event_type = "identify";
    normalized.event_name = "identify";
    normalized.traits = raw.traits ?? {};
    normalized.props = {};
    normalized.trigger = null;
  } else if (raw.type === "exitlink") {
    normalized.type = "exitlink";
    normalized.event_type = "pageview";
    normalized.event_name = "exitlink";
    normalized.exitlink = raw.exitlink ?? null;
    normalized.entrypage = raw.entrypage ?? null;
    normalized.props = {};
    normalized.trigger = "exitlink";
  } else if (raw.type === "event") {
    normalized.type = "event";
    normalized.event_name = raw.event_name ?? "unknown_event";
    normalized.props = raw.props ?? {};
    normalized.trigger = "goal";
  }

  return normalized;
}

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

  const upgradeUrl = `https://app.${process.env.NEXT_PUBLIC_APP_DOMAIN || "convrs.dev"}/${workspaceSlug}/billing`;
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
