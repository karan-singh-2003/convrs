import { test } from "node:test";
import assert from "node:assert/strict";
import { classifyUserAgent } from "@convrs/ai-bot-sdk";
import {
  clearBotTokenCache,
  extractBearerToken,
  hashBotToken,
  isValidBotToken,
} from "../src/lib/bot-auth.js";
import { createCrawlerVerifier, type VerificationDeps } from "../src/lib/crawler-verification.js";
import { claimIdempotencyKey, releaseIdempotencyKey } from "../src/lib/idempotency.js";

// ── bot auth ──────────────────────────────────────────────────────────────────

test("Bearer parsing is case-insensitive and trims, but requires the scheme", () => {
  assert.equal(extractBearerToken("Bearer cvrs_abc"), "cvrs_abc");
  assert.equal(extractBearerToken("bearer   cvrs_abc  "), "cvrs_abc");
  assert.equal(extractBearerToken(["BEARER cvrs_x"]), "cvrs_x");
  assert.equal(extractBearerToken("cvrs_abc"), null);
  assert.equal(extractBearerToken("Basic dXNlcjpwYXNz"), null);
  assert.equal(extractBearerToken("Bearer a b"), null);
  assert.equal(extractBearerToken(undefined), null);
});

test("tokens are checked by hash, workspace and expiry", async () => {
  clearBotTokenCache();
  const now = 1_000_000;
  const rows: Record<string, { workspaceId: string; expires: Date | null }> = {
    [hashBotToken("cvrs_valid")]: { workspaceId: "ws1", expires: null },
    [hashBotToken("cvrs_expired")]: { workspaceId: "ws1", expires: new Date(now - 1) },
    [hashBotToken("bc_legacy")]: { workspaceId: "ws1", expires: new Date(now + 60_000) },
  };
  const lookup = async (hash: string, ws: string) => {
    const row = rows[hash];
    return row && row.workspaceId === ws ? { expires: row.expires } : null;
  };
  const clock = () => now;

  assert.equal(await isValidBotToken("cvrs_valid", "ws1", lookup, clock), true);
  assert.equal(await isValidBotToken("bc_legacy", "ws1", lookup, clock), true);
  assert.equal(await isValidBotToken("cvrs_valid", "ws2", lookup, clock), false, "other workspace");
  assert.equal(await isValidBotToken("cvrs_expired", "ws1", lookup, clock), false, "expired");
  assert.equal(await isValidBotToken("cvbot_whatever", "ws1", lookup, clock), false, "unknown prefix");
  assert.equal(await isValidBotToken(null, "ws1", lookup, clock), false);
});

test("token verdicts are cached briefly", async () => {
  clearBotTokenCache();
  let calls = 0;
  const lookup = async () => {
    calls++;
    return { expires: null };
  };
  let now = 0;
  await isValidBotToken("cvrs_cached", "ws", lookup, () => now);
  await isValidBotToken("cvrs_cached", "ws", lookup, () => now);
  assert.equal(calls, 1);
  now = 61_000;
  await isValidBotToken("cvrs_cached", "ws", lookup, () => now);
  assert.equal(calls, 2);
});

// ── crawler verification ──────────────────────────────────────────────────────

const GPTBOT = classifyUserAgent("Mozilla/5.0 (compatible; GPTBot/1.1; +https://openai.com/gptbot)")!;
const GOOGLEBOT = classifyUserAgent("Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)")!;
const CLAUDEBOT = classifyUserAgent("Mozilla/5.0 (compatible; ClaudeBot/1.0; +claudebot@anthropic.com)")!;

function deps(overrides: Partial<VerificationDeps> = {}): VerificationDeps {
  return {
    fetchPrefixes: async () => ["20.15.240.64/28", "2001:db8::/32"],
    reverse: async () => {
      throw Object.assign(new Error("no ptr"), { code: "ENOTFOUND" });
    },
    lookup: async () => [],
    now: () => 0,
    ...overrides,
  };
}

