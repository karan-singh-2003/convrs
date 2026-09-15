import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

/**
 * Added in Deploy 2 (billing rework) so unit tests can import app modules by
 * their `@/…` path alias (the same aliases apps/web/tsconfig.json defines).
 * Without this, `vitest` resolves `@/lib/*` as a bare npm package and fails to
 * load any test that touches lib/billing/*.
 *
 * Test defaults are otherwise unchanged — `pnpm --filter web test` still runs
 * `vitest -no-file-parallelism --bail=1`.
 */
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
