import { NextRequest } from "next/server";
import { parse } from "@/lib/middlewarre/utils/parse";
import { APP_HOSTNAMES, API_HOSTNAMES } from "@repo/utils";
import { AppMiddleware } from "./lib/middlewarre/app";
import { ApiMiddleware } from "./lib/middlewarre/api";

export const config = {
  matcher: [
    /*
     * Match all paths except for:
     * 1. /api/ routes
     * 2. /_next/ (Next.js internals)
     * 3. /_proxy/ (proxies for third-party services)
     * 4. /analytics.js (analytics tracker)
     * 5. Metadata files: favicon.ico, sitemap.xml, robots.txt, manifest.webmanifest
     */
    "/((?!api/|_next/|_proxy/|analytics.js|favicon.ico|sitemap.xml|robots.txt|manifest.webmanifest).*)",
  ],
};

export default async function Middleware(req: NextRequest) {
  const { domain, path, key, fullKey } = parse(req);

  // for app
  if (APP_HOSTNAMES.has(domain)) {
    return AppMiddleware(req);
  }
  // for api
  if (API_HOSTNAMES.has(domain)) {
    return ApiMiddleware(req);
  }
}
