import { test } from "node:test";
import assert from "node:assert/strict";
import { createRateLimiter } from "../src/lib/rate-limit.js";
import { clearBotTokenCache, hashBotToken, isValidBotToken } from "../src/lib/bot-auth.js";
import { normalizeCrawlPayload } from "../src/controllers/track-ai-bot.js";

test("rate limiter allows up to the limit per window, then reports Retry-After", () => {
  let now = 0;
  const hit = createRateLimiter({ limit: 3, windowMs: 60_000, now: () => now });
  assert.equal(hit("a").allowed, true);
  assert.equal(hit("a").allowed, true);
  assert.equal(hit("a").allowed, true);
  const blocked = hit("a");
  assert.equal(blocked.allowed, false);
  assert.equal(blocked.retryAfterSeconds, 60);
  assert.equal(hit("b").allowed, true, "keys are independent");
  now = 60_000;
  assert.equal(hit("a").allowed, true, "a new window starts after windowMs");
});

test("rate limiter memory stays bounded", () => {
  let now = 0;
  const hit = createRateLimiter({ limit: 1, windowMs: 1000, maxKeys: 3, now: () => now });
  for (const k of ["a", "b", "c", "d", "e"]) hit(k);
  now = 5000;
  assert.equal(hit("a").allowed, true);
});

test("direct-HTTP field names are accepted as aliases; canonical names win", () => {
  assert.deepEqual(normalizeCrawlPayload({ websiteId: "w", href: "https://e.com/a", ai: { userAgent: "x" } }), {
    websiteId: "w",
    href: "https://e.com/a",
    url: "https://e.com/a",
    ai: { userAgent: "x" },
    bot: { userAgent: "x" },
  });
  const both = normalizeCrawlPayload({ url: "https://e.com/u", href: "https://e.com/h", bot: { userAgent: "b" }, ai: { userAgent: "a" } }) as Record<string, any>;
  assert.equal(both.url, "https://e.com/u");
  assert.equal(both.bot.userAgent, "b");
  assert.equal(normalizeCrawlPayload(null), null);
  assert.deepEqual(normalizeCrawlPayload([1]), [1]);
});

test("the website-specific cvbot_ token is accepted for its own workspace only", async () => {
  clearBotTokenCache();
  const hash = hashBotToken("cvbot_site_token");
  const lookup = async (h: string, ws: string) => (h === hash && ws === "ws1" ? { expires: null } : null);
  assert.equal(await isValidBotToken("cvbot_site_token", "ws1", lookup), true);
  assert.equal(await isValidBotToken("cvbot_site_token", "ws2", lookup), false);
  assert.equal(await isValidBotToken("cvbot_wrong", "ws1", lookup), false);
});

test("a rotated token stops being accepted within the short cache window", async () => {
  clearBotTokenCache();
  let valid = true;
  let now = 0;
  const lookup = async () => (valid ? { expires: null } : null);
  assert.equal(await isValidBotToken("cvbot_old", "ws", lookup, () => now), true);
  valid = false; // token row deleted by rotation
  now = 10_001;
  assert.equal(await isValidBotToken("cvbot_old", "ws", lookup, () => now), false);
});
