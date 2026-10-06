import { describe, expect, it, vi } from "vitest";
import {
  createBotTrackingMiddleware,
  createExpressAICrawlerMiddleware,
  createExpressBotMiddleware,
  trackAICrawlerRequest,
  trackAICrawlerResponse,
  trackBotRequest,
  withAICrawlerTracking,
  withBotTracking,
} from "../src";
import type { ConvrsBotConfig, FetchLike, MinimalRequest } from "../src";

const GPTBOT = "Mozilla/5.0 AppleWebKit/537.36 (compatible; GPTBot/1.1; +https://openai.com/gptbot)";

function req(url: string, ua = GPTBOT): MinimalRequest {
  return { url, method: "GET", headers: { get: (n: string) => (n.toLowerCase() === "user-agent" ? ua : null) } };
}

function recorder() {
  const bodies: Array<Record<string, any>> = [];
  const fetchSpy: FetchLike = async (_u, init) => {
    bodies.push(JSON.parse(String(init?.body)));
    return { ok: true, status: 202 };
  };
  return { bodies, fetchSpy };
}

describe("waitUntil", () => {
  it("hands the send to waitUntil and returns immediately", async () => {
    const { bodies, fetchSpy } = recorder();
    const queued: Promise<unknown>[] = [];
    const cfg: ConvrsBotConfig = { siteId: "s", fetch: fetchSpy };
    const outcome = await trackBotRequest(req("https://example.com/p"), cfg, { waitUntil: (p) => queued.push(p) });
    expect(outcome).toMatchObject({ sent: false, queued: true });
    expect(queued).toHaveLength(1);
    await queued[0];
    expect(bodies[0]).toMatchObject({ siteId: "s", url: "https://example.com/p" });
  });

  it("createBotTrackingMiddleware forwards a NextFetchEvent-style context", async () => {
    const { fetchSpy } = recorder();
    const waitUntil = vi.fn();
    await createBotTrackingMiddleware({ siteId: "s", fetch: fetchSpy })(req("https://example.com/"), { waitUntil });
    expect(waitUntil).toHaveBeenCalledTimes(1);
  });
});

describe("withBotTracking (exact status from the handler)", () => {
  it("returns the handler's response untouched and reports its status", async () => {
    const { bodies, fetchSpy } = recorder();
    const queued: Promise<unknown>[] = [];
    const response = { status: 404 };
    const handler = withBotTracking(async (_r: MinimalRequest, _ctx: { waitUntil: (p: Promise<unknown>) => void }) => response, {
      siteId: "s",
      fetch: fetchSpy,
    });
    const result = await handler(req("https://example.com/llms.txt"), { waitUntil: (p) => queued.push(p) });
    expect(result).toBe(response);
    await Promise.all(queued);
    expect(bodies[0]!.bot.statusCode).toBe(404);
  });

  it("a failing tracker can never fail the customer's response", async () => {
    const handler = withBotTracking(async () => ({ status: 200 }), {
      siteId: "s",
      fetch: (async () => {
        throw new Error("boom");
      }) as never,
    });
    await expect(handler(req("https://example.com/"))).resolves.toEqual({ status: 200 });
  });
});

describe("Express adapter", () => {
  it("calls next() immediately and reports on finish with status and Express's own req.ip", async () => {
    const { bodies, fetchSpy } = recorder();
    const next = vi.fn();
    let finish: (() => void) | undefined;
    const res = {
      statusCode: 200,
      once: (_e: "finish", cb: () => void) => {
        finish = cb;
      },
    };
    createExpressBotMiddleware({ siteId: "s", fetch: fetchSpy })(
      { method: "GET", originalUrl: "/pricing?x=1", protocol: "https", ip: "203.0.113.7", headers: { host: "example.com", "user-agent": GPTBOT, "x-forwarded-for": "6.6.6.6" } },
      res,
      next
    );
    expect(next).toHaveBeenCalledTimes(1);
    expect(bodies).toHaveLength(0);
    res.statusCode = 503;
    finish!();
    await new Promise((r) => setTimeout(r, 10));
    expect(bodies[0]).toMatchObject({ url: "https://example.com/pricing", bot: { statusCode: 503, ip: "203.0.113.7" } });
  });

  it("still calls next() when tracking setup throws", () => {
    const next = vi.fn();
    createExpressBotMiddleware({ siteId: "s" })({ headers: null as never }, {}, next);
    expect(next).toHaveBeenCalledTimes(1);
  });
});

