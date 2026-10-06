import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_ENDPOINT,
  buildEventPayload,
  decideWhetherToTrack,
  sanitizeReferrer,
  sanitizeUrl,
  sendBotEvent,
} from "../src";
import type { ConvrsBotConfig, FetchLike, MinimalRequest } from "../src";
import { resolveClientIp, resolveEdgeGeo } from "../src/request-utils";

const GPTBOT = "Mozilla/5.0 AppleWebKit/537.36 (compatible; GPTBot/1.1; +https://openai.com/gptbot)";

function req(url: string, headers: Record<string, string> = {}, extra: Partial<MinimalRequest> = {}): MinimalRequest {
  const map = new Map(Object.entries({ "user-agent": GPTBOT, ...headers }).map(([k, v]) => [k.toLowerCase(), v]));
  return { url, method: "GET", headers: { get: (n: string) => map.get(n.toLowerCase()) ?? null }, ...extra };
}
const cfg: ConvrsBotConfig = { siteId: "site_123" };

afterEach(() => vi.unstubAllEnvs());

describe("endpoint", () => {
  it("defaults to the production ingestion route and never the retired host", () => {
    expect(DEFAULT_ENDPOINT).toBe("https://ingest.convrs.dev/api/ai-crawls");
    expect(DEFAULT_ENDPOINT).not.toContain("convrs.io");
  });

  it("posts to the default endpoint, and a custom endpoint overrides it", async () => {
    const fetchSpy = vi.fn<FetchLike>(async () => ({ ok: true, status: 202 }));
    const r = req("https://example.com/pricing");
    await sendBotEvent(r, { ...cfg, fetch: fetchSpy });
    expect(fetchSpy.mock.calls[0]![0]).toBe(DEFAULT_ENDPOINT);
    await sendBotEvent(r, { ...cfg, fetch: fetchSpy, endpoint: "http://localhost:3099/api/ai-crawls" });
    expect(fetchSpy.mock.calls[1]![0]).toBe("http://localhost:3099/api/ai-crawls");
  });
});

describe("URL sanitisation", () => {
  it("drops the query string and fragment by default", () => {
    expect(sanitizeUrl(new URL("https://example.com/a/b?token=secret&email=a@b.co#frag"))).toBe("https://example.com/a/b");
  });

  it("keeps only allow-listed query parameters", () => {
    expect(sanitizeUrl(new URL("https://example.com/a?page=2&token=secret"), ["page"])).toBe("https://example.com/a?page=2");
    expect(sanitizeUrl(new URL("https://example.com/a?x=1&y=2"), ["*"])).toBe("https://example.com/a?x=1&y=2");
  });

  it("reduces referrers to origin + path and rejects non-http schemes", () => {
    expect(sanitizeReferrer("https://news.example.org/story?id=7&session=abc")).toBe("https://news.example.org/story");
    expect(sanitizeReferrer("javascript:alert(1)")).toBeNull();
    expect(sanitizeReferrer("not a url")).toBeNull();
    expect(sanitizeReferrer(null)).toBeNull();
  });
});

