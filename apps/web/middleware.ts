import { NextRequest } from "next/server";
import { parse } from "@/lib/middlewarre/utils/parse";
import { AppMiddleware } from "./lib/middlewarre/app";

// Inlined to avoid importing @repo/utils (which has tailwind-merge, not edge-compatible)
const APP_HOSTNAMES = new Set([
  `app.${process.env.NEXT_PUBLIC_APP_DOMAIN}`,
  `preview.${process.env.NEXT_PUBLIC_APP_DOMAIN}`,
  "localhost:8888",
  "localhost",
]);

const API_HOSTNAMES = new Set([
  `api.${process.env.NEXT_PUBLIC_APP_DOMAIN}`,
  `api-staging.${process.env.NEXT_PUBLIC_APP_DOMAIN}`,
  "api.localhost:8888",
  "api.localhost",
]);
export const config = {
  matcher: [
    /*
     * Match all paths except for:
     * 1. /api/ routes
     * 2. /_next/ (Next.js internals)
     * 3. /_proxy/ (proxies for third-party services)
     * 4. Metadata files: favicon.ico, sitemap.xml, robots.txt, manifest.webmanifest
     */
    "/((?!api/|_next/|_proxy/|favicon.ico|sitemap.xml|robots.txt|manifest.webmanifest).*)",
  ],
};
export default async function Middleware(req: NextRequest) {
  const { domain, path, key, fullKey } = parse(req);

  // for app
  if (APP_HOSTNAMES.has(domain)) {
    return AppMiddleware(req);
  }

  if (API_HOSTNAMES.has(domain)) {
    // handle api routes here
  }
}
