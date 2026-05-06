import { defineConfig } from "tsup";
 
export default defineConfig({
  entry: ["src/index.ts"],
  format: ["cjs", "esm"],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  // Treat next/server and @vercel/functions as external —
  // the consuming app (apps/web) already has Next.js installed.
  // apps/ingestion (Express) will NOT have next installed,
  // so we need to handle that separately (see note below).
  external: ["next", "next/server", "@vercel/functions", "@repo/utils","@repo/email"],
});
 