import { NextRequest } from "next/server";
import { parse } from "@/lib/middlewarre/utils/parse";
import { APP_HOSTNAMES, API_HOSTNAMES } from "@repo/utils";
import { AppMiddleware } from "./lib/middlewarre/app";
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
    console.log("APP MIDDLEWARE HANDLING PATH:", path);
    return AppMiddleware(req);
  }

  if (API_HOSTNAMES.has(domain)) {
    // handle api routes here
  }
}
