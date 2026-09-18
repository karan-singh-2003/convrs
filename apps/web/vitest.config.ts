import { defineConfig } from "vitest/config";
import { resolve } from "node:path";
import { config as loadEnv } from "dotenv-flow";

/**
 * Added in Deploy 2 (billing rework) so unit tests can import app modules by
 * their `@/…` path alias (the same aliases apps/web/tsconfig.json defines).
 * Without this, `vitest` resolves `@/lib/*` as a bare npm package and fails to
 * load any test that touches lib/billing/*.
 *
 * Test defaults are otherwise unchanged — `pnpm --filter web test` still runs
 * `vitest -no-file-parallelism --bail=1`.
 */

// The `test` script (unlike prisma:generate/push) isn't wrapped with
// `dotenv-flow -e .env`, so process.env is otherwise empty here. That's
// mostly fine (most modules only touch env vars behind a runtime check),
// but a handful of modules read one at import time — e.g. lib/auth/totp.ts
// -> @repo/analytics's encryption helper reads ENCRYPTION_KEY as soon as
// it's imported, which happens transitively for any test that imports
// something from the `@/lib/auth` barrel (lib/auth/index.ts re-exports
// ./options, which wires up the 2FA provider). Loading the same .env file
// the app itself uses avoids that crash without hand-picking which vars
// each test needs.
loadEnv({ path: __dirname });

export default defineConfig({
  resolve: {
    alias: {
      "@/lib": resolve(__dirname, "lib"),
      "@/ui": resolve(__dirname, "ui"),
      "@/app": resolve(__dirname, "app"),
      "@/pages": resolve(__dirname, "pages"),
      "@/styles": resolve(__dirname, "styles"),
    },
  },
});
