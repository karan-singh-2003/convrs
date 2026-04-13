/** @type {import('next').NextConfig} */

// ---- suppress noisy Next.js warnings (same as reference repo) ----
const originalConsoleWarn = console.warn;

console.warn = (...args) => {
  const message = args.join(" ");
  if (
    message.includes("Package mongodb can't be external") ||
    message.includes("Package pg can't be external") ||
    message.includes("Package sqlite3 can't be external") ||
    message.includes("matches serverExternalPackages") ||
    message.includes("Try to install it into the project directory")
  ) {
    return;
  }
  originalConsoleWarn.apply(console, args);
};

// ---- actual Next.js config ----
const nextConfig = {
  reactStrictMode: false,

  async rewrites() {
    return [
      {
        source: "/analytics.js",
        destination: "/api/analytics.js",
      },
    ];
  },
  async rewrites() {
    return [
      {
        source: "/api/track",
        destination: "https://ingest.karanbuilds.me/api/:path*",
      },
    ];
  },

  transpilePackages: [
    "prettier",
    "shiki",
    "@repo/db",
    "@repo/email",
    "@repo/ui",
    "@repo/utils",
    "@boxyhq/saml-jackson",
  ],

  serverExternalPackages: ["@prisma/client", "@repo/prisma"],

  outputFileTracingIncludes: {
    "/api/auth/saml/token": [
      "./node_modules/jose/**/*",
      "./node_modules/openid-client/**/*",
    ],
  },

  experimental: {
    serverComponentsExternalPackages: ["@prisma/client"],
    optimizePackageImports: [
      "@repo/email",
      "@repo/ui",
      "@repo/utils",
      "@team-plain/typescript-sdk",
    ],
    serverActions: {
      bodySizeLimit: "2mb",
    },
  },

  turbopack: {},

  turboPack: {},
};

export default nextConfig;
