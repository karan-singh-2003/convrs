/**
 * services/eventService.ts
 *
 * Orchestrates the full event ingestion pipeline:
 *
 *   1. Normalise raw tracker events into the DB schema.
 *   2. Push into the per-workspace Redis buffer.
 *   3. Flush the buffer to ClickHouse when it reaches BUFFER_MAX_SIZE or the
 *      periodic flush timer fires.
 *
 * The buffer protects ClickHouse from small, frequent INSERTs which are
 * expensive — batching trades a small latency for much better throughput.
 */

import crypto, { verify } from "crypto";
import { getClickHouseClient } from "../lib/clickhouse.js";
import {
  bufferEvents,
  bufferLength,
  drainBuffer,
  upsertSession,
  getSession,
  type RedisSession,
} from "../lib/redis.js";
import { Enrichment, enrichRequest } from "../lib/enrich.js";
import { env } from "../lib/env.js";
import type { RawEvent, NormalisedEvent } from "../types/events.js";
import type { FastifyBaseLogger } from "fastify";
import { getRedisClient } from "../lib/redis.js";
import { prisma } from "@repo/db";

// ── Normalisation ─────────────────────────────────────────────────────────────

/**
 * Convert a raw tracker event into the flat ClickHouse row shape.
 * The IP is hashed so no raw personal identifier is ever stored.
 */
export function normaliseEvent(
  websiteId: string,
  visitor_id: string,
  session_id: string,
  event: RawEvent,
  clientIp: string,
  userAgent: string | null,
  enrichment: Enrichment
): NormalisedEvent {
  return {
    workspace_id: websiteId,
    visitor_id: visitor_id,
    session_id: session_id,

    event_type: event.type,
    url: event.url,
    referrer: event.referrer ?? null,
    hostname: event.hostname ?? null,
    page_title: event.title ?? null,
    language: event.language ?? null,
    timezone: event.timezone ?? null,
    screen_w: event.screen_w ?? null,
    screen_h: event.screen_h ?? null,
    viewport_w: event.viewport_w ?? null,
    viewport_h: event.viewport_h ?? null,
    event_name: event.event_name ?? null,

    props: event.props ?? {},
    traits: event.traits ?? null,

    ip_hash: crypto.createHash("sha256").update(clientIp).digest("hex"),

    user_agent: userAgent,

    ...enrichment,

    timestamp: new Date(event.timestamp).getTime(),
  };
}

// ── Session upsert ────────────────────────────────────────────────────────────

/**
 * Update (or create) the Redis session for an incoming event.
 * Session data is kept in Redis for fast reads; a ReplacingMergeTree table in
 * ClickHouse holds the durable copy (written as part of the event flush).
 */
export async function touchSession(
  websiteId: string,
  event: RawEvent,
  session_id: string
): Promise<void> {
  const existing = await getSession(session_id);
  const now = new Date(event.timestamp).getTime();

  if (existing) {
    // Update mutable fields only
    const updated: RedisSession = {
      ...existing,
      lastSeen: now,
      pageviewCount:
        existing.pageviewCount + (event.type === "pageview" ? 1 : 0),
      eventCount: existing.eventCount + 1,
    };
    await upsertSession(updated);
  } else {
    const fresh: RedisSession = {
      workspaceId: websiteId,
      sessionId: session_id,
      firstSeen: now,
      lastSeen: now,
      entryUrl: event.url,
      referrer: event.referrer ?? undefined,
      hostname: event.hostname,
      screen:
        event.screen_w && event.screen_h
          ? `${event.screen_w}x${event.screen_h}`
          : undefined,
      language: event.language,
      pageviewCount: event.type === "pageview" ? 1 : 0,
      eventCount: 1,
    };
    await upsertSession(fresh);
  }
}

// ── Buffer + flush ────────────────────────────────────────────────────────────

/**
 * Push normalised events into the Redis buffer and flush to ClickHouse if the
 * buffer exceeds the configured max size.
 */
export async function bufferAndMaybeFlush(
  workspaceId: string,
  events: NormalisedEvent[],
  logger: FastifyBaseLogger
): Promise<void> {
  const len = await bufferEvents(workspaceId, events);

  if (len >= env.BUFFER_MAX_SIZE) {
    logger.info({ workspaceId, len }, "Buffer threshold reached — flushing.");
    await flushWorkspace(workspaceId, logger);
  }
}

/**
 * Drain the Redis buffer for a workspace and INSERT all events into ClickHouse.
 * Safe to call concurrently — the Lua drain script is atomic.
 */
