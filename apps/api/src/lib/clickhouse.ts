/**
 * lib/clickhouse.ts
 *
 * Initialises the @clickhouse/client and ensures the analytics tables exist.
 *
 * Table design:
 *   - MergeTree engine ordered by (workspace_id, toStartOfHour(timestamp), event_type)
 *     so time-range queries per workspace are fast.
 *   - TTL of 90 days keeps storage bounded; adjust to taste.
 *   - Columns are intentionally nullable where the tracker may omit them so
 *     INSERT payloads never fail due to missing optional fields.
 */

import { createClient, type ClickHouseClient } from "@clickhouse/client";
import { env } from "./env.js";
import type { FastifyBaseLogger } from "fastify";

// ── DDL ──────────────────────────────────────────────────────────────────────

const CREATE_DB_SQL = `CREATE DATABASE IF NOT EXISTS ${env.CLICKHOUSE_DB}`;

const CREATE_EVENTS_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS ${env.CLICKHOUSE_DB}.events
(
    id              UUID            DEFAULT generateUUIDv4(),
    workspace_id    LowCardinality(String),
    session_id      String,
    visitor_id      String,
    event_type      LowCardinality(String),
    url             String,
    referrer        Nullable(String),
    hostname        Nullable(String),
    page_title      Nullable(String),
    screen          Nullable(String),
    language        LowCardinality(Nullable(String)),
    props           Map(String, String),  -- custom event properties (k/v)
    ip_hash         String,               -- SHA-256 of IP, never raw IP
    user_agent      Nullable(String),
    -- Server-side enrichment (UA + geo) ─────────────────────────────────────
    browser         LowCardinality(Nullable(String)),
    os              LowCardinality(Nullable(String)),
    device          LowCardinality(Nullable(String)),
    country         LowCardinality(Nullable(String)),
    region          LowCardinality(Nullable(String)),
    city            LowCardinality(Nullable(String)),
    timestamp       DateTime64(3, 'UTC'),
    ingested_at     DateTime64(3, 'UTC') DEFAULT now64()
)
ENGINE = MergeTree()
PARTITION BY toYYYYMM(timestamp)
ORDER BY (workspace_id, toStartOfHour(timestamp), event_type)
TTL toDateTime(timestamp) + INTERVAL 90 DAY
SETTINGS index_granularity = 8192;
`;

const CREATE_SESSIONS_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS ${env.CLICKHOUSE_DB}.sessions
(
    session_id      String,
    workspace_id    LowCardinality(String),
    first_seen      DateTime64(3, 'UTC'),
    last_seen       DateTime64(3, 'UTC'),
    entry_url       String,
    referrer        Nullable(String),
    hostname        Nullable(String),
    screen          Nullable(String),
    language        LowCardinality(Nullable(String)),
    pageview_count  UInt32              DEFAULT 1,
    event_count     UInt32              DEFAULT 1
)
ENGINE = ReplacingMergeTree(last_seen)
PARTITION BY toYYYYMM(first_seen)
ORDER BY (workspace_id, session_id)
TTL toDateTime(first_seen) + INTERVAL 90 DAY
SETTINGS index_granularity = 8192;
`;

// ── Factory ──────────────────────────────────────────────────────────────────

let _client: ClickHouseClient | null = null;

/**
 * Returns (and lazily creates) the singleton ClickHouse client.
 */
export function getClickHouseClient(): ClickHouseClient {
  if (_client) return _client;

  _client = createClient({
    host: env.CLICKHOUSE_URL,
    username: env.CLICKHOUSE_USER,
    password: env.CLICKHOUSE_PASSWORD,
    database: env.CLICKHOUSE_DB,
    request_timeout: 30_000,
    compression: {
      request: true, // compress INSERT bodies
      response: true,
    },
    clickhouse_settings: {
      // Allows inserts to proceed even if a replica is temporarily down
      insert_quorum_parallel: 0,
      // Async inserts let ClickHouse batch on its side too
      async_insert: 1,
      wait_for_async_insert: 1,
    },
  });

  return _client;
}

/**
 * Creates the database and tables if they don't already exist.
 * Called once at server startup before accepting traffic.
 */
export async function migrateClickHouse(
  logger: FastifyBaseLogger
): Promise<void> {
  const client = getClickHouseClient();

  logger.info("Running ClickHouse migrations…");

  // createClient sets the default DB, but CREATE DATABASE must be run without it
  const rawClient = createClient({
    host: env.CLICKHOUSE_URL,
    username: env.CLICKHOUSE_USER,
    password: env.CLICKHOUSE_PASSWORD,
  });

  try {
    await rawClient.exec({ query: CREATE_DB_SQL });
    await client.exec({ query: CREATE_EVENTS_TABLE_SQL });
    await client.exec({ query: CREATE_SESSIONS_TABLE_SQL });
    logger.info("ClickHouse migrations complete.");
  } finally {
    await rawClient.close();
  }
}

/**
 * Gracefully closes the ClickHouse client.
 */
export async function closeClickHouse(): Promise<void> {
  if (_client) {
    await _client.close();
    _client = null;
  }
}
