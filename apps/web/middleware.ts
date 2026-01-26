import { NextRequest, NextResponse } from "next/server";

export const config = {
  matcher: [
    "/((?!api/|_next/|_proxy/|favicon.ico|sitemap.xml|robots.txt|manifest.webmanifest).*)",
  ],
};

export default function Middleware(req: NextRequest) {
  const pathname = req.nextUrl.pathname;
  const search = req.nextUrl.search;

  // Check for session cookie (Vercel uses __Secure- prefix in production)
  const session =
    req.cookies.get("__Secure-next-auth.session-token") ||
    req.cookies.get("next-auth.session-token");

  // If no session and trying to access protected routes, redirect to /login
  const publicPaths = ["/login", "/register", "/forgot-password", "/auth"];
  const isPublicPath = publicPaths.some((path) => pathname.startsWith(path));

  if (!session && !isPublicPath) {
    const loginUrl = new URL("/login", req.url);
    if (pathname !== "/") {
      loginUrl.searchParams.set("next", pathname + search);
    }
    return NextResponse.redirect(loginUrl);
  }

  // Rewrite all requests to /app.acme.co/* internally
  const rewriteUrl = new URL(`/app.acme.co${pathname}${search}`, req.url);
  const response = NextResponse.rewrite(rewriteUrl);

  // Pass the original pathname and search params to the layouts via headers
  response.headers.set("x-pathname", pathname);
  response.headers.set("x-search-params", search);

  return response;
}