export async function flushWorkspace(
  workspaceId: string,
  logger: FastifyBaseLogger
): Promise<void> {
  const rows = (await drainBuffer(workspaceId)) as NormalisedEvent[];
  if (rows.length === 0) return;

  const client = getClickHouseClient();

  try {
    await client.insert({
      table: `${env.CLICKHOUSE_DB}.events`,
      values: rows,
      format: "JSONEachRow",
    });
    logger.info(
      { workspaceId, count: rows.length },
      "Flushed events to ClickHouse."
    );
  } catch (err) {
    logger.error(
      { workspaceId, count: rows.length, err },
      "ClickHouse insert failed — events dropped."
    );
    // In production you'd push to a dead-letter queue or write to disk here.
  }
}

/**
 * Flush all buffered workspaces.
 * Called by the periodic background timer and on graceful shutdown.
 */
export async function flushAllWorkspaces(
  workspaceIds: string[],
  logger: FastifyBaseLogger
): Promise<void> {
  await Promise.allSettled(
    workspaceIds.map((id) => flushWorkspace(id, logger))
  );
}

// ── Background flush loop ─────────────────────────────────────────────────────

// Track which workspace IDs have received events so we know what to flush.
const activeWorkspaces = new Set<string>();

export function markWorkspaceActive(workspaceId: string): void {
  activeWorkspaces.add(workspaceId);
}

export async function verifyWorkspace(workspaceId: string) {
  const redis = getRedisClient();

  const cached = await redis.get(`workspace:${workspaceId}`);

  if (cached) return true;

  // const exists = await prisma.workspace.findUnique({
  //   where: { id: workspaceId },
  //   select: { id: true },
  // });
  const exists = await prisma.workspace.findUnique({
    where: {
      id: workspaceId,
    },
    select: {
      id: true,
    },
  });
  if (!exists) {
    throw new Error("Workspace not found");
  }

  await redis.set(`workspace:${workspaceId}`, "1", "EX", 3600);

  return true;
}

let _flushTimer: ReturnType<typeof setInterval> | null = null;

/**
 * Starts a periodic timer that flushes all active workspace buffers.
 * Should be called once at server startup.
 */
export function startFlushLoop(logger: FastifyBaseLogger): void {
  if (_flushTimer) return;

  _flushTimer = setInterval(async () => {
    if (activeWorkspaces.size === 0) return;
    const ids = [...activeWorkspaces];
    logger.debug({ count: ids.length }, "Periodic buffer flush.");
    await flushAllWorkspaces(ids, logger);
  }, env.BUFFER_FLUSH_INTERVAL_MS);

  // Don't hold the Node.js event loop open for this timer alone
  _flushTimer.unref();
  logger.info(
    { intervalMs: env.BUFFER_FLUSH_INTERVAL_MS },
    "Buffer flush loop started."
  );
}

/**
 * Flush everything and stop the timer — called during graceful shutdown.
 */
export async function stopFlushLoop(logger: FastifyBaseLogger): Promise<void> {
  if (_flushTimer) {
    clearInterval(_flushTimer);
    _flushTimer = null;
  }
  const ids = [...activeWorkspaces];
  if (ids.length > 0) {
    logger.info({ count: ids.length }, "Final buffer flush on shutdown.");
    await flushAllWorkspaces(ids, logger);
  }
}

// ── Main ingest entry point ───────────────────────────────────────────────────

/**
 * Full ingestion pipeline for one batch request.
 * Returns the number of events accepted.
 */
export async function ingestEvents(
  websiteId: string,
  visitor_id: string,
  session_id: string,
  rawEvents: RawEvent[],
  clientIp: string,
  userAgent: string,
  logger: FastifyBaseLogger
): Promise<number> {
  await verifyWorkspace(websiteId);

  markWorkspaceActive(websiteId);

  // Enrich once per batch — all events share the same client IP and UA
  const enrichment = enrichRequest(clientIp, userAgent);

  // Run session updates and normalisation in parallel per event
  const [normalisedEvents] = await Promise.all([
    Promise.resolve(
      rawEvents.map((e: RawEvent) =>
        normaliseEvent(
          websiteId,
          visitor_id,
          session_id,
          e,
          clientIp,
          userAgent,
          enrichment
        )
      )
    ),
    Promise.allSettled(
      rawEvents.map((e) => touchSession(websiteId, e, session_id))
    ),
  ]);

  await bufferAndMaybeFlush(websiteId, normalisedEvents, logger);

  return normalisedEvents.length;
}
