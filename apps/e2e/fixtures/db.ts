import { applyFullWebEnvToProcess } from "./env";
import { assertDisposableTestDatabase } from "./db-safety";

// Order matters: env must be applied and verified BEFORE @repo/db (or
// @repo/analytics) is imported — both read process.env (DATABASE_URL,
// ENCRYPTION_KEY, ...) at module-load time.
applyFullWebEnvToProcess();
assertDisposableTestDatabase(process.env.DATABASE_URL);

const { prisma: basePrisma } = await import("@repo/db");

/**
 * A stalled connection to the disposable Neon branch has been observed to
 * hang indefinitely: the OS socket sits in a pre-connect state and never
 * reaches ESTABLISHED or errors out, so nothing at the driver layer ever
 * rejects. The Neon adapter's own `connectionTimeoutMillis` does NOT
 * reliably catch this — it only guards the TCP handshake once one has
 * actually started, not a stall further upstream (e.g. DNS). Racing every
 * query against a plain setTimeout here doesn't depend on that driver
 * internals being correct: it fires regardless of what state the underlying
 * socket is in, so a stalled call fails loudly in seconds instead of hanging
 * global-setup (and, by extension, the whole suite — see "Timeouts" in
 * README.md for why Playwright's own globalTimeout doesn't already cover this).
 *
 * Deliberately e2e-only: this wraps the already-constructed `@repo/db`
 * client returned by $extends(), rather than changing packages/db/index.ts,
 * so production/app code gets no query timeout and no behavior change.
 */
const E2E_DB_QUERY_TIMEOUT_MS = 20_000;

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      const host = safeHost(process.env.DATABASE_URL);
      reject(
        new Error(
          `[e2e/db] "${label}" did not complete within ${ms}ms — the disposable Neon branch connection (${host}) likely stalled. Aborting instead of hanging global-setup.`
        )
      );
    }, ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

function safeHost(rawUrl: string | undefined): string {
  if (!rawUrl) return "<unset DATABASE_URL>";
  try {
    return new URL(rawUrl).host;
  } catch {
    return "<unparseable DATABASE_URL>";
  }
}

export const prisma = basePrisma.$extends({
  name: "e2e-query-timeout",
  query: {
    $allOperations({ model, operation, args, query }) {
      const label = model ? `${model}.${operation}` : operation;
      return withTimeout(query(args), E2E_DB_QUERY_TIMEOUT_MS, label);
    },
  },
});

/**
 * Wipes every table in the public schema except Prisma's own migration
 * ledger. Safe here specifically because assertDisposableTestDatabase()
 * above already refused to run unless DATABASE_URL is the allowlisted
 * disposable branch — do not reuse this helper outside apps/e2e.
 */
export async function truncateAllTables(): Promise<void> {
  const tables = await prisma.$queryRawUnsafe<{ tablename: string }[]>(
    `SELECT tablename::text FROM pg_tables WHERE schemaname = 'public' AND tablename != '_prisma_migrations'`
  );

  if (tables.length === 0) return;

  const names = tables.map((t) => `"public"."${t.tablename}"`).join(", ");
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${names} RESTART IDENTITY CASCADE`);
}
