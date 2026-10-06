import { test } from "node:test";
import assert from "node:assert/strict";
import {
  detectBotSignals,
  isHostnameAuthorized,
  localhostTrackingAllowed,
  normalizeHostname,
  resolveEventHostname,
} from "@repo/analytics";
import { normalizeTrackPayload } from "../src/controllers/track.js";
import { sanitizeCrawledUrl } from "../src/controllers/track-ai-bot.js";

const policy = { domain: "example.com", allowedHostnames: ["shop.io", "*.preview.dev"], allowAllDomains: false };

test("workspace domain and its subdomains are authorized", () => {
  assert.equal(isHostnameAuthorized("example.com", policy), true);
  assert.equal(isHostnameAuthorized("www.example.com", policy), true);
  assert.equal(isHostnameAuthorized("blog.example.com", policy), true);
  assert.equal(isHostnameAuthorized("EXAMPLE.COM.", policy), true);
});

test("look-alike and unrelated hosts are rejected", () => {
  assert.equal(isHostnameAuthorized("evil.com", policy), false);
  assert.equal(isHostnameAuthorized("example.com.evil.com", policy), false);
  assert.equal(isHostnameAuthorized("notexample.com", policy), false);
  assert.equal(isHostnameAuthorized("", policy), false);
  assert.equal(isHostnameAuthorized(null, policy), false);
});

test("allowedHostnames are exact unless written as a *. wildcard", () => {
  assert.equal(isHostnameAuthorized("shop.io", policy), true);
  assert.equal(isHostnameAuthorized("a.shop.io", policy), false);
  assert.equal(isHostnameAuthorized("pr-12.preview.dev", policy), true);
  assert.equal(isHostnameAuthorized("preview.dev", policy), true);
});

test("a www. workspace domain also covers the apex and other subdomains", () => {
  const www = { domain: "www.example.org", allowedHostnames: [], allowAllDomains: false };
  assert.equal(isHostnameAuthorized("example.org", www), true);
  assert.equal(isHostnameAuthorized("app.example.org", www), true);
});

test("allowAllDomains admits any valid host; no configuration admits none", () => {
  assert.equal(isHostnameAuthorized("anything.net", { domain: null, allowedHostnames: [], allowAllDomains: true }), true);
  assert.equal(isHostnameAuthorized("anything.net", { domain: null, allowedHostnames: [], allowAllDomains: false }), false);
});

test("localhost needs an explicit opt-in and is off in production", () => {
  assert.equal(isHostnameAuthorized("localhost", policy), false);
  assert.equal(isHostnameAuthorized("localhost", policy, { allowLocalhost: true }), true);
  assert.equal(localhostTrackingAllowed({ NODE_ENV: "production" }), false);
  assert.equal(localhostTrackingAllowed({ RENDER: "true" }), false);
  assert.equal(localhostTrackingAllowed({ RENDER: "true", TRACKING_ALLOW_LOCALHOST: "true" }), true);
  assert.equal(localhostTrackingAllowed({}), true);
});

test("event hostname comes from the page URL and must match a browser Origin", () => {
  assert.deepEqual(resolveEventHostname("https://Blog.Example.com/a?b=1", "https://blog.example.com"), {
    ok: true,
    hostname: "blog.example.com",
  });
  assert.deepEqual(resolveEventHostname("https://example.com/", "https://evil.com"), {
    ok: false,
    reason: "origin_mismatch",
  });
  assert.equal(resolveEventHostname("https://example.com/", null).ok, true);
  assert.equal(resolveEventHostname("javascript:alert(1)", null).ok, false);
  assert.equal(resolveEventHostname("not a url", null).ok, false);
});

test("normalizeHostname strips scheme, port and path", () => {
  assert.equal(normalizeHostname("https://Example.com:8443/x"), "example.com");
  assert.equal(normalizeHostname("example.com:3000"), "example.com");
  assert.equal(normalizeHostname("example.com/path"), "example.com");
  assert.equal(normalizeHostname("bad host"), null);
});

test("data-domain (payload domain/hostname) never overrides the page URL host", () => {
  const normalized = normalizeTrackPayload({
    websiteId: "tok",
    href: "https://evil.com/landing",
    domain: "example.com",
    hostname: "example.com",
    type: "pageview",
  });
  assert.equal(normalized.hostname, "evil.com");
});

test("bot detection: canonical crawler classification comes first", () => {
  const gpt = detectBotSignals({ userAgent: "Mozilla/5.0 (compatible; GPTBot/1.1; +https://openai.com/gptbot)" });
  assert.equal(gpt.isBot, true);
  assert.equal(gpt.reason, "known_crawler");
  assert.equal(gpt.crawler?.category, "training_crawler");

  const answer = detectBotSignals({ userAgent: "Mozilla/5.0 (compatible; ChatGPT-User/1.0; +https://openai.com/bot)" });
  assert.equal(answer.crawler?.category, "answer_agent");
});

test("bot detection: referer, trusted IP and HEAD signals", () => {
  const chrome = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
  assert.equal(detectBotSignals({ userAgent: chrome }).isBot, false);
  assert.equal(detectBotSignals({ userAgent: chrome, referer: "https://urlsand.com/x" }).reason, "referer");
  assert.equal(detectBotSignals({ userAgent: chrome, ip: "52.112.74.60" }).reason, "ip");
  assert.equal(detectBotSignals({ userAgent: chrome, ip: "57.144.1.1" }).reason, "ip");
  assert.equal(detectBotSignals({ userAgent: chrome, method: "HEAD" }).reason, "head_request");
  // loopback is not a bot signal: with a trusted IP it only occurs in local dev
  assert.equal(detectBotSignals({ userAgent: chrome, ip: "127.0.0.1" }).isBot, false);
});

test("crawled URLs lose their query string and fragment", () => {
  assert.deepEqual(sanitizeCrawledUrl("https://Example.com/Pricing?token=secret#x"), {
    url: "https://example.com/Pricing",
    hostname: "example.com",
    page: "/pricing",
  });
});

test("legacy SDK domain override replaces the URL host (and port) consistently", () => {
  assert.deepEqual(sanitizeCrawledUrl("http://localhost:3000/a?b=1", "Shop.Example.com"), {
    url: "http://shop.example.com/a",
    hostname: "shop.example.com",
    page: "/a",
  });
  assert.equal(sanitizeCrawledUrl("ftp://example.com/a"), null);
  assert.equal(sanitizeCrawledUrl("https://example.com/a", "bad host"), null);
});
