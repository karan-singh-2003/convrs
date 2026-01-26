import { NextRequest, NextResponse } from "next/server";

export const config = {
  matcher: [
    "/((?!api/|_next/|_proxy/|favicon.ico|sitemap.xml|robots.txt|manifest.webmanifest).*)",
  ],
};

export default function middleware(req: NextRequest) {
  try {
    const { pathname, search } = req.nextUrl;

    // Safe cookie read (string or null)
    const session =
      req.cookies.get("__Secure-next-auth.session-token")?.value ??
      req.cookies.get("next-auth.session-token")?.value ??
      null;

    const publicPaths = [
      "/login",
      "/register",
      "/forgot-password",
      "/auth",
    ];

    const isPublicPath = publicPaths.some((p) =>
      pathname === p || pathname.startsWith(`${p}/`)
    );

    // Auth gate
    if (!session && !isPublicPath) {
      const loginUrl = new URL("/login", req.url);
      if (pathname !== "/") {
        loginUrl.searchParams.set("next", pathname + search);
      }
      return NextResponse.redirect(loginUrl);
    }

    // Rewrite app paths safely
    if (pathname === "/app" || pathname.startsWith("/app/")) {
      const nextPath = pathname.replace(/^\/app/, "") || "/";
      return NextResponse.rewrite(
        new URL(`/app.acme.co${nextPath}${search}`, req.url)
      );
    }

    if (pathname === "/app.acme.co" || pathname.startsWith("/app.acme.co/")) {
      return NextResponse.next();
    }

    return NextResponse.next();
  } catch {
    // NEVER allow middleware to crash
    return NextResponse.next();
  }
}