describe("event payload", () => {
  it("sends only sanitised raw signals", () => {
    const r = req(
      "https://Example.com/pricing?secret=1",
      { referer: "https://google.com/search?q=private", cookie: "session=abc", authorization: "Bearer user-secret" },
      { ip: "203.0.113.9" }
    );
    const decision = decideWhetherToTrack(r, { ...cfg, ipSource: "auto" });
    const payload = buildEventPayload(r, { ...cfg, ipSource: "auto" }, decision, { statusCode: 404 });
    expect(payload).toEqual({
      siteId: "site_123",
      eventId: decision.eventId,
      domain: "example.com",
      url: "https://example.com/pricing",
      referrer: "https://google.com/search",
      method: "GET",
      sdkVersion: "1.1.0",
      bot: {
        userAgent: GPTBOT,
        ip: "203.0.113.9",
        statusCode: 404,
        source: "server-sdk",
      },
    });
    const serialized = JSON.stringify(payload);
    for (const leaked of ["secret", "session=abc", "user-secret"]) expect(serialized).not.toContain(leaked);
  });

  it("never sends a client-side classification — Convrs classifies server-side", () => {
    const r = req("https://example.com/");
    const payload = buildEventPayload(r, cfg, decideWhetherToTrack(r, cfg));
    for (const key of ["vendor", "agentName", "category", "matchType", "classifierVersion", "verification", "verificationMethod", "confidence"]) {
      expect(payload.bot).not.toHaveProperty(key);
      expect(payload).not.toHaveProperty(key);
    }
  });

  it("accepts websiteId (and the 1.0 name siteId) and bounds the User-Agent", () => {
    const r = req("https://example.com/", { "user-agent": `${GPTBOT} ${"x".repeat(5000)}` });
    const payload = buildEventPayload(r, { websiteId: "web_1" }, decideWhetherToTrack(r, { websiteId: "web_1" }));
    expect(payload.siteId).toBe("web_1");
    expect(payload.bot.userAgent.length).toBe(1024);
    expect(JSON.stringify(payload).length).toBeLessThan(16 * 1024);
  });

  it("omits statusCode when the response status is unknown, rather than inventing one", () => {
    const r = req("https://example.com/");
    const decision = decideWhetherToTrack(r, cfg);
    const payload = buildEventPayload(r, cfg, decision);
    expect("statusCode" in payload.bot).toBe(false);
  });

  it("reads the status from a Response-like object and ignores invalid codes", () => {
    const r = req("https://example.com/");
    const decision = decideWhetherToTrack(r, cfg);
    expect(buildEventPayload(r, cfg, decision, { response: { status: 301 } }).bot.statusCode).toBe(301);
    expect("statusCode" in buildEventPayload(r, cfg, decision, { statusCode: 99 }).bot).toBe(false);
    expect("statusCode" in buildEventPayload(r, cfg, decision, { statusCode: 200.5 }).bot).toBe(false);
  });

  it("a stable event id: every send of the same decision reuses it", async () => {
    const bodies: string[] = [];
    const fetchSpy: FetchLike = async (_u, init) => {
      bodies.push(String(init?.body));
      return { ok: true, status: 202 };
    };
    const r = req("https://example.com/");
    const decision = decideWhetherToTrack(r, { ...cfg, fetch: fetchSpy });
    await sendBotEvent(r, { ...cfg, fetch: fetchSpy }, decision);
    await sendBotEvent(r, { ...cfg, fetch: fetchSpy }, decision);
    expect(JSON.parse(bodies[0]!).eventId).toBe(JSON.parse(bodies[1]!).eventId);
  });

  it("an explicit domain override rewrites the reported host consistently", () => {
    const r = req("http://localhost:3000/pricing");
    const decision = decideWhetherToTrack(r, cfg);
    const payload = buildEventPayload(r, { ...cfg, domain: "Shop.Example.com:443" }, decision);
    expect(payload.domain).toBe("shop.example.com");
    expect(payload.url).toBe("https://shop.example.com/pricing".replace("https", "http"));
  });

  it("sends the bearer token only when configured, and never in the body", async () => {
    const calls: Array<{ headers?: Record<string, string>; body?: string }> = [];
    const fetchSpy: FetchLike = async (_u, init) => {
      calls.push({ headers: init?.headers, body: init?.body });
      return { ok: true, status: 202 };
    };
    await sendBotEvent(req("https://example.com/"), { ...cfg, fetch: fetchSpy, authToken: "cvrs_secret_token" });
    await sendBotEvent(req("https://example.com/"), { ...cfg, fetch: fetchSpy });
    expect(calls[0]!.headers?.Authorization).toBe("Bearer cvrs_secret_token");
    expect(calls[0]!.body).not.toContain("cvrs_secret_token");
    expect(calls[1]!.headers?.Authorization).toBeUndefined();
  });
});

