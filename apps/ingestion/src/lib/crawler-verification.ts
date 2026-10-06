import dns from "node:dns/promises";
import ipRangeCheck from "ip-range-check";
import type { BotClassification } from "@convrs/ai-bot-sdk";

/**
 * Whether a crawler's claimed identity (its User-Agent) matches the IP it
 * came from, using what the vendor publishes:
 *
 *  - `verified`     — IP is in the vendor's published ranges, or passes
 *                     forward-confirmed reverse DNS for the vendor's domains.
 *  - `spoofed`      — the vendor publishes a method and the IP fails it.
 *  - `unverifiable` — the vendor publishes no method (or the UA only matched
 *                     a fallback/generic pattern), so there is nothing to check.
 *  - `unknown`      — no IP, or the check could not complete in time.
 */
export type VerificationState = "verified" | "spoofed" | "unverifiable" | "unknown";

export interface VerificationDeps {
  fetchPrefixes(url: string): Promise<string[]>;
  reverse(ip: string): Promise<string[]>;
  lookup(hostname: string): Promise<string[]>;
  now(): number;
}

const RANGES_TTL_MS = 12 * 60 * 60 * 1000;
const RANGES_FAILURE_TTL_MS = 5 * 60 * 1000;
const RESULT_TTL_MS = 60 * 60 * 1000;
const RESULT_CACHE_MAX = 10_000;
const DEFAULT_BUDGET_MS = 1500;

async function defaultFetchPrefixes(url: string): Promise<string[]> {
  const response = await fetch(url, { signal: AbortSignal.timeout(3000) });
  if (!response.ok) throw new Error(`ranges ${url} -> ${response.status}`);
  const json = (await response.json()) as {
    prefixes?: Array<{ ipv4Prefix?: string; ipv6Prefix?: string }>;
  };
  const prefixes = (json.prefixes ?? [])
    .map((p) => p.ipv4Prefix ?? p.ipv6Prefix)
    .filter((p): p is string => typeof p === "string" && p.includes("/"));
  if (prefixes.length === 0) throw new Error(`ranges ${url} -> empty`);
  return prefixes;
}

const defaultDeps: VerificationDeps = {
  fetchPrefixes: defaultFetchPrefixes,
  reverse: (ip) => dns.reverse(ip),
  lookup: async (hostname) => (await dns.lookup(hostname, { all: true })).map((r) => r.address),
  now: () => Date.now(),
};

export function createCrawlerVerifier(deps: VerificationDeps = defaultDeps) {
  const ranges = new Map<string, { expires: number; prefixes: string[] | null; pending?: Promise<string[] | null> }>();
  const results = new Map<string, { expires: number; state: VerificationState }>();

  function loadRanges(url: string): Promise<string[] | null> {
    const cached = ranges.get(url);
    if (cached && cached.expires > deps.now()) return Promise.resolve(cached.prefixes);
    if (cached?.pending) return cached.pending;

    const pending = deps
      .fetchPrefixes(url)
      .then((prefixes) => {
        ranges.set(url, { expires: deps.now() + RANGES_TTL_MS, prefixes });
        return prefixes as string[] | null;
      })
      .catch((error) => {
        console.warn("[crawler-verification] failed to load ranges", url, String(error));
        // Keep serving a stale list rather than nothing; retry after a short backoff.
        const stale = cached?.prefixes ?? null;
        ranges.set(url, { expires: deps.now() + RANGES_FAILURE_TTL_MS, prefixes: stale });
        return stale;
      });
    ranges.set(url, { expires: 0, prefixes: cached?.prefixes ?? null, pending });
    return pending;
  }

  async function checkRanges(ip: string, urls: string[]): Promise<boolean | null> {
    const lists = await Promise.all(urls.map(loadRanges));
    const loaded = lists.filter((l): l is string[] => Array.isArray(l));
    if (loaded.length === 0) return null;
    return loaded.some((prefixes) => ipRangeCheck(ip, prefixes));
  }

  async function checkReverseDns(ip: string, suffixes: string[]): Promise<boolean | null> {
    let hostnames: string[];
    try {
      hostnames = await deps.reverse(ip);
    } catch (error) {
      const code = (error as { code?: string }).code;
      // No PTR record is a definite failure; anything else is inconclusive.
      return code === "ENOTFOUND" || code === "ENODATA" ? false : null;
    }
    for (const raw of hostnames) {
      const hostname = raw.toLowerCase().replace(/\.$/, "");
      const matches = suffixes.some((s) => hostname === s || hostname.endsWith(`.${s}`));
      if (!matches) continue;
      try {
        if ((await deps.lookup(hostname)).includes(ip)) return true;
      } catch {}
    }
    return false;
  }

  async function verifyUncached(ip: string, classification: BotClassification): Promise<VerificationState> {
    const { verification } = classification;
    let inconclusive = false;

    if (verification.ipRangeUrls?.length) {
      const inRange = await checkRanges(ip, verification.ipRangeUrls);
      if (inRange === true) return "verified";
      if (inRange === null) inconclusive = true;
    }
    if (verification.rdnsSuffixes?.length) {
      const rdns = await checkReverseDns(ip, verification.rdnsSuffixes);
      if (rdns === true) return "verified";
      if (rdns === null) inconclusive = true;
    }
    return inconclusive ? "unknown" : "spoofed";
  }

  return async function verifyCrawler(
    ip: string | null,
    classification: BotClassification,
    budgetMs = DEFAULT_BUDGET_MS
  ): Promise<VerificationState> {
    if (classification.matchType !== "exact" || classification.verification.method === "none") {
      return "unverifiable";
    }
    if (!ip) return "unknown";

    const key = `${classification.agentName}|${ip}`;
    const cached = results.get(key);
    if (cached && cached.expires > deps.now()) return cached.state;

    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<"timeout">((resolve) => {
      timer = setTimeout(() => resolve("timeout"), budgetMs);
    });
    const work = verifyUncached(ip, classification).catch(() => "unknown" as const);
    const outcome = await Promise.race([work, timeout]);
    clearTimeout(timer);
    if (outcome === "timeout") return "unknown";

    if (outcome !== "unknown") {
      if (results.size >= RESULT_CACHE_MAX) {
        const oldest = results.keys().next().value;
        if (oldest !== undefined) results.delete(oldest);
      }
      results.set(key, { expires: deps.now() + RESULT_TTL_MS, state: outcome });
    }
    return outcome;
  };
}

export const verifyCrawler = createCrawlerVerifier();
