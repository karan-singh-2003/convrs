// apps/web/app/analytics.js/route.ts

import { readFileSync } from "fs";
import { join } from "path";

export async function GET() {
  console.log("[Analytics Route] Serving analytics.js");
  const filePath = join(process.cwd(), "public/analytics.js");
  const file = readFileSync(filePath, "utf-8");

  return new Response(file, {
    headers: {
      "Content-Type": "application/javascript",
      "Cache-Control": "no-cache",
    },
  });
}
