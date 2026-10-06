import { decideWhetherToTrack, resolveSiteId } from "./decide";
import {
  normalizeStatusCode,
  readHeader,
  resolveClientIp,
  resolveEdgeGeo,
  sanitizeReferrer,
  sanitizeUrl,
} from "./request-utils";
import type { ConvrsBotConfig, MinimalRequest, ResponseLike, TrackDecision, TrackOutcome } from "./types";

export const SDK_VERSION = "1.1.0";
export const DEFAULT_ENDPOINT = "https://ingest.convrs.dev/api/ai-crawls";
/** The customer's page must never wait long on us; tracking is best-effort. */
export const DEFAULT_TIMEOUT_MS = 1000;
/** Matches the ingestion limit; real crawler User-Agents are far shorter. */
const MAX_USER_AGENT_LENGTH = 1024;

export interface StatusInfo {
  statusCode?: number;
  response?: ResponseLike;
}

/** The JSON body POSTed to /api/ai-crawls. Exported for tests. */
export function buildEventPayload(
  request: MinimalRequest,
  config: ConvrsBotConfig,
  decision: TrackDecision,
  statusInfo?: StatusInfo
) {
  if (!decision.bot || !decision.url) throw new Error("buildEventPayload requires a tracked decision");

  const reported = new URL(sanitizeUrl(decision.url, config.keepQueryParams));
  if (config.domain) {
    // An explicit domain override is applied to the URL itself so the host
    // we report and the host the server authorizes are always the same.
    reported.hostname = config.domain.replace(/:\d+$/, "").trim().toLowerCase();
    reported.port = "";
  }

  const statusCode =
    normalizeStatusCode(statusInfo?.statusCode) ??
    normalizeStatusCode(statusInfo?.response?.status) ??
    normalizeStatusCode(statusInfo?.response?.statusCode);

  const geo = resolveEdgeGeo(request, config);

  // Raw signals only. Provider, crawler, category, match type and
  // verification are decided by Convrs from these, never by the SDK, so
  // crawler definitions can change server-side without an SDK upgrade.
  return {
    siteId: resolveSiteId(config),
    eventId: decision.eventId,
    domain: reported.hostname,
    url: reported.href,
    referrer: sanitizeReferrer(readHeader(request, "referer") ?? readHeader(request, "referrer")),
    method: request.method.toUpperCase(),
    sdkVersion: SDK_VERSION,
    ...(geo ? { geo } : {}),
    bot: {
      userAgent: (readHeader(request, "user-agent") ?? "").slice(0, MAX_USER_AGENT_LENGTH),
      ip: resolveClientIp(request, config),
      ...(statusCode !== undefined ? { statusCode } : {}),
      source: "server-sdk",
    },
  };
}

/**
 * Sends one event. Never throws and never retries: a retry could double
 * count a crawler visit, and the customer's response must not depend on us.
 */
export async function sendBotEvent(
  request: MinimalRequest,
  config: ConvrsBotConfig,
  decision: TrackDecision = decideWhetherToTrack(request, config),
  statusInfo?: StatusInfo
): Promise<TrackOutcome> {
  if (!decision.shouldTrack || !decision.bot || !decision.url) {
    return { sent: false, bot: decision.bot, skipReason: decision.skipReason };
  }

  const fetchImpl = config.fetch ?? (typeof fetch === "undefined" ? undefined : (fetch as never));
  if (!fetchImpl) {
    return { sent: false, bot: decision.bot, error: "no_fetch_available" };
  }

  try {
    const body = JSON.stringify(buildEventPayload(request, config, decision, statusInfo));
    const response = await callWithTimeout(
      fetchImpl,
      config.endpoint ?? DEFAULT_ENDPOINT,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(config.authToken ? { Authorization: `Bearer ${config.authToken}` } : {}),
        },
        keepalive: true,
        body,
      },
      config.timeoutMs ?? DEFAULT_TIMEOUT_MS
    );

    return {
      sent: response.ok,
      bot: decision.bot,
      httpStatus: response.status,
      ...(response.ok ? {} : { error: "send_failed" as const }),
    };
  } catch (err) {
    if (config.debug) {
      // eslint-disable-next-line no-console
      console.warn("[convrs] failed to send bot tracking event", err);
    }
    return { sent: false, bot: decision.bot, error: "send_failed" };
  }
}

async function callWithTimeout(
  fetchImpl: NonNullable<ConvrsBotConfig["fetch"]>,
  url: string,
  init: Parameters<NonNullable<ConvrsBotConfig["fetch"]>>[1],
  timeoutMs: number
) {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0 || typeof AbortController === "undefined") {
    return fetchImpl(url, init);
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetchImpl(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}
