import { Request, Response } from "express";
import { randomUUID } from "crypto";
import * as z from "zod/v4";
import { classifyUserAgent } from "@convrs/ai-bot-sdk";
import {
  trackBotEvent,
  isWorkspaceEntitled,
  isHostnameAuthorized,
  localhostTrackingAllowed,
  normalizeHostname,
} from "@repo/analytics";
import { prisma } from "@repo/db";
import { COUNTRIES, COUNTRY_NAMES_TO_CODES } from "@repo/utils";
import { extractBearerToken, isValidBotToken } from "../lib/bot-auth.js";
import { claimBotDailyCap, releaseBotDailyCap, secondsUntilUtcMidnight } from "../lib/bot-daily-cap.js";
import { getClientContext, normalizeIp } from "../lib/client-context.js";
import { aiCrawlsCallerLimiter, aiCrawlsWorkspaceLimiter } from "../lib/rate-limit.js";
import { verifyCrawler } from "../lib/crawler-verification.js";
import { claimIdempotencyKey, releaseIdempotencyKey } from "../lib/idempotency.js";

// ── Incoming payload from @convrs/ai-bot-sdk's sendBotEvent() ────────────────
// Unknown keys (e.g. the SDK's informational bot.vendor/category) are
// stripped: classification is always re-derived here from the raw UA.
const IncomingBotEventSchema = z.object({
  siteId: z.string().min(1).max(128).optional(),
  websiteId: z.string().min(1).max(128).optional(),
  eventId: z.string().max(64).optional(),
  domain: z.string().max(253).optional(),
  url: z.string().min(1).max(8192),
  referrer: z.string().max(4096).nullable().optional(),
  geo: z
    .object({
      country: z.string().max(64).optional(),
    })
    .optional(),
  bot: z.object({
    userAgent: z.string().min(1).max(2048),
    ip: z.string().max(64).nullable().optional(),
    statusCode: z.number().optional(),
    source: z.string().max(32).optional(),
  }),
});

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function trackAICrawlerController(req: Request, res: Response) {
  let botCapKey: string | null = null;
  let idempotencyKey: string | null = null;

  try {
    // ── 0. Flood guard per calling server, before any DB work ───────────────
    const caller = getClientContext(req).ip ?? "unknown";
    const callerLimit = aiCrawlsCallerLimiter(caller);
    if (!callerLimit.allowed) {
      res.setHeader("Retry-After", String(callerLimit.retryAfterSeconds));
      return res.status(429).json({ success: false, error: "Too many requests" });
    }

    // ── 1. Validate ──────────────────────────────────────────────────────────
    const parsed = IncomingBotEventSchema.safeParse(normalizeCrawlPayload(req.body));
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: "Invalid bot tracking payload",
        details: z.flattenError(parsed.error),
      });
    }

    const payload = parsed.data;
    const siteId = payload.siteId ?? payload.websiteId;
    if (!siteId) {
      return res.status(400).json({ success: false, error: "Missing siteId" });
    }

    const reported = sanitizeCrawledUrl(payload.url, payload.domain);
    if (!reported) {
      return res.status(400).json({ success: false, error: "Invalid url" });
    }

    // ── 2. Resolve workspace ─────────────────────────────────────────────────
    const workspace = await prisma.workspace.findUnique({
      where: { projectToken: siteId },
      select: {
        id: true,
        domain: true,
        allowedHostnames: true,
        allowAllDomains: true,
        blockedHostnames: true,
        blockedIpAddresses: true,
        blockedPages: true,
        blockedCountries: true,
        botTrafficRequireAuth: true,
        subscriptionStatus: true,
        freeTrialEndDate: true,
        paymentFailedAt: true,
      },
    });

    if (!workspace) {
      return res.status(404).json({ success: false, error: "Workspace not found" });
    }

    // ── 3. Authenticate (before revealing anything else about the workspace) ─
    // The public project token identifies the workspace. A bot token is
    // optional hardening: required only with botTrafficRequireAuth, but a
    // token that is sent is always checked, so a wrong or rotated one fails
    // loudly instead of silently downgrading to unauthenticated.
    const authHeader = req.headers.authorization;
    const authPresented = Array.isArray(authHeader) ? authHeader.length > 0 : !!authHeader?.trim();
    const authenticated = authPresented
      ? await isValidBotToken(extractBearerToken(authHeader), workspace.id)
      : false;
    if ((authPresented || workspace.botTrafficRequireAuth) && !authenticated) {
      res.setHeader("WWW-Authenticate", 'Bearer realm="convrs-bot-tracking"');
      return res.status(401).json({
        success: false,
        error: authPresented ? "Invalid bot tracking token" : "Missing bot tracking token",
      });
    }

    const workspaceLimit = aiCrawlsWorkspaceLimiter(workspace.id);
    if (!workspaceLimit.allowed) {
      res.setHeader("Retry-After", String(workspaceLimit.retryAfterSeconds));
      return res.status(429).json({ success: false, error: "Too many requests" });
    }

    // ── 4. Entitlement — same policy as apps/web's dashboard and track.ts ────
    if (!isWorkspaceEntitled(workspace)) {
      return res.status(403).json({ success: false, error: "Subscription inactive" });
    }

    // ── 5. Hostname authorization ────────────────────────────────────────────
    const { url, hostname, page } = reported;
    if (!isHostnameAuthorized(hostname, workspace, { allowLocalhost: localhostTrackingAllowed() })) {
      return res.status(403).json({ success: false, error: "Hostname not allowed", code: "hostname_not_allowed" });
    }

    // ── 6. Classify (server-side only; client category/vendor are ignored) ──
    const classification = classifyUserAgent(payload.bot.userAgent);
    if (!classification) {
      return res.status(202).json({ success: true, tracked: false, reason: "not_a_bot" });
    }

    // ── 7. Block rules ───────────────────────────────────────────────────────
    const ip = normalizeIp(payload.bot.ip);
    const country = normalizeCountry(payload.geo?.country);

    if (workspace.blockedHostnames?.some((h) => h && hostname === h.toLowerCase())) {
      return res.status(403).json({ success: false, error: "Blocked by hostname filter" });
    }
    if (workspace.blockedPages?.some((p) => p && page.startsWith(p.toLowerCase()))) {
      return res.status(403).json({ success: false, error: "Blocked by page filter" });
    }
    if (ip && workspace.blockedIpAddresses?.length) {
      const ipRangeCheck = (await import("ip-range-check")).default;
      if (workspace.blockedIpAddresses.some((blocked: string) => ipRangeCheck(ip, blocked))) {
        return res.status(403).json({ success: false, error: "Blocked by IP filter" });
      }
    }
    if (country && workspace.blockedCountries?.some((c) => normalizeCountry(c) === country)) {
      return res.status(403).json({ success: false, error: "Blocked by country filter" });
    }

    // ── 8. Idempotency — the SDK reuses one eventId for every send of a visit ─
    const clientEventId = payload.eventId && UUID_RE.test(payload.eventId) ? payload.eventId.toLowerCase() : null;
    const eventId = clientEventId ?? randomUUID();
    if (clientEventId) {
      idempotencyKey = `idem:aicrawl:${workspace.id}:${clientEventId}`;
      if ((await claimIdempotencyKey(idempotencyKey)) === "duplicate") {
        idempotencyKey = null;
        return res.status(202).json({ success: true, tracked: false, duplicate: true, eventId });
      }
    }

    // ── 9. Daily Bot Traffic cap ─────────────────────────────────────────────
    // Bot events have their own allowance and never consume Workspace.usage,
    // so nobody holding the public project token can exhaust the human
    // analytics quota; at worst Bot Traffic pauses until the next UTC day.
    const cap = await claimBotDailyCap(workspace.id);
    if (!cap.allowed) {
      if (idempotencyKey) await releaseIdempotencyKey(idempotencyKey);
      idempotencyKey = null;
      res.setHeader("Retry-After", String(secondsUntilUtcMidnight()));
      return res.status(429).json({
        success: false,
        error: "Daily Bot Traffic limit reached",
        code: "bot_daily_cap",
      });
    }
    botCapKey = cap.key;

    // ── 10. Verify the crawler's identity where the vendor supports it ───────
    const verification = await verifyCrawler(ip, classification);

    // ── 11. Persist ──────────────────────────────────────────────────────────
    const recorded = await trackBotEvent({
      event: {
        event_id: eventId,
        timestamp: new Date().toISOString().replace("T", " ").replace("Z", ""),
        workspace_id: workspace.id,
        domain: hostname,
        url,
        hostname,
        page,
        vendor: classification.vendor,
        agent_name: classification.agentName,
        category: classification.category,
        user_agent: payload.bot.userAgent,
        ip,
        country: country ?? "Unknown",
        status_code: normalizeStatusCode(payload.bot.statusCode),
        referrer: sanitizeReferrer(payload.referrer),
        source: sanitizeSource(payload.bot.source),
        verification,
        match_type: classification.matchType,
        classifier_version: classification.classifierVersion,
        authenticated: authenticated ? 1 : 0,
      },
      logger: console as any,
    });

    if (!recorded) {
      await rollback();
      return res.status(500).json({ success: false, error: "Bot event could not be recorded" });
    }

    return res.status(202).json({
      success: true,
      tracked: true,
      eventId,
      category: classification.category,
      vendor: classification.vendor,
      agentName: classification.agentName,
      verification,
      authenticated,
    });
  } catch (error) {
    console.error("[AI Crawl Track] Error:", error);
    await rollback().catch(() => undefined);
    return res.status(500).json({ success: false, error: "Internal error" });
  }

  async function rollback() {
    if (botCapKey) await releaseBotDailyCap(botCapKey);
    if (idempotencyKey) await releaseIdempotencyKey(idempotencyKey);
    botCapKey = null;
    idempotencyKey = null;
  }
}

