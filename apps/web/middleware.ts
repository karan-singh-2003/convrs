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

  // Public paths that should never be rewritten
  const publicPaths = [
    "/login",
    "/register",
    "/forgot-password",
    "/auth",
    "/api/",
    "/_next/",
    "/_proxy/",
    "/favicon.ico",
    "/sitemap.xml",
    "/robots.txt",
    "/manifest.webmanifest",
  ];
  const isPublicPath = publicPaths.some((path) => pathname.startsWith(path));

  // If no session and not on a public path, redirect to /login
  if (!session && !isPublicPath) {
    const loginUrl = new URL("/login", req.url);
    if (pathname !== "/") {
      loginUrl.searchParams.set("next", pathname + search);
    }
    return NextResponse.redirect(loginUrl);
  }

  // Only rewrite /app/* and /app.acme.co/* to /app.acme.co/*
  if (pathname.startsWith("/app") || pathname.startsWith("/app.acme.co")) {
    const rewriteUrl = new URL(
      `/app.acme.co${pathname.replace(/^\/app(\.acme\.co)?/, "")}${search}`,
      req.url
    );
    const response = NextResponse.rewrite(rewriteUrl);
    response.headers.set("x-pathname", pathname);
    response.headers.set("x-search-params", search);
    return response;
  }

  // For all other public paths, just continue
  return NextResponse.next();
}
