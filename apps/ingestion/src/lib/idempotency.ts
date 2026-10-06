import { redisWithTimeout } from "./redis.js";

/** 24h — matches register-tracked-event.ts's cache window. */
export const IDEMPOTENCY_TTL_SECONDS = 60 * 60 * 24;

export type IdempotencyClaim = "new" | "duplicate";

interface RedisLike {
  set(key: string, value: string, opts: { nx: true; ex: number }): Promise<unknown>;
  del(key: string): Promise<unknown>;
}

/**
 * Atomically marks `key` as seen (SET NX EX). Fails open: when Redis is
 * unreachable the event is treated as new, so a Redis blip never blocks
 * tracking — same posture as the session-revocation check in apps/web.
 */
export async function claimIdempotencyKey(
  key: string,
  redis: RedisLike = redisWithTimeout as unknown as RedisLike
): Promise<IdempotencyClaim> {
  try {
    const result = await redis.set(key, "1", { nx: true, ex: IDEMPOTENCY_TTL_SECONDS });
    return result === null ? "duplicate" : "new";
  } catch (error) {
    console.error("[idempotency] check failed, proceeding", { key, error });
    return "new";
  }
}

/**
 * Forget a claimed key when the event it guarded was not stored, so a
 * legitimate retry of the same event is not dropped as a duplicate.
 */
export async function releaseIdempotencyKey(
  key: string,
  redis: RedisLike = redisWithTimeout as unknown as RedisLike
): Promise<void> {
  try {
    await redis.del(key);
  } catch (error) {
    console.error("[idempotency] release failed", { key, error });
  }
}
