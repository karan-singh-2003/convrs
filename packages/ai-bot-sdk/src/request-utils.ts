import type { ConvrsBotConfig, EdgeGeo, IpSource, MinimalRequest } from "./types";

export function readHeader(request: MinimalRequest, name: string): string | null {
  return request.headers.get(name);
}

function isRunningOnVercel(): boolean {
  try {
    return typeof process !== "undefined" && !!process.env && process.env.VERCEL === "1";
  } catch {
    return false;
  }
}

/** Resolve "auto" to the concrete source for this runtime. */
export function resolveIpSource(request: MinimalRequest, config: ConvrsBotConfig): Exclude<IpSource, "auto"> | "adapter" {
  const source = config.ipSource ?? "auto";
  if (source !== "auto") return source;
  if (isRunningOnVercel()) return "vercel";
  // Cloudflare Workers/Pages: only requests that passed through Cloudflare's
  // edge carry `request.cf`, and there cf-connecting-ip is Cloudflare-set.
  if (request.cf && typeof request.cf === "object") return "cloudflare";
  if (request.ip) return "adapter";
  return "none";
}

/**
 * Crawler IP, read only from the header that the configured infrastructure
 * overwrites. Client-supplied forwarding headers are never trusted blindly:
 * with the default `ipSource: "auto"` outside Vercel and without an adapter
 * that resolved the IP itself, no IP is reported at all.
 */
export function resolveClientIp(request: MinimalRequest, config: ConvrsBotConfig): string | null {
  const custom = config.resolveIp?.(request);
  if (custom) return cleanIp(custom);

  switch (resolveIpSource(request, config)) {
    case "vercel":
      return cleanIp(readHeader(request, "x-vercel-forwarded-for") ?? readHeader(request, "x-real-ip"));
    case "cloudflare":
      return cleanIp(readHeader(request, "cf-connecting-ip"));
    case "x-forwarded-for":
      return cleanIp(readHeader(request, "x-forwarded-for"));
    case "adapter":
      return cleanIp(request.ip ?? null);
    default:
      return null;
  }
}

function cleanIp(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const first = raw.split(",")[0]?.trim();
  if (!first) return null;
  return first.startsWith("::ffff:") ? first.slice("::ffff:".length) : first;
}

function decodeHeader(value: string | null): string | undefined {
  if (!value) return undefined;
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/**
 * Geo from the edge network in front of the site, when (and only when) the
 * configured IP source says that network is trusted. Vercel and Cloudflare
 * resolve this from the connecting IP, so it costs nothing per request.
 */
export function resolveEdgeGeo(request: MinimalRequest, config: ConvrsBotConfig): EdgeGeo | undefined {
  const source = resolveIpSource(request, config);
  if (source === "vercel") {
    const country = readHeader(request, "x-vercel-ip-country") ?? undefined;
    if (!country) return undefined;
    return {
      country,
      region: readHeader(request, "x-vercel-ip-country-region") ?? undefined,
      city: decodeHeader(readHeader(request, "x-vercel-ip-city")),
      source: "vercel",
    };
  }
  if (source === "cloudflare") {
    const country = readHeader(request, "cf-ipcountry") ?? undefined;
    if (!country || country === "XX" || country === "T1") return undefined;
    return {
      country,
      region: readHeader(request, "cf-region-code") ?? undefined,
      city: decodeHeader(readHeader(request, "cf-ipcity")),
      source: "cloudflare",
    };
  }
  return undefined;
}

export function resolveRequestUrl(request: MinimalRequest, config: ConvrsBotConfig): URL | null {
  try {
    const raw = new URL(request.url);
    if (!config.publicOrigin) return raw;

    const publicOrigin = new URL(config.publicOrigin);
    const originIsValid =
      (publicOrigin.protocol === "http:" || publicOrigin.protocol === "https:") &&
      !publicOrigin.username &&
      !publicOrigin.password;
    if (!originIsValid) return null;

    const rewritten = new URL(publicOrigin.origin);
    rewritten.pathname = raw.pathname;
    rewritten.search = raw.search;
    return rewritten;
  } catch {
    return null;
  }
}

/**
 * The URL as reported to Convrs: origin + path, with the query string
 * removed unless specific parameters are allow-listed (query strings often
 * carry tokens, emails or other PII). Fragments are never sent.
 */
export function sanitizeUrl(url: URL, keepQueryParams?: string[]): string {
  const clean = new URL(url.origin);
  clean.pathname = url.pathname;
  if (keepQueryParams && keepQueryParams.length > 0) {
    const keepAll = keepQueryParams.includes("*");
    for (const [key, value] of url.searchParams) {
      if (keepAll || keepQueryParams.includes(key)) clean.searchParams.append(key, value);
    }
  }
  return clean.href;
}

/** Referrer reduced to origin + path, or null when absent/unparseable. */
export function sanitizeReferrer(raw: string | null): string | null {
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return `${url.origin}${url.pathname}`;
  } catch {
    return null;
  }
}

export function normalizeStatusCode(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isInteger(value)) return undefined;
  if (value < 100 || value > 599) return undefined;
  return value;
}
