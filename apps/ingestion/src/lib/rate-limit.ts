/**
 * Fixed-window, in-memory rate limiter for abuse protection on public
 * ingestion endpoints. Per process: with several instances the effective
 * limit is (limit × instances), which is fine for a flood guard. Memory is
 * bounded by `maxKeys`; when full, expired windows are swept first and, if
 * still full, the oldest key is dropped.
 */
export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

export function createRateLimiter({
  limit,
  windowMs,
  maxKeys = 50_000,
  now = Date.now,
}: {
  limit: number;
  windowMs: number;
  maxKeys?: number;
  now?: () => number;
}) {
  const windows = new Map<string, { count: number; resetAt: number }>();

  function evict(at: number) {
    for (const [key, w] of windows) {
      if (w.resetAt <= at) windows.delete(key);
    }
    if (windows.size >= maxKeys) {
      const oldest = windows.keys().next().value;
      if (oldest !== undefined) windows.delete(oldest);
    }
  }

  return function hit(key: string): RateLimitResult {
    const at = now();
    let w = windows.get(key);
    if (!w || w.resetAt <= at) {
      if (!w && windows.size >= maxKeys) evict(at);
      w = { count: 0, resetAt: at + windowMs };
      windows.set(key, w);
    }
    w.count += 1;
    const allowed = w.count <= limit;
    return {
      allowed,
      remaining: Math.max(0, limit - w.count),
      retryAfterSeconds: allowed ? 0 : Math.max(1, Math.ceil((w.resetAt - at) / 1000)),
    };
  };
}

function positiveInt(raw: string | undefined, fallback: number): number {
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : fallback;
}

/** Per calling server (its trusted IP), checked before any DB work. */
export const aiCrawlsCallerLimiter = createRateLimiter({
  limit: positiveInt(process.env.AI_CRAWLS_RATE_LIMIT_PER_IP, 1200),
  windowMs: 60_000,
});

/** Per workspace, checked after authentication. */
export const aiCrawlsWorkspaceLimiter = createRateLimiter({
  limit: positiveInt(process.env.AI_CRAWLS_RATE_LIMIT_PER_WORKSPACE, 6000),
  windowMs: 60_000,
});
