import { defineConfig } from "tsup";

export default defineConfig({
  entry: [
    "src/index.ts",
    "src/templates/*.tsx",
    "src/resend/index.ts",
    "src/resend/*.ts",
    "src/send-via-nodemailer.ts",
    "src/send-via-resend.ts",
  ],
  format: ["cjs", "esm"],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  external: ["react", "react-dom"],
});