/**
 * Accepts the field names used by direct HTTP integrations as aliases:
 * `href` for `url` and `ai` for `bot`. The canonical names win when both
 * are present. Anything else is left for schema validation.
 */
export function normalizeCrawlPayload(raw: unknown): unknown {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return raw;
  const body = { ...(raw as Record<string, unknown>) };
  if (body.url === undefined && typeof body.href === "string") body.url = body.href;
  if (body.bot === undefined && body.ai && typeof body.ai === "object") body.bot = body.ai;
  return body;
}

/**
 * Reported URL reduced to origin + path (query strings carry tokens/PII;
 * SDK 1.0.x sent them verbatim). `domain` is the legacy SDK override for the
 * public host and, when given, replaces the URL's host so the host we
 * authorize and the host we store are always the same.
 */
export function sanitizeCrawledUrl(
  rawUrl: string,
  domainOverride?: string
): { url: string; hostname: string; page: string } | null {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return null;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;

  const clean = new URL(parsed.origin);
  clean.pathname = parsed.pathname;
  if (domainOverride) {
    const host = normalizeHostname(domainOverride);
    if (!host) return null;
    clean.hostname = host;
    clean.port = "";
  }

  const hostname = normalizeHostname(clean.hostname);
  if (!hostname) return null;
  return { url: clean.href, hostname, page: clean.pathname.toLowerCase() };
}

function sanitizeReferrer(raw: string | null | undefined): string | null {
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return `${url.origin}${url.pathname}`;
  } catch {
    return null;
  }
}

function sanitizeSource(raw: string | undefined): string {
  return raw && /^[a-z0-9_-]{1,32}$/i.test(raw) ? raw.toLowerCase() : "server-sdk";
}

function normalizeStatusCode(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) && value >= 100 && value <= 599 ? value : null;
}

/** ISO-3166 alpha-2 from a code or English country name; null otherwise. */
function normalizeCountry(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const value = raw.trim();
  const upper = value.toUpperCase();
  if (COUNTRIES[upper]) return upper;
  return COUNTRY_NAMES_TO_CODES[value.toLowerCase()] ?? null;
}