describe("request-first API: trackAICrawlerRequest / trackAICrawlerResponse", () => {
  it("Next.js proxy style: schedules on event.waitUntil and returns before the send finishes", async () => {
    let release: () => void = () => {};
    const gate = new Promise<void>((r) => (release = r));
    const bodies: unknown[] = [];
    const slowFetch: FetchLike = async (_u, init) => {
      await gate;
      bodies.push(JSON.parse(String(init?.body)));
      return { ok: true, status: 202 };
    };
    const queued: Promise<unknown>[] = [];
    const event = { waitUntil: (p: Promise<unknown>) => void queued.push(p) };

    const outcome = await trackAICrawlerRequest(req("https://example.com/docs"), event, { websiteId: "w", fetch: slowFetch });
    expect(outcome).toMatchObject({ queued: true });
    expect(bodies).toHaveLength(0); // the customer's response did not wait for Convrs
    release();
    await queued[0];
    expect(bodies).toHaveLength(1);
  });

  it("request-only tracking sends no status code (it is unknown, not invented)", async () => {
    const { bodies, fetchSpy } = recorder();
    await trackAICrawlerRequest(req("https://example.com/llms.txt"), undefined, { websiteId: "w", fetch: fetchSpy });
    expect(bodies[0]!.bot).not.toHaveProperty("statusCode");
  });

  it("response-aware tracking reports the final status code", async () => {
    const { bodies, fetchSpy } = recorder();
    await trackAICrawlerResponse(req("https://example.com/missing"), { status: 410 }, null, { websiteId: "w", fetch: fetchSpy });
    expect(bodies[0]!.bot.statusCode).toBe(410);
  });

  it("ignores humans without any network call", async () => {
    const fetchSpy = vi.fn<FetchLike>();
    const chrome = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
    const outcome = await trackAICrawlerRequest(req("https://example.com/", chrome), undefined, { websiteId: "w", fetch: fetchSpy });
    expect(outcome).toMatchObject({ sent: false, skipReason: "not_a_bot" });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("Convrs being unreachable resolves quietly", async () => {
    const down: FetchLike = async () => {
      throw new TypeError("fetch failed");
    };
    await expect(trackAICrawlerRequest(req("https://example.com/"), undefined, { websiteId: "w", fetch: down })).resolves.toMatchObject({
      sent: false,
      error: "send_failed",
    });
  });

  it("a malformed request or throwing waitUntil never throws or rejects", async () => {
    const broken = { url: "https://example.com/", method: "GET", headers: null } as unknown as MinimalRequest;
    await expect(trackAICrawlerRequest(broken, undefined, { websiteId: "w" })).resolves.toEqual({ sent: false });
    const { fetchSpy } = recorder();
    const throwingCtx = {
      waitUntil: () => {
        throw new Error("response already sent");
      },
    };
    await expect(trackAICrawlerRequest(req("https://example.com/"), throwingCtx, { websiteId: "w", fetch: fetchSpy })).resolves.toMatchObject({
      sent: true,
    });
  });

  it("withAICrawlerTracking finds Cloudflare's ctx among (request, env, ctx)", async () => {
    const { bodies, fetchSpy } = recorder();
    const queued: Promise<unknown>[] = [];
    const handler = withAICrawlerTracking(
      async (_r: MinimalRequest, _env: unknown, _ctx: { waitUntil: (p: Promise<unknown>) => void }) => ({ status: 200 }),
      { websiteId: "w", fetch: fetchSpy }
    );
    await handler(req("https://example.com/robots.txt"), {}, { waitUntil: (p) => void queued.push(p) });
    await Promise.all(queued);
    expect(bodies[0]).toMatchObject({ url: "https://example.com/robots.txt", bot: { statusCode: 200 } });
  });

  it("createExpressAICrawlerMiddleware is the Express adapter", () => {
    expect(createExpressAICrawlerMiddleware).toBe(createExpressBotMiddleware);
  });

  it("does not track without a website id", async () => {
    const fetchSpy = vi.fn<FetchLike>();
    expect(await trackAICrawlerRequest(req("https://example.com/"), undefined, { fetch: fetchSpy })).toMatchObject({
      skipReason: "missing_site_id",
    });
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