describe("IP source selection", () => {
  const spoofed = {
    "cf-connecting-ip": "6.6.6.6",
    "x-forwarded-for": "7.7.7.7, 10.0.0.1",
    "x-real-ip": "8.8.8.8",
    "true-client-ip": "9.9.9.9",
    "x-vercel-forwarded-for": "5.5.5.5",
  };

  it("auto, off Vercel and without an adapter IP: reports none rather than trusting headers", () => {
    vi.stubEnv("VERCEL", "");
    expect(resolveClientIp(req("https://e.com/", spoofed), cfg)).toBeNull();
  });

  it("auto, on Vercel: uses Vercel's header", () => {
    vi.stubEnv("VERCEL", "1");
    expect(resolveClientIp(req("https://e.com/", spoofed), cfg)).toBe("5.5.5.5");
  });

  it("auto: an adapter-resolved IP (Express trust proxy) wins over headers", () => {
    vi.stubEnv("VERCEL", "");
    expect(resolveClientIp(req("https://e.com/", spoofed, { ip: "::ffff:203.0.113.4" }), cfg)).toBe("203.0.113.4");
  });

  it("auto, on Cloudflare Workers (request.cf present): uses cf-connecting-ip", () => {
    const r = req("https://example.com/", { "cf-connecting-ip": "198.51.100.4", "x-forwarded-for": "6.6.6.6" }, { cf: { colo: "BOM" } });
    expect(resolveClientIp(r, cfg)).toBe("198.51.100.4");
  });

  it("auto, off Cloudflare: a client-sent cf-connecting-ip is not trusted", () => {
    const r = req("https://example.com/", { "cf-connecting-ip": "198.51.100.4" });
    expect(resolveClientIp(r, cfg)).toBeNull();
  });

  it("explicit presets read exactly their own header", () => {
    expect(resolveClientIp(req("https://e.com/", spoofed), { ...cfg, ipSource: "cloudflare" })).toBe("6.6.6.6");
    expect(resolveClientIp(req("https://e.com/", spoofed), { ...cfg, ipSource: "x-forwarded-for" })).toBe("7.7.7.7");
    expect(resolveClientIp(req("https://e.com/", spoofed), { ...cfg, ipSource: "vercel" })).toBe("5.5.5.5");
    expect(resolveClientIp(req("https://e.com/", spoofed), { ...cfg, ipSource: "none" })).toBeNull();
  });

  it("resolveIp overrides every preset", () => {
    expect(resolveClientIp(req("https://e.com/", spoofed), { ...cfg, ipSource: "none", resolveIp: () => "1.2.3.4" })).toBe("1.2.3.4");
  });

  it("edge geo is only reported from a trusted edge", () => {
    const headers = { "x-vercel-ip-country": "DE", "x-vercel-ip-country-region": "BE", "x-vercel-ip-city": "Berlin", "cf-ipcountry": "FR" };
    expect(resolveEdgeGeo(req("https://e.com/", headers), { ...cfg, ipSource: "vercel" })).toEqual({ country: "DE", region: "BE", city: "Berlin", source: "vercel" });
    expect(resolveEdgeGeo(req("https://e.com/", headers), { ...cfg, ipSource: "cloudflare" })).toMatchObject({ country: "FR", source: "cloudflare" });
    expect(resolveEdgeGeo(req("https://e.com/", headers), { ...cfg, ipSource: "x-forwarded-for" })).toBeUndefined();
    expect(resolveEdgeGeo(req("https://e.com/", { "cf-ipcountry": "XX" }), { ...cfg, ipSource: "cloudflare" })).toBeUndefined();
  });
});

describe("failure behaviour: tracking is best-effort", () => {
  it("never throws when fetch rejects, and does not retry", async () => {
    const fetchSpy = vi.fn(async () => {
      throw new Error("network down");
    });
    const outcome = await sendBotEvent(req("https://example.com/"), { ...cfg, fetch: fetchSpy as never });
    expect(outcome).toMatchObject({ sent: false, error: "send_failed" });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("reports non-2xx as a failed send without throwing, and does not retry", async () => {
    const fetchSpy = vi.fn(async () => ({ ok: false, status: 401 }));
    const outcome = await sendBotEvent(req("https://example.com/"), { ...cfg, fetch: fetchSpy });
    expect(outcome).toMatchObject({ sent: false, httpStatus: 401, error: "send_failed" });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("aborts a hung request at the timeout instead of blocking", async () => {
    const hung: FetchLike = (_u, init) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(new Error("aborted")));
      });
    const started = Date.now();
    const outcome = await sendBotEvent(req("https://example.com/"), { ...cfg, fetch: hung, timeoutMs: 60 });
    expect(outcome).toMatchObject({ sent: false, error: "send_failed" });
    expect(Date.now() - started).toBeLessThan(1000);
  });

  it("defaults to a timeout of about one second", async () => {
    vi.useFakeTimers();
    try {
      let aborted = false;
      const hung: FetchLike = (_u, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            aborted = true;
            reject(new Error("aborted"));
          });
        });
      const pending = sendBotEvent(req("https://example.com/"), { ...cfg, fetch: hung });
      await vi.advanceTimersByTimeAsync(999);
      expect(aborted).toBe(false);
      await vi.advanceTimersByTimeAsync(2);
      expect(aborted).toBe(true);
      await pending;
    } finally {
      vi.useRealTimers();
    }
  });

  it("does nothing for non-bots and when disabled", async () => {
    const fetchSpy = vi.fn(async () => ({ ok: true, status: 202 }));
    const human = req("https://example.com/", { "user-agent": "Mozilla/5.0 (Windows NT 10.0) Chrome/120.0.0.0 Safari/537.36" });
    expect(await sendBotEvent(human, { ...cfg, fetch: fetchSpy })).toMatchObject({ sent: false, skipReason: "not_a_bot" });
    expect(await sendBotEvent(req("https://example.com/"), { ...cfg, fetch: fetchSpy, enabled: false })).toMatchObject({ sent: false, skipReason: "disabled" });
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