test("IP inside the vendor's published ranges is verified", async () => {
  const verify = createCrawlerVerifier(deps());
  assert.equal(await verify("20.15.240.70", GPTBOT), "verified");
  assert.equal(await verify("2001:db8::5", GPTBOT), "verified");
});

test("IP outside the vendor's ranges is flagged as spoofed", async () => {
  const verify = createCrawlerVerifier(deps());
  assert.equal(await verify("198.51.100.1", GPTBOT), "spoofed");
});

test("forward-confirmed reverse DNS verifies Googlebot", async () => {
  const verify = createCrawlerVerifier(
    deps({
      fetchPrefixes: async () => ["66.249.64.0/27"],
      reverse: async () => ["crawl-66-249-90-1.googlebot.com"],
      lookup: async (h) => (h === "crawl-66-249-90-1.googlebot.com" ? ["66.249.90.1"] : []),
    })
  );
  assert.equal(await verify("66.249.90.1", GOOGLEBOT), "verified");
});

test("reverse DNS pointing at a look-alike domain does not verify", async () => {
  const verify = createCrawlerVerifier(
    deps({
      fetchPrefixes: async () => ["66.249.64.0/27"],
      reverse: async () => ["googlebot.com.evil.net"],
      lookup: async () => ["203.0.113.8"],
    })
  );
  assert.equal(await verify("203.0.113.8", GOOGLEBOT), "spoofed");
});

test("vendors without a published method are unverifiable; missing IP is unknown", async () => {
  const verify = createCrawlerVerifier(deps());
  assert.equal(await verify("203.0.113.8", CLAUDEBOT), "unverifiable");
  assert.equal(await verify(null, GPTBOT), "unknown");
});

test("range download failure is inconclusive, not spoofed", async () => {
  const verify = createCrawlerVerifier(
    deps({
      fetchPrefixes: async () => {
        throw new Error("network down");
      },
    })
  );
  assert.equal(await verify("198.51.100.1", GPTBOT), "unknown");
});

test("slow verification gives up within its budget", async () => {
  const verify = createCrawlerVerifier(deps({ fetchPrefixes: () => new Promise(() => {}) }));
  const started = Date.now();
  assert.equal(await verify("198.51.100.1", GPTBOT, 50), "unknown");
  assert.ok(Date.now() - started < 1000);
});

test("ranges are fetched once and reused", async () => {
  let fetches = 0;
  const verify = createCrawlerVerifier(
    deps({
      fetchPrefixes: async () => {
        fetches++;
        return ["20.15.240.64/28"];
      },
    })
  );
  await verify("20.15.240.65", GPTBOT);
  await verify("20.15.240.66", GPTBOT);
  await verify("198.51.100.9", GPTBOT);
  assert.equal(fetches, 1);
});

// ── idempotency ───────────────────────────────────────────────────────────────

function fakeRedis() {
  const store = new Map<string, string>();
  return {
    store,
    async set(key: string, value: string, opts: { nx: true; ex: number }) {
      if (opts.nx && store.has(key)) return null;
      store.set(key, value);
      return "OK";
    },
    async del(key: string) {
      store.delete(key);
      return 1;
    },
  };
}

test("first claim is new, a replay is a duplicate, a release allows a retry", async () => {
  const redis = fakeRedis();
  assert.equal(await claimIdempotencyKey("k", redis), "new");
  assert.equal(await claimIdempotencyKey("k", redis), "duplicate");
  await releaseIdempotencyKey("k", redis);
  assert.equal(await claimIdempotencyKey("k", redis), "new");
});

test("idempotency fails open when Redis is unavailable", async () => {
  const broken = {
    async set(): Promise<unknown> {
      throw new Error("timeout");
    },
    async del(): Promise<unknown> {
      throw new Error("timeout");
    },
  };
  const original = console.error;
  console.error = () => {};
  try {
    assert.equal(await claimIdempotencyKey("k", broken), "new");
    await releaseIdempotencyKey("k", broken);
  } finally {
    console.error = original;
  }
});
