import { redisWithTimeout } from "./redis.js";

/**
 * Bot Traffic has its own per-workspace daily allowance and never touches
 * Workspace.usage (the plan's event quota). Bot events can be sent with only
 * the public project token, so anyone who reads it from a page could
 * otherwise burn the customer's human-analytics quota; with a separate cap
 * the worst case is that Bot Traffic pauses until the next UTC day while
 * normal tracking keeps working.
 */
export const DEFAULT_BOT_DAILY_CAP = 5_000;

const KEY_TTL_SECONDS = 2 * 24 * 60 * 60;

export function botDailyCap(env: Record<string, string | undefined> = process.env): number {
  const n = Number(env.AI_CRAWLS_DAILY_CAP_PER_WORKSPACE);
  return Number.isInteger(n) && n > 0 ? n : DEFAULT_BOT_DAILY_CAP;
}

export function botCapKey(workspaceId: string, now: Date = new Date()): string {
  return `botcap:${workspaceId}:${now.toISOString().slice(0, 10)}`;
}

/** Seconds until the next UTC midnight, when the cap resets. */
export function secondsUntilUtcMidnight(now: Date = new Date()): number {
  const next = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1);
  return Math.max(1, Math.ceil((next - now.getTime()) / 1000));
}

interface RedisLike {
  incr(key: string): Promise<number>;
  expire(key: string, seconds: number): Promise<unknown>;
  decr(key: string): Promise<unknown>;
}

export type BotCapClaim =
  | { allowed: true; count: number | null; key: string }
  | { allowed: false; cap: number };

/**
 * Counts one bot event against today's cap. Fails open when Redis is
 * unreachable: bot events no longer share the human quota, so an
 * unenforced cap for the duration of a Redis outage cannot affect human
 * analytics (the per-minute rate limits still bound volume).
 */
export async function claimBotDailyCap(
  workspaceId: string,
  {
    cap = botDailyCap(),
    now = new Date(),
    redis = redisWithTimeout as unknown as RedisLike,
  }: { cap?: number; now?: Date; redis?: RedisLike } = {}
): Promise<BotCapClaim> {
  const key = botCapKey(workspaceId, now);
  try {
    const count = await redis.incr(key);
    if (count === 1) await redis.expire(key, KEY_TTL_SECONDS);
    if (count > cap) return { allowed: false, cap };
    return { allowed: true, count, key };
  } catch (error) {
    console.error("[bot-daily-cap] counter unavailable, proceeding", { workspaceId, error });
    return { allowed: true, count: null, key };
  }
}

/** Gives back the unit claimed under `key` when its event was not stored. */
export async function releaseBotDailyCap(
  key: string,
  redis: RedisLike = redisWithTimeout as unknown as RedisLike
): Promise<void> {
  try {
    await redis.decr(key);
  } catch (error) {
    console.error("[bot-daily-cap] release failed", { key, error });
  }
}
