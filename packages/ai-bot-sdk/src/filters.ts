import { DEFAULT_IGNORED_EXTENSIONS, DEFAULT_IGNORED_PATH_PREFIXES, ALWAYS_TRACKED_PATHS } from "./registry";
import type { ConvrsBotConfig } from "./types";

export function normalizePathname(pathname: string): string {
  if (!pathname || pathname === "/") return "/";
  const withLeadingSlash = pathname.startsWith("/") ? pathname : `/${pathname}`;
  return withLeadingSlash.replace(/\/{2,}/g, "/").toLowerCase();
}

/**
 * Crawler-facing files that must stay trackable even though their
 * extensions (txt, xml) are otherwise ignored as static assets:
 * robots.txt, llms.txt, llms-full.txt, sitemap.xml and sitemap variants
 * (sitemap-1.xml, sitemap_index.xml, /sitemaps/foo.xml, ...).
 */
export function isAlwaysTrackedPath(pathname: string): boolean {
  const normalized = normalizePathname(pathname);
  const lastSegment = normalized.split("/").pop() ?? "";
  if (ALWAYS_TRACKED_PATHS.has(normalized)) return true;
  const inSitemapDir = normalized.startsWith("/sitemap/") || normalized.startsWith("/sitemaps/");
  if (inSitemapDir && lastSegment.endsWith(".xml")) return true;
  return lastSegment.includes("sitemap") && lastSegment.endsWith(".xml");
}

export function matchesIgnoredPrefix(pathname: string, prefix: string): boolean {
  const normalizedPrefix = normalizePathname(prefix);
  return pathname === normalizedPrefix || pathname.startsWith(`${normalizedPrefix}/`);
}

/**
 * `excludePaths` entries are exact paths, or prefixes when they end in "/".
 * Used to avoid double-reporting a path that a `withBotTracking` route
 * handler already reports with its exact status code.
 */
export function matchesExcludedPath(pathname: string, excludePaths?: string[]): boolean {
  if (!excludePaths || excludePaths.length === 0) return false;
  return excludePaths.some((entry) => {
    const normalized = normalizePathname(entry);
    if (entry.endsWith("/") && entry !== "/") return pathname.startsWith(normalized.replace(/\/?$/, "/"));
    return pathname === normalized;
  });
}

export function resolveIgnoredPathPrefixes(config: ConvrsBotConfig): string[] {
  if (config.ignoredPathPrefixes) return config.ignoredPathPrefixes;
  return [...DEFAULT_IGNORED_PATH_PREFIXES, ...(config.extraIgnoredPathPrefixes ?? [])];
}

export function resolveIgnoredExtensions(config: ConvrsBotConfig): Set<string> {
  const list = config.ignoredExtensions ?? [
    ...DEFAULT_IGNORED_EXTENSIONS,
    ...(config.extraIgnoredExtensions ?? []),
  ];
  return new Set(list.map((ext) => ext.replace(/^\./, "").toLowerCase()));
}

export function hasIgnoredExtension(pathname: string, extensions: Set<string>): boolean {
  const lastSegment = pathname.split("/").pop() ?? "";
  const match = /\.([a-z0-9]+)$/i.exec(lastSegment);
  const extension = match?.[1];
  return Boolean(extension && extensions.has(extension.toLowerCase()));
}

export function isTrackedMethod(method: string, allowed?: string[]): boolean {
  const list = allowed ?? ["GET", "HEAD"];
  return list.includes(method.toUpperCase());
}
