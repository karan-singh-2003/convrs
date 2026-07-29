import { Redis } from "@upstash/redis";

const redis = Redis.fromEnv();

/**
 * Simple fixed-window token bucket. Returns true if the call is allowed
 * (and decrements the budget), false if the budget is exhausted for the
 * current window. Callers should re-queue/skip rather than error when
 * this returns false.
 */
export async function tryConsumeQuota({
  key,
  limit,
  windowSeconds,
}: {
  key: string;
  limit: number;
  windowSeconds: number;
}): Promise<boolean> {
  const redisKey = `ratelimit:${key}`;
  const current = await redis.incr(redisKey);

  if (current === 1) {
    await redis.expire(redisKey, windowSeconds);
  }

  return current <= limit;
}

/** Tracks cumulative monthly usage against a hard API-tier cap. */
export async function trackMonthlyUsage({
  key,
  cap,
}: {
  key: string;
  cap: number;
}): Promise<{ withinCap: boolean; used: number }> {
  const month = new Date().toISOString().slice(0, 7); // "2026-07"
  const redisKey = `monthly-usage:${key}:${month}`;
  const used = await redis.incr(redisKey);

  if (used === 1) {
    await redis.expire(redisKey, 60 * 60 * 24 * 40); // ~40 days, auto-cleans
  }

  return { withinCap: used <= cap, used };
}