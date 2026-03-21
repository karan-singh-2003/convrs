/**
 * lib/env.ts
 *
 * Validates all required environment variables at startup.
 * Fail-fast: the server will not start if any required value is missing.
 */

import { z } from "zod";

const envSchema = z.object({
  // Server
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  PORT: z.coerce.number().default(3000),
  HOST: z.string().default("0.0.0.0"),

  // ClickHouse
  CLICKHOUSE_URL: z.string().url().default("http://localhost:8123"),
  CLICKHOUSE_DB: z.string().default("analytics"),
  CLICKHOUSE_USER: z.string().default("default"),
  CLICKHOUSE_PASSWORD: z.string().default(""),

  // Redis
  REDIS_URL: z.string().default("redis://localhost:6379"),

  // Rate limiting
  RATE_LIMIT_MAX: z.coerce.number().default(100), // requests per window
  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(60_000), // 1 minute

  // Event buffering
  BUFFER_FLUSH_INTERVAL_MS: z.coerce.number().default(1_000), // flush every 5 s
  BUFFER_MAX_SIZE: z.coerce.number().default(500), // flush at 500 events

  // Session TTL
  SESSION_TTL_SECONDS: z.coerce.number().default(1_800), // 30 minutes
});

export type Env = z.infer<typeof envSchema>;

function loadEnv(): Env {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    console.error("Invalid environment variables:");
    console.error(result.error.flatten().fieldErrors);
    process.exit(1);
  }

  if (!result.success) {
    process.exit(1);
  }

  return result.data;
}

export const env = loadEnv();
