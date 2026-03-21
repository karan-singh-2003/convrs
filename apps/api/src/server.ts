/**
 * server.ts
 *
 * Bootstraps the Fastify server:
 *   1. Registers global plugins (helmet, cors, rate-limit, logging).
 *   2. Connects to Redis and runs ClickHouse migrations.
 *   3. Registers route handlers.
 *   4. Starts the flush loop.
 *   5. Handles SIGTERM / SIGINT for graceful shutdown.
 */

import Fastify from "fastify";
import helmet from "@fastify/helmet";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";

import { env } from "../src/lib/env";
import { migrateClickHouse, closeClickHouse } from "../src/lib/clickhouse";
import { getRedisClient, waitForRedis, closeRedis } from "../src/lib/redis";
import { trackRoutes } from "../src/routes/track";
import { startFlushLoop, stopFlushLoop } from "../src/services/eventService";
import { trackerRoute } from "./routes/tracker";

// ── Server factory (exported for testing) ────────────────────────────────────

export async function buildServer() {
  const server = Fastify({
    logger: {
      level: env.NODE_ENV === "production" ? "info" : "debug",
      ...(env.NODE_ENV !== "production" && {
        transport: {
          target: "pino-pretty",
          options: {
            translateTime: "HH:MM:ss",
            ignore: "pid,hostname",
          },
        },
      }),
    },
    // Trust the first hop of X-Forwarded-For (set this to the number of
    // proxies in front of the server in production)
    trustProxy: 1,
    // Request ID for distributed tracing
    genReqId: () => crypto.randomUUID(),
  });

  // ── Security headers ────────────────────────────────────────────────────
  await server.register(helmet, {
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: false,
  });

  // ── CORS ────────────────────────────────────────────────────────────────
  // Allow any origin — the tracker is embedded on third-party sites.
  // The domain restriction is enforced at the application layer (config.allowedDomains).
  await server.register(cors, {
    origin: true,
    methods: ["POST", "GET", "OPTIONS"],
    credentials: true,
  });

  // ── Rate limiting ───────────────────────────────────────────────────────
  // Uses Redis as the store so limits are shared across multiple API instances.
  await server.register(rateLimit, {
    global: true,
    max: env.RATE_LIMIT_MAX,
    timeWindow: env.RATE_LIMIT_WINDOW_MS,
    redis: getRedisClient(),
    // Key by IP address
    keyGenerator: (request) => {
      return (
        (request.headers["x-forwarded-for"] as string | undefined)
          ?.split(",")[0]
          ?.trim() ?? request.ip
      );
    },
    errorResponseBuilder: (_req, context) => ({
      ok: false,
      error: "Rate limit exceeded",
      details: {
        limit: context.max,
        remaining: (context as any).remaining,
        resetAt: new Date(Date.now() + context.ttl).toISOString(),
      },
    }),
  });

  // ── Routes ──────────────────────────────────────────────────────────────
  await server.register(trackRoutes);
  await server.register(trackerRoute);

  // ── Global error handler ────────────────────────────────────────────────
  server.setErrorHandler((error, request, reply) => {
    request.log.error({ err: error }, "Unhandled error");

    const statusCode = error.statusCode ?? 500;
    return reply.status(statusCode).send({
      ok: false,
      error: statusCode === 500 ? "Internal server error" : error.message,
    });
  });

  // ── Not-found handler ───────────────────────────────────────────────────
  server.setNotFoundHandler((_request, reply) => {
    return reply.status(404).send({ ok: false, error: "Not found" });
  });

  return server;
}

// ── Entry point ───────────────────────────────────────────────────────────────

async function main() {
  const server = await buildServer();
  const logger = server.log;

  // ── Infrastructure warm-up ────────────────────────────────────────────
  await waitForRedis(logger);
  await migrateClickHouse(logger);

  // ── Start background flush loop ───────────────────────────────────────
  startFlushLoop(logger);

  // ── Listen ────────────────────────────────────────────────────────────
  try {
    await server.listen({ port: env.PORT, host: env.HOST });
    logger.info(`🚀  Analytics API listening on ${env.HOST}:${env.PORT}`);
  } catch (err) {
    logger.error(err, "Failed to start server");
    process.exit(1);
  }

  // ── Graceful shutdown ─────────────────────────────────────────────────
  const shutdown = async (signal: string) => {
    logger.info({ signal }, "Shutdown signal received.");

    try {
      // 1. Stop accepting new requests
      await server.close();

      // 2. Flush remaining buffered events before closing connections
      await stopFlushLoop(logger);

      // 3. Close infrastructure connections
      await closeClickHouse();
      await closeRedis();

      logger.info("Graceful shutdown complete.");
      process.exit(0);
    } catch (err) {
      logger.error(err, "Error during shutdown.");
      process.exit(1);
    }
  };

  process.once("SIGTERM", () => shutdown("SIGTERM"));
  process.once("SIGINT", () => shutdown("SIGINT"));
}

main();
