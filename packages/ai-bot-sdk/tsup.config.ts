import { defineConfig } from "tsup";

export default defineConfig({
  entry: { index: "src/index.ts" },
  format: ["esm", "cjs"],
  dts: true,
  sourcemap: true,
  clean: true,
  target: "es2020",
  // The package has no runtime dependencies; keep it that way so it stays
  // trivially safe to drop into any customer server or edge runtime.
});
