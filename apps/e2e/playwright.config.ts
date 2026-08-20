import { defineConfig, devices } from "@playwright/test";
import {
  WEB_DIR,
  INGEST_DIR,
  WEB_PORT,
  INGEST_PORT,
  WEB_BASE_URL,
  webServerEnv,
  ingestServerEnv,
} from "./fixtures/env";

export default defineConfig({
  testDir: "./tests",
  timeout: 45_000,
  // Bounds the whole run (globalSetup + all tests + globalTeardown) — without
  // this, a stalled DB connection or similar inside globalSetup hangs forever
  // instead of failing loudly (webServer boot already has its own timeouts
  // below, but globalSetup previously had none).
  globalTimeout: 15 * 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  // Only one worker per file for suites with a shared-mutable resource; most
  // suites here seed their own throwaway data per test, so cross-file
  // parallelism is safe. See individual spec files for anything narrower.
  reporter: [["list"], ["html", { open: "never" }]],
  globalSetup: "./global-setup.ts",
  globalTeardown: "./global-teardown.ts",
  // Workspace packages (@repo/analytics, @repo/email, ...) are pnpm-symlinked
  // into node_modules, so their real path never contains "node_modules" and
  // Playwright's transform step otherwise tries to Babel-transpile their
  // prebuilt dist/*.mjs bundles as if they were test source — which hangs
  // (verified: packages/analytics/dist/index.mjs and packages/email/dist/index.mjs
  // both stall indefinitely under Playwright's ESM loader, while loading fine
  // under plain tsx and under Playwright once excluded here). Treat them as
  // opaque prebuilt output instead.
  build: {
    external: ["**/packages/*/dist/**"],
  },

  use: {
    baseURL: WEB_BASE_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },

  projects: [
    {
      name: "setup",
      testMatch: /tests\/setup\/.*\.setup\.ts/,
    },
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
      dependencies: ["setup"],
      testIgnore: /.*\.tinybird\.spec\.ts/,
    },
    {
      // Tinybird-dependent tests (UTM attribution) are isolated into their
      // own project so `playwright test` (the default) never depends on a
      // local Tinybird instance being up — run explicitly via
      // `pnpm test:tinybird` / `playwright test --project=tinybird`.
      name: "tinybird",
      use: { ...devices["Desktop Chrome"] },
      dependencies: ["setup"],
      testMatch: /.*\.tinybird\.spec\.ts/,
    },
  ],

  // Always spawn fresh servers pointed at the disposable DB — never reuse an
  // already-running dev server, which would silently point this suite at
  // whatever database that server was started with (possibly the real dev
  // DB), defeating the whole point of the safety check above.
  webServer: [
    {
      command: `npx next dev --turbopack --port ${WEB_PORT}`,
      cwd: WEB_DIR,
      env: webServerEnv(),
      port: WEB_PORT,
      reuseExistingServer: false,
      timeout: 120_000,
      stdout: "pipe",
      stderr: "pipe",
    },
    {
      command: "npx tsx src/index.ts",
      cwd: INGEST_DIR,
      env: ingestServerEnv(),
      port: INGEST_PORT,
      reuseExistingServer: false,
      timeout: 60_000,
      stdout: "pipe",
      stderr: "pipe",
    },
  ],
});
