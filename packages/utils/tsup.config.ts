import { defineConfig, Options } from "tsup";

export default defineConfig((options: Options) => ({
  entry: ["src/index.ts"],
  format: ["esm"],
  dts: true,
  minify: false,
  external: ["react"],
  splitting: false,
  sourcemap: true,
  clean: true,
  ...options,
}));
