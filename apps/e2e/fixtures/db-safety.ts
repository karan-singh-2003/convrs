import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import { WEB_DIR, ALLOWED_DB_HOSTS } from "./env";

/**
 * Refuses to let the e2e suite (schema push, truncate, seed) run against
 * anything but an explicitly allowlisted, verifiably-not-the-real-dev
 * database. This is the one safety net standing between this suite and
 * accidentally wiping the shared dev database — treat changes here with
 * that in mind.
 *
 * Default-deny: an empty/missing E2E_ALLOWED_DB_HOSTS refuses to run at all,
 * rather than falling back to "anything not explicitly blocked."
 */
export function assertDisposableTestDatabase(rawUrl: string | undefined): void {
  if (!rawUrl) {
    throw new Error(
      "[db-safety] DATABASE_URL is not set for the e2e process — refusing to run."
    );
  }

  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error(`[db-safety] DATABASE_URL is not a valid URL: ${rawUrl}`);
  }

  // 1. Must never be byte-identical to the app's real dev DATABASE_URL.
  const realDevUrl = readRealDevDatabaseUrl();
  if (realDevUrl && normalize(rawUrl) === normalize(realDevUrl)) {
    throw new Error(
      "[db-safety] DATABASE_URL is byte-identical to apps/web/.env's real dev DATABASE_URL. " +
        "Refusing to run the e2e suite (schema push + full truncate) against it."
    );
  }

  // 2. Must never point at the real dev DB's host, even under a different
  // user/db name on that same endpoint.
  if (realDevUrl) {
    const realHost = new URL(realDevUrl).host;
    if (url.host === realHost) {
      throw new Error(
        `[db-safety] DATABASE_URL host (${url.host}) matches the real dev database's host. Refusing to run.`
      );
    }
  }

  // 3. Must be explicitly allowlisted. No allowlist => no run.
  const allowed = (ALLOWED_DB_HOSTS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  if (allowed.length === 0) {
    throw new Error(
      "[db-safety] E2E_ALLOWED_DB_HOSTS is not set — refusing to run against an unverified database. " +
        "Set it (apps/e2e/.env.e2e) to the exact host of your disposable test database."
    );
  }

  if (!allowed.includes(url.host)) {
    throw new Error(
      `[db-safety] Database host "${url.host}" is not in E2E_ALLOWED_DB_HOSTS (${allowed.join(", ")}). Refusing to run.`
    );
  }

  // 4. Defense-in-depth: reject anything whose database/user name looks like
  // it's trying to be a production identifier, even if it somehow cleared
  // the checks above (e.g. a copy-pasted allowlist entry).
  const suspicious = ["prod", "production"];
  const dbIdentifiers = `${url.pathname} ${url.username}`.toLowerCase();
  for (const bad of suspicious) {
    if (dbIdentifiers.includes(bad)) {
      throw new Error(
        `[db-safety] DATABASE_URL's database/user name contains "${bad}" — refusing to run against what looks like a production identifier.`
      );
    }
  }
}

function normalize(url: string): string {
  return url.trim().toLowerCase();
}

function readRealDevDatabaseUrl(): string | undefined {
  const envPath = path.join(WEB_DIR, ".env");
  if (!fs.existsSync(envPath)) return undefined;
  const parsed = dotenv.parse(fs.readFileSync(envPath, "utf8"));
  return parsed.DATABASE_URL;
}
