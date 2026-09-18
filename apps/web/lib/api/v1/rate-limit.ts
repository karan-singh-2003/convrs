import { redis } from "@/lib/upstash/redis";

/**
 * Fixed-window rate limit for /api/v1/* requests, keyed per token so one
 * customer's script can't starve another. Same incr+expire pattern as
 * lib/social/rate-limiter.ts, reusing the shared redis client instead of a
 * second Redis connection.
 */
const WINDOW_SECONDS = 60;
const DEFAULT_LIMIT_PER_MINUTE = 60;

export async function checkApiRateLimit(
  tokenId: string,
  limit: number = DEFAULT_LIMIT_PER_MINUTE
): Promise<{
  allowed: boolean;
  limit: number;
  remaining: number;
  retryAfter: number;
}> {
  const nowSeconds = Math.floor(Date.now() / 1000);
  const window = Math.floor(nowSeconds / WINDOW_SECONDS);
  const key = `api:v1:ratelimit:${tokenId}:${window}`;

  const count = await redis.incr(key);
  if (count === 1) {
    await redis.expire(key, WINDOW_SECONDS);
  }

  const retryAfter = WINDOW_SECONDS - (nowSeconds % WINDOW_SECONDS);

  return {
    allowed: count <= limit,
    limit,
    remaining: Math.max(0, limit - count),
    retryAfter,
  };
}

export const API_RATE_LIMIT_WINDOW_SECONDS = WINDOW_SECONDS;
export const API_RATE_LIMIT_DEFAULT = DEFAULT_LIMIT_PER_MINUTE;
