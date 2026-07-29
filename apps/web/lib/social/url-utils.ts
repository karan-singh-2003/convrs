import { Redis } from "@upstash/redis";

const redis = Redis.fromEnv();

const TRACKING_PARAMS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
  "ref",
  "fbclid",
  "gclid",
];

/** Strips tracking params + trailing slash so two URLs pointing at the
 * same destination compare equal regardless of how they were shared. */
export function normalizeUrl(rawUrl: string): string | null {
  try {
    const url = new URL(rawUrl);
    for (const param of TRACKING_PARAMS) url.searchParams.delete(param);
    const host = url.hostname.replace(/^www\./, "");
    const path = url.pathname.replace(/\/$/, "");
    const query = url.searchParams.toString();
    return `${host}${path}${query ? `?${query}` : ""}`.toLowerCase();
  } catch {
    return null;
  }
}

/** Follows redirects (HEAD request) to find where a t.co/short link
 * actually goes, caching the result in Redis since t.co URLs never
 * change destination once created. */
export async function resolveShortUrl(shortUrl: string): Promise<string | null> {
  const cacheKey = `resolved-url:${shortUrl}`;
  const cached = await redis.get<string>(cacheKey);
  if (cached !== null) return cached === "__DEAD__" ? null : cached;

  try {
    const response = await fetch(shortUrl, {
      method: "HEAD",
      redirect: "follow",
      signal: AbortSignal.timeout(5000),
    });
    const finalUrl = response.url || null;
    // Long TTL — a short link's destination is effectively immutable.
    await redis.set(cacheKey, finalUrl ?? "__DEAD__", { ex: 60 * 60 * 24 * 30 });
    return finalUrl;
  } catch {
    // Negative-cache dead links for a short period so we don't retry
    // every worker cycle, but do allow a retry eventually.
    await redis.set(cacheKey, "__DEAD__", { ex: 60 * 60 });
    return null;
  }
}

/** Extracts and normalizes all http(s) URLs found in free text (tweet
 * bodies, Reddit post bodies). */
export function extractUrlsFromText(text: string): string[] {
  const matches = text.match(/https?:\/\/[^\s]+/g) ?? [];
  const normalized = matches
    .map((url) => normalizeUrl(url))
    .filter((url): url is string => Boolean(url));
  return Array.from(new Set(normalized));
}

/** Parses a referer_url like "https://x.com/levelsio" (profile page,
 * not a status/tweet) into a platform + handle, for link-in-bio
 * attribution matching. Returns null if it's not a bare profile URL. */
export function parseProfileReferer(
  refererUrl: string
): { platform: "x" | "reddit"; handle: string } | null {
  try {
    const url = new URL(refererUrl);
    const host = url.hostname.replace(/^www\./, "");
    const segments = url.pathname.split("/").filter(Boolean);

    if ((host === "x.com" || host === "twitter.com") && segments.length === 1) {
      return { platform: "x", handle: segments[0] };
    }
    if (host === "reddit.com" && segments[0] === "user" && segments.length === 2) {
      return { platform: "reddit", handle: segments[1] };
    }
    return null;
  } catch {
    return null;
  }
}