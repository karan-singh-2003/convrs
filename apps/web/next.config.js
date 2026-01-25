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

  webpack: (config, { webpack, isServer }) => {
    if (isServer) {
      config.plugins.push(
        new webpack.IgnorePlugin({
          resourceRegExp:
            /(^@google-cloud\/spanner|^@mongodb-js\/zstd|^aws-crt|^aws4$|^pg-native$|^mongodb-client-encryption$|^@sap\/hana-client$|^@sap\/hana-client\/extension\/Stream$|^snappy$|^react-native-sqlite-storage$|^bson-ext$|^cardinal$|^kerberos$|^hdb-pool$|^sql.js$|^sqlite3$|^better-sqlite3$|^ioredis$|^typeorm-aurora-data-api-driver$|^pg-query-stream$|^oracledb$|^mysql$|^snappy\/package\.json$|^cloudflare:sockets$)/,
        })
      );
    }

    config.module = {
      ...config.module,
      exprContextCritical: false,
    };

    return config;
  },
};

export default nextConfig;
