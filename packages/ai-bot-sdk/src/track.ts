import { decideWhetherToTrack } from "./decide";
import { sendBotEvent } from "./send";
import type {
  ConvrsBotConfig,
  MinimalRequest,
  ResponseLike,
  TrackDecision,
  TrackOutcome,
  WaitUntilTarget,
} from "./types";

/** Context objects accepted where a runtime context goes: NextFetchEvent,
 * Cloudflare ExecutionContext / Pages context, Hono's executionCtx, a bare
 * waitUntil function, or nothing at all. */
export type TrackingContext = WaitUntilTarget | null | undefined;

const NOT_TRACKED: TrackOutcome = { sent: false };

function safeDecide(request: MinimalRequest, config: ConvrsBotConfig): TrackDecision | null {
  try {
    return decideWhetherToTrack(request, config);
  } catch (err) {
    if (config?.debug) {
      // eslint-disable-next-line no-console
      console.warn("[convrs] could not inspect request for bot tracking", err);
    }
    return null;
  }
}

/**
 * Schedules the send on `waitUntil` when the runtime provides one (Vercel,
 * Next.js proxy/middleware, Cloudflare, Hono) and resolves immediately;
 * otherwise returns the in-flight send. Never throws and never rejects, so
 * callers can safely skip `await`.
 */
function dispatch(
  request: MinimalRequest,
  config: ConvrsBotConfig,
  decision: TrackDecision,
  context: TrackingContext,
  response?: ResponseLike
): Promise<TrackOutcome> {
  if (!decision.shouldTrack) {
    return Promise.resolve({ sent: false, bot: decision.bot, skipReason: decision.skipReason });
  }

  const task = sendBotEvent(request, config, decision, response ? { response } : undefined).catch(
    (): TrackOutcome => ({ sent: false, bot: decision.bot, error: "send_failed" })
  );

  const waitUntilFn = extractWaitUntil(context);
  if (waitUntilFn) {
    try {
      waitUntilFn(task);
      return Promise.resolve({ sent: false, queued: true, bot: decision.bot });
    } catch {
      // A context whose waitUntil throws (e.g. called after the response
      // completed) falls back to the plain in-flight promise.
    }
  }
  return task;
}

/**
 * Request-only tracking for proxies/middleware that run before the response
 * exists. The status code is not known here, so none is sent.
 */
export function trackBotRequest(
  request: MinimalRequest,
  config: ConvrsBotConfig,
  waitUntilTarget?: TrackingContext
): Promise<TrackOutcome> {
  const decision = safeDecide(request, config);
  if (!decision) return Promise.resolve(NOT_TRACKED);
  return dispatch(request, config, decision, waitUntilTarget);
}

/**
 * Response-aware tracking: call after your handler produced a response so
 * the event carries the real HTTP status code.
 */
export function trackBotResponse(
  request: MinimalRequest,
  response: ResponseLike,
  config: ConvrsBotConfig,
  waitUntilTarget?: TrackingContext
): Promise<TrackOutcome> {
  const decision = safeDecide(request, config);
  if (!decision) return Promise.resolve(NOT_TRACKED);
  return dispatch(request, config, decision, waitUntilTarget, response);
}

/**
 * Wraps a fetch-style handler (`(request, ...args) => Response`) so every
 * response it produces is checked and, when it came from a crawler, reported
 * with its exact status code. A `waitUntil` context among the extra
 * arguments (Cloudflare's `ctx`, Next's `event`) is used automatically.
 */
export function withBotTracking<
  Req extends MinimalRequest,
  Res extends ResponseLike,
  Args extends unknown[]
>(handler: (request: Req, ...args: Args) => Promise<Res> | Res, config: ConvrsBotConfig) {
  return async function convrsTrackedHandler(request: Req, ...args: Args): Promise<Res> {
    const response = await handler(request, ...args);
    void trackBotResponse(request, response, config, findWaitUntilArg(args));
    return response;
  };
}

/** Framework-agnostic middleware factory for `(request, context)` signatures. */
export function createBotTrackingMiddleware(config: ConvrsBotConfig) {
  return function convrsMiddleware(request: MinimalRequest, context?: TrackingContext) {
    return trackBotRequest(request, config, context);
  };
}

// ── Request-first API: (request, context, config) ─────────────────────────────

/**
 * Next.js proxy/middleware, Cloudflare Pages, or any request-only hook:
 *
 *   export function proxy(request: NextRequest, event: NextFetchEvent) {
 *     trackAICrawlerRequest(request, event, { websiteId, authToken });
 *     return NextResponse.next();
 *   }
 *
 * Do not await it. The status code is unknown at this point and not sent.
 */
export function trackAICrawlerRequest(
  request: MinimalRequest,
  context: TrackingContext,
  config: ConvrsBotConfig
): Promise<TrackOutcome> {
  return trackBotRequest(request, config, context);
}

/**
 * Generic request/response handlers and Hono:
 *
 *   const response = await handler(request);
 *   trackAICrawlerResponse(request, response, context, { websiteId });
 *   return response;
 */
export function trackAICrawlerResponse(
  request: MinimalRequest,
  response: ResponseLike,
  context: TrackingContext,
  config: ConvrsBotConfig
): Promise<TrackOutcome> {
  return trackBotResponse(request, response, config, context);
}

/** Cloudflare Workers: `export default { fetch: withAICrawlerTracking(handler, { websiteId }) }`. */
export const withAICrawlerTracking = withBotTracking;

function extractWaitUntil(target?: TrackingContext): ((p: Promise<unknown>) => void) | undefined {
  if (!target) return undefined;
  if (typeof target === "function") return target;
  if (typeof target === "object" && typeof target.waitUntil === "function") {
    return target.waitUntil.bind(target);
  }
  return undefined;
}

function findWaitUntilArg(args: unknown[]): WaitUntilTarget | undefined {
  return args.find((arg): arg is WaitUntilTarget => {
    if (typeof arg === "function") return true;
    return Boolean(
      arg &&
        typeof arg === "object" &&
        "waitUntil" in (arg as Record<string, unknown>) &&
        typeof (arg as { waitUntil?: unknown }).waitUntil === "function"
    );
  }) as WaitUntilTarget | undefined;
}

export type { TrackDecision };
