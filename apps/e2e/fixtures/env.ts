import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = path.resolve(__dirname, "../../..");
export const WEB_DIR = path.join(REPO_ROOT, "apps/web");
export const INGEST_DIR = path.join(REPO_ROOT, "apps/ingestion");
export const E2E_DIR = path.join(REPO_ROOT, "apps/e2e");

function parseEnvFile(filePath: string): Record<string, string> {
  if (!fs.existsSync(filePath)) {
    throw new Error(
      `[e2e/env] Expected env file not found: ${filePath} — the e2e suite reuses the app's own real .env for everything except DATABASE_URL/ports, so this file must exist.`
    );
  }
  return dotenv.parse(fs.readFileSync(filePath, "utf8"));
}

const overrides = parseEnvFile(path.join(E2E_DIR, ".env.e2e"));

/**
 * Full env for the apps/web dev server under test: the app's real .env
 * (every OAuth/storage/email/etc var it normally has) with DATABASE_URL,
 * NEXTAUTH_URL, INGEST_API_URL and the port swapped for the disposable
 * e2e-only values. Never touches apps/web/.env itself.
 */
export function webServerEnv(): Record<string, string> {
  const real = parseEnvFile(path.join(WEB_DIR, ".env"));
  return {
    ...real,
    ...overrides,
    PORT: overrides.E2E_WEB_PORT,
  };
}

/**
 * Full env for the apps/ingestion dev server under test: same pattern as
 * webServerEnv() — real .env plus the disposable DATABASE_URL and port.
 */
export function ingestServerEnv(): Record<string, string> {
  const real = parseEnvFile(path.join(INGEST_DIR, ".env"));
  return {
    ...real,
    ...overrides,
    PORT: overrides.E2E_INGEST_PORT,
  };
}

/**
 * Applies the e2e overrides to *this* process's env (global-setup, seed
 * scripts) — must be called before anything imports @repo/db, since
 * packages/db/index.ts reads process.env.DATABASE_URL at module-load time.
 */
export function applyE2EProcessEnv(): void {
  for (const [key, value] of Object.entries(overrides)) {
    process.env[key] = value;
  }
}

/**
 * Applies the FULL merged web env (real apps/web/.env + e2e overrides) to
 * this process — needed by global-setup/seed scripts that import anything
 * from @repo/analytics (e.g. encrypt/decrypt reads ENCRYPTION_KEY at module
 * load time), not just @repo/db.
 */
export function applyFullWebEnvToProcess(): void {
  for (const [key, value] of Object.entries(webServerEnv())) {
    process.env[key] = value;
  }
}

export const WEB_PORT = Number(overrides.E2E_WEB_PORT);
export const INGEST_PORT = Number(overrides.E2E_INGEST_PORT);
export const WEB_BASE_URL = `http://localhost:${WEB_PORT}`;
export const INGEST_BASE_URL = `http://localhost:${INGEST_PORT}`;
export const STRIPE_WEBHOOK_SECRET = overrides.E2E_STRIPE_WEBHOOK_SECRET;
export const DATABASE_URL = overrides.DATABASE_URL;
export const ALLOWED_DB_HOSTS = overrides.E2E_ALLOWED_DB_HOSTS;

const realWebEnv = parseEnvFile(path.join(WEB_DIR, ".env"));
export const TINYBIRDS_API_URL = realWebEnv.TINYBIRDS_API_URL;
export const TINYBIRDS_API_KEY = realWebEnv.TINYBIRDS_API_KEY;
