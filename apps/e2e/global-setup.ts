import { execFileSync } from "node:child_process";
import { applyFullWebEnvToProcess, REPO_ROOT, DATABASE_URL } from "./fixtures/env";
import { assertDisposableTestDatabase } from "./fixtures/db-safety";

export default async function globalSetup() {
  applyFullWebEnvToProcess();
  assertDisposableTestDatabase(process.env.DATABASE_URL);

  console.log(`[e2e/global-setup] Verified disposable DB host: ${new URL(DATABASE_URL).host}`);

  console.log("[e2e/global-setup] prisma generate...");
  execFileSync("pnpm", ["--filter", "@repo/db", "run", "prisma:generate"], {
    cwd: REPO_ROOT,
    env: process.env,
    stdio: "inherit",
    shell: true,
  });

  console.log("[e2e/global-setup] prisma db push (disposable branch)...");
  execFileSync(
    "pnpm",
    ["--filter", "@repo/db", "exec", "prisma", "db", "push", "--accept-data-loss"],
    {
      cwd: REPO_ROOT,
      env: process.env,
      stdio: "inherit",
      shell: true,
    }
  );

  // Safety check re-asserted immediately before the destructive truncate,
  // in case anything above somehow mutated process.env.DATABASE_URL.
  assertDisposableTestDatabase(process.env.DATABASE_URL);

  // Backstop for a stall that isn't itself a DB call (e.g. a hung dynamic
  // import) and so wouldn't be caught by fixtures/db.ts's per-query timeout.
  // Playwright's own globalTimeout doesn't reliably unblock this — see
  // "Timeouts" in README.md — so this throws a clear error well before that
  // 15-minute outer bound would ever kick in.
  await withGlobalSetupTimeout(async () => {
    const { truncateAllTables } = await import("./fixtures/db");
    console.log("[e2e/global-setup] Truncating disposable branch...");
    await truncateAllTables();

    const { seedBaseline } = await import("./fixtures/seed");
    console.log("[e2e/global-setup] Seeding baseline fixtures...");
    await seedBaseline();
  }, 90_000);

  console.log("[e2e/global-setup] Done.");
}

function withGlobalSetupTimeout(fn: () => Promise<void>, ms: number): Promise<void> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(
        new Error(
          `[e2e/global-setup] Truncate+seed did not complete within ${ms}ms — aborting instead of hanging global-setup.`
        )
      );
    }, ms);
  });
  return Promise.race([fn(), timeout]).finally(() => clearTimeout(timer));
}
