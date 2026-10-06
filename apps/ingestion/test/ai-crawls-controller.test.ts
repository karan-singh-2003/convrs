/**
 * End-to-end behaviour of POST /api/ai-crawls through the real controller,
 * classifier, hostname authorization, bot-token auth, rate limiter and
 * crawler verifier. Only I/O is replaced: Prisma, the Tinybird writer,
 * Redis (idempotency + daily bot cap), and the verifier's DNS/range fetches.
 *
 * Needs Node's module mocks: run via `pnpm --filter ingestion test`.
 */
import { before, beforeEach, mock, test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";

const GPTBOT = "Mozilla/5.0 AppleWebKit/537.36 (compatible; GPTBot/1.1; +https://openai.com/gptbot)";
const CHATGPT_USER = "Mozilla/5.0 AppleWebKit/537.36 (compatible; ChatGPT-User/1.0; +https://openai.com/bot)";
const CHROME = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36";
const BOT_TOKEN = "cvbot_test_token_value";
const OTHER_WORKSPACE_TOKEN = "cvbot_belongs_to_another_workspace";

const sha = (t: string) => createHash("sha256").update(t).digest("hex");
const TOKENS: Record<string, string> = { [sha(BOT_TOKEN)]: "ws_1", [sha(OTHER_WORKSPACE_TOKEN)]: "ws_2" };

let workspace: Record<string, any>;
let usage: number; // the plan's human-analytics quota counter
let events: Record<string, any>[];
let persistFails: boolean;
let botCap: number;
let botCount: number;
const idempotency = new Set<string>();

let controller: typeof import("../src/controllers/track-ai-bot.js").trackAICrawlerController;

before(async () => {
  // Real implementations, imported before the mocks replace their modules.
  const analytics = await import("@repo/analytics");
  const verification = await import("../src/lib/crawler-verification.js");

  mock.module("@repo/db", {
    namedExports: {
      prisma: {
        workspace: { findUnique: async () => workspace },
        restrictedToken: {
          findFirst: async ({ where }: { where: { hashedKey: string; workspaceId: string } }) =>
            TOKENS[where.hashedKey] === where.workspaceId ? { expires: null } : null,
        },
      },
    },
  });

  mock.module("@repo/analytics", {
    namedExports: {
      isWorkspaceEntitled: analytics.isWorkspaceEntitled,
      isHostnameAuthorized: analytics.isHostnameAuthorized,
      localhostTrackingAllowed: analytics.localhostTrackingAllowed,
      normalizeHostname: analytics.normalizeHostname,
      // Still exported for /api/track; the bot path must never call them.
      claimWorkspaceUsage: async () => {
        usage += 1;
        return true;
      },
      releaseWorkspaceUsage: async () => {
        usage -= 1;
      },
      trackBotEvent: async ({ event }: { event: Record<string, any> }) => {
        if (persistFails) return null;
        events.push(event);
        return event;
      },
    },
  });

  // OpenAI's GPTBot / ChatGPT-User publish ranges; pretend they are 20.0.0.0/8.
  mock.module(new URL("../src/lib/crawler-verification.ts", import.meta.url).href, {
    namedExports: {
      createCrawlerVerifier: verification.createCrawlerVerifier,
      verifyCrawler: verification.createCrawlerVerifier({
        fetchPrefixes: async () => ["20.0.0.0/8"],
        reverse: async () => [],
        lookup: async () => [],
        now: () => Date.now(),
      }),
    },
  });

  mock.module(new URL("../src/lib/idempotency.ts", import.meta.url).href, {
    namedExports: {
      claimIdempotencyKey: async (key: string) => {
        if (idempotency.has(key)) return "duplicate";
        idempotency.add(key);
        return "new";
      },
      releaseIdempotencyKey: async (key: string) => {
        idempotency.delete(key);
      },
    },
  });

  mock.module(new URL("../src/lib/bot-daily-cap.ts", import.meta.url).href, {
    namedExports: {
      claimBotDailyCap: async () => {
        botCount += 1;
        return botCount > botCap ? { allowed: false, cap: botCap } : { allowed: true, count: botCount, key: "k" };
      },
      releaseBotDailyCap: async () => {
        botCount -= 1;
      },
      secondsUntilUtcMidnight: () => 3600,
    },
  });

  ({ trackAICrawlerController: controller } = await import("../src/controllers/track-ai-bot.js"));
});

beforeEach(async () => {
  workspace = {
    id: "ws_1",
    domain: "example.com",
    allowedHostnames: [],
    allowAllDomains: false,
    blockedHostnames: [],
    blockedIpAddresses: [],
    blockedPages: [],
    blockedCountries: [],
    botTrafficRequireAuth: false,
    subscriptionStatus: "active",
    freeTrialEndDate: null,
    paymentFailedAt: null,
  };
  usage = 0;
  events = [];
  persistFails = false;
  botCap = 1000;
  botCount = 0;
  idempotency.clear();
  (await import("../src/lib/bot-auth.js")).clearBotTokenCache();
});

async function post(body: Record<string, unknown>, headers: Record<string, string> = {}) {
  const res: { statusCode: number; body: any; headers: Record<string, string> } = {
    statusCode: 200,
    body: undefined,
    headers: {},
  };
  const response = {
    status(code: number) {
      res.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      res.body = payload;
      return this;
    },
    setHeader(name: string, value: string) {
      res.headers[name.toLowerCase()] = value;
    },
  };
  const request = { body, headers, ip: "198.51.100.7", socket: {} };
  await controller(request as any, response as any);
  return res;
}

const crawl = (overrides: Record<string, unknown> = {}, bot: Record<string, unknown> = {}) => ({
  websiteId: "proj_1",
  url: "https://example.com/pricing",
  ...overrides,
  bot: { userAgent: GPTBOT, ip: "20.1.2.3", statusCode: 200, source: "server-sdk", ...bot },
});

// ── Authentication ────────────────────────────────────────────────────────────

test("default setup: the public project ID alone is accepted and stored as unauthenticated", async () => {
  const res = await post(crawl());
  assert.equal(res.statusCode, 202);
  assert.equal(res.body.authenticated, false);
  assert.equal(events.length, 1);
  assert.equal(events[0]!.authenticated, 0);
});

test("a valid bot token is accepted and stored as authenticated", async () => {
  const res = await post(crawl(), { authorization: `Bearer ${BOT_TOKEN}` });
  assert.equal(res.statusCode, 202);
  assert.equal(res.body.authenticated, true);
  assert.equal(events[0]!.authenticated, 1);
});

test("auth optional: a supplied but invalid, rotated or malformed token is still rejected", async () => {
  for (const authorization of ["Bearer cvbot_rotated_or_wrong", "Bearer proj_1", "Basic abc", "Bearer"]) {
    const res = await post(crawl(), { authorization });
    assert.equal(res.statusCode, 401, authorization);
    assert.equal(res.body.error, "Invalid bot tracking token");
  }
  assert.equal(events.length, 0);
  assert.equal(botCount, 0, "rejected before the bot cap is touched");
});

test("auth required: missing or wrong tokens are rejected before cap, usage or storage", async () => {
  workspace.botTrafficRequireAuth = true;
  const missing = await post(crawl());
  const wrong = await post(crawl(), { authorization: "Bearer cvbot_wrong" });
  const websiteToken = await post(crawl(), { authorization: "Bearer proj_1" });
  assert.equal(missing.body.error, "Missing bot tracking token");
  for (const res of [missing, wrong, websiteToken]) {
    assert.equal(res.statusCode, 401);
    assert.match(res.headers["www-authenticate"] ?? "", /^Bearer /);
  }
  assert.equal(botCount, 0);
  assert.equal(events.length, 0);

  const ok = await post(crawl(), { authorization: `Bearer ${BOT_TOKEN}` });
  assert.equal(ok.statusCode, 202);
  assert.equal(events[0]!.authenticated, 1);
});

// ── Workspace isolation ───────────────────────────────────────────────────────

test("another workspace's valid token cannot write to this workspace", async () => {
  const optional = await post(crawl(), { authorization: `Bearer ${OTHER_WORKSPACE_TOKEN}` });
  workspace.botTrafficRequireAuth = true;
  const required = await post(crawl(), { authorization: `Bearer ${OTHER_WORKSPACE_TOKEN}` });
  assert.equal(optional.statusCode, 401);
  assert.equal(required.statusCode, 401);
  assert.equal(events.length, 0);
});

test("the public project ID only writes events for its own website's hostnames", async () => {
  for (const url of ["https://evil.com/pricing", "https://example.com.evil.com/", "https://notexample.com/"]) {
    const res = await post(crawl({ url }));
    assert.equal(res.statusCode, 403, url);
    assert.equal(res.body.code, "hostname_not_allowed");
  }
  assert.equal((await post(crawl({ domain: "evil.com" }))).statusCode, 403, "the domain override is authorized too");
  assert.equal(botCount, 0);
  assert.equal(events.length, 0);
});

test("every stored event is scoped to the workspace the project ID resolves to", async () => {
  await post(crawl());
  await post(crawl(), { authorization: `Bearer ${BOT_TOKEN}` });
  assert.ok(events.every((e) => e.workspace_id === "ws_1"));
});

// ── Human quota protection (daily bot cap) ───────────────────────────────────

test("bot events never consume the plan's human-analytics quota", async () => {
  for (let i = 0; i < 25; i++) await post(crawl());
  assert.equal(events.length, 25);
  assert.equal(usage, 0, "Workspace.usage untouched");
  assert.equal(botCount, 25, "counted against the daily bot cap instead");
});

test("bot cap: once reached, Bot Traffic pauses (429) while the human quota stays untouched", async () => {
  botCap = 2;
  const eventId = "1c2f5a7e-0b8d-4f3a-9a11-3c5d7e9f0a12";
  assert.equal((await post(crawl())).statusCode, 202);
  assert.equal((await post(crawl())).statusCode, 202);
  const capped = await post(crawl({ eventId }));
  assert.equal(capped.statusCode, 429);
  assert.equal(capped.body.code, "bot_daily_cap");
  assert.equal(capped.headers["retry-after"], "3600");
  assert.equal(events.length, 2);
  assert.equal(usage, 0);
  assert.equal(idempotency.size, 0, "a capped event's id stays retryable");
});

test("bots are still accepted when the human quota is used up (separate allowances)", async () => {
  workspace.usage = 10_000;
  workspace.usageLimit = 10_000;
  assert.equal((await post(crawl())).statusCode, 202);
});

// ── Classification, verification, and data ──────────────────────────────────

test("a human request is ignored and costs nothing", async () => {
  const res = await post(crawl({}, { userAgent: CHROME }));
  assert.equal(res.statusCode, 202);
  assert.deepEqual(res.body, { success: true, tracked: false, reason: "not_a_bot" });
  assert.equal(botCount, 0);
  assert.equal(events.length, 0);
});

test("a known crawler is classified server-side; client-sent provider/category/verification are ignored", async () => {
  const res = await post({
    ...crawl({}, { vendor: "Fake", category: "answer_agent", verification: "verified", matchType: "exact" }),
    category: "answer_agent",
    authenticated: 1,
  });
  assert.equal(res.statusCode, 202);
  const event = events[0]!;
  assert.equal(event.vendor, "OpenAI");
  assert.equal(event.agent_name, "gptbot");
  assert.equal(event.category, "training_crawler");
  assert.equal(event.match_type, "exact");
  assert.match(event.classifier_version, /^\d{4}\.\d+\.\d+$/);
  assert.equal(event.verification, "verified");
  assert.equal(event.authenticated, 0, "a body field cannot claim authentication");
  assert.equal(event.status_code, 200);
  assert.equal(event.page, "/pricing");
});

test("answer agents land in AI Answers", async () => {
  await post(crawl({}, { userAgent: CHATGPT_USER }));
  assert.equal(events[0]!.category, "answer_agent");
});

test("IP verification: in-range is verified, out-of-range is spoofed, no IP is unknown", async () => {
  await post(crawl({}, { ip: "20.9.9.9" }));
  await post(crawl({}, { ip: "203.0.113.50" }));
  await post(crawl({}, { ip: null }));
  assert.deepEqual(
    events.map((e) => e.verification),
    ["verified", "spoofed", "unknown"]
  );
});

test("unknown automation gets no fabricated provider and is unverifiable", async () => {
  await post(crawl({}, { userAgent: "python-requests/2.32.0" }));
  const event = events[0]!;
  assert.equal(event.vendor, "Unknown");
  assert.equal(event.agent_name, "unknown_bot");
  assert.equal(event.category, "other");
  assert.equal(event.match_type, "generic");
  assert.equal(event.verification, "unverifiable");
});

test("crawler-facing files arrive via the DataFast-style href/ai payload with their status code", async () => {
  for (const path of ["/robots.txt", "/llms.txt", "/llms-full.txt", "/sitemap.xml", "/docs/start.md"]) {
    const res = await post({
      websiteId: "proj_1",
      domain: "example.com",
      href: `https://example.com${path}?token=secret`,
      ai: { userAgent: GPTBOT, ip: "20.1.2.3", statusCode: 404, source: "server_middleware" },
    });
    assert.equal(res.statusCode, 202, path);
  }
  assert.deepEqual(
    events.map((e) => e.page),
    ["/robots.txt", "/llms.txt", "/llms-full.txt", "/sitemap.xml", "/docs/start.md"]
  );
  assert.ok(events.every((e) => e.status_code === 404 && !e.url.includes("token")));
  assert.ok(events.every((e) => e.source === "server_middleware"));
});

test("an invalid status code is stored as unknown, not invented", async () => {
  await post(crawl({}, { statusCode: 999 }));
  await post(crawl({}, { statusCode: undefined }));
  assert.deepEqual(
    events.map((e) => e.status_code),
    [null, null]
  );
});

test("a retried event id is stored and counted once", async () => {
  const eventId = "6f1c1b7e-8a7d-4a43-9d36-0c7f0b7f2a11";
  const first = await post(crawl({ eventId }));
  const second = await post(crawl({ eventId }));
  assert.equal(first.body.tracked, true);
  assert.equal(second.body.duplicate, true);
  assert.equal(botCount, 1);
  assert.equal(events.length, 1);
});

test("an inactive subscription is rejected before the bot cap", async () => {
  workspace.subscriptionStatus = "canceled";
  const res = await post(crawl());
  assert.equal(res.statusCode, 403);
  assert.equal(botCount, 0);
});

test("when the event cannot be recorded, the bot-cap unit and the event id are given back", async () => {
  persistFails = true;
  const res = await post(crawl({ eventId: "9d1f6a52-3b8e-4c1a-8f0e-2a6b7c8d9e01" }));
  assert.equal(res.statusCode, 500);
  assert.equal(botCount, 0);
  assert.equal(idempotency.size, 0);
});

test("malformed payloads are rejected without touching the workspace", async () => {
  assert.equal((await post({ websiteId: "proj_1", url: "https://example.com/" })).statusCode, 400);
  assert.equal((await post(crawl({ url: "javascript:alert(1)" }))).statusCode, 400);
  assert.equal(botCount, 0);
});
