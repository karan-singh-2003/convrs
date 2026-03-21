/**
 * lib/redis.ts
 *
 * Wraps ioredis with typed helpers used by the application.
 *
 * Three logical namespaces:
 *   session:<sessionId>   – session metadata hash (TTL = SESSION_TTL_SECONDS)
 *   ratelimit:<ip>        – sliding-window counter (managed by @fastify/rate-limit)
 *   buffer:<workspaceId>  – temporary JSON list of raw events pending CH insert
 */

import Redis from "ioredis";
import { env } from "./env";
import type { FastifyBaseLogger } from "fastify";

// ── Key builders ─────────────────────────────────────────────────────────────

export const Keys = {
  session: (sessionId: string) => `session:${sessionId}`,
  buffer:  (workspaceId: string) => `buffer:${workspaceId}`,
} as const;

// ── Session value shape stored in Redis ──────────────────────────────────────

export interface RedisSession {
  workspaceId: string;
  sessionId: string;
  firstSeen: number;   // epoch ms
  lastSeen: number;    // epoch ms
  entryUrl: string;
  referrer?: string;
  hostname?: string;
  screen?: string;
  language?: string;
  pageviewCount: number;
  eventCount: number;
}

// ── Singleton ─────────────────────────────────────────────────────────────────

let _redis: Redis | null = null;

export function getRedisClient(): Redis {
  if (_redis) return _redis;

  _redis = new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: 3,
    enableReadyCheck: true,
    lazyConnect: false,
    // Exponential back-off reconnect
    retryStrategy: (times) => Math.min(times * 100, 3_000),
    reconnectOnError: (err) => {
      const targetErrors = ["READONLY", "ECONNRESET", "ETIMEDOUT"];
      return targetErrors.some((e) => err.message.includes(e));
    },
  });

  return _redis;
}

/**
 * Waits for Redis to be ready; throws after a timeout so the server fails fast.
 */
export async function waitForRedis(logger: FastifyBaseLogger, timeoutMs = 10_000): Promise<void> {
  const redis = getRedisClient();

  if (redis.status === "ready") return;

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Redis did not connect within ${timeoutMs} ms`));
    }, timeoutMs);

    redis.once("ready", () => {
      clearTimeout(timer);
      logger.info("Redis connected.");
      resolve();
    });

    redis.once("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

export async function closeRedis(): Promise<void> {
  if (_redis) {
    await _redis.quit();
    _redis = null;
  }
}

// ── Session helpers ───────────────────────────────────────────────────────────

/**
 * Load a session from Redis. Returns null if it doesn't exist (expired or new).
 */
export async function getSession(sessionId: string): Promise<RedisSession | null> {
  const redis = getRedisClient();
  const raw = await redis.get(Keys.session(sessionId));
  if (!raw) return null;
  return JSON.parse(raw) as RedisSession;
}

/**
 * Upsert a session, sliding its TTL on every call.
 */
export async function upsertSession(session: RedisSession): Promise<void> {
  const redis = getRedisClient();
  await redis.set(
    Keys.session(session.sessionId),
    JSON.stringify(session),
    "EX",
    env.SESSION_TTL_SECONDS,
  );
}

// ── Event buffer helpers ──────────────────────────────────────────────────────

/**
 * Push serialised events onto a per-workspace Redis list.
 * Returns the new list length so callers can decide to flush early.
 */
export async function bufferEvents(workspaceId: string, events: unknown[]): Promise<number> {
  if (events.length === 0) return 0;
  const redis = getRedisClient();
  const key   = Keys.buffer(workspaceId);
  const serialised = events.map((e) => JSON.stringify(e));
  const len = await redis.rpush(key, ...serialised);
  // Give the buffer a TTL so stale data doesn't accumulate if the flush loop dies
  await redis.expire(key, 300); // 5 minutes
  return len;
}

/**
 * Atomically drain the buffer for a workspace.
 * Uses a Lua script so nothing is lost between LRANGE and DEL.
 */
const drainScript = `
local key    = KEYS[1]
local values = redis.call('LRANGE', key, 0, -1)
redis.call('DEL', key)
return values
`;

export async function drainBuffer(workspaceId: string): Promise<unknown[]> {
  const redis  = getRedisClient();
  const result = await redis.eval(drainScript, 1, Keys.buffer(workspaceId)) as string[];
  return result.map((s) => JSON.parse(s));
}

/**
 * Returns the current buffer depth for a workspace without draining it.
 */
export async function bufferLength(workspaceId: string): Promise<number> {
  const redis = getRedisClient();
  return redis.llen(Keys.buffer(workspaceId));
}