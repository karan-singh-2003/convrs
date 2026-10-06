import { describe, expect, it } from "vitest";
import { decideWhetherToTrack, isAlwaysTrackedPath, matchesExcludedPath } from "../src";
import type { ConvrsBotConfig, MinimalRequest } from "../src";

const GPTBOT = "Mozilla/5.0 AppleWebKit/537.36 (compatible; GPTBot/1.1; +https://openai.com/gptbot)";
const CHROME =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

function req(url: string, headers: Record<string, string> = {}, method = "GET"): MinimalRequest {
  const map = new Map(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v]));
  return { url, method, headers: { get: (n: string) => map.get(n.toLowerCase()) ?? null } };
}
const cfg: ConvrsBotConfig = { siteId: "site_123" };

describe("crawler-facing files stay trackable", () => {
  it.each(["/robots.txt", "/llms.txt", "/llms-full.txt", "/sitemap.xml", "/sitemap-0.xml", "/sitemap_index.xml", "/sitemaps/blog.xml", "/news-sitemap.xml"])(
    "%s is tracked for a crawler even though txt/xml are ignored extensions",
    (path) => {
      expect(isAlwaysTrackedPath(path)).toBe(true);
      expect(decideWhetherToTrack(req(`https://example.com${path}`, { "user-agent": GPTBOT }), cfg).shouldTrack).toBe(true);
    }
  );

  it("tracks markdown content files and ordinary pages", () => {
    expect(decideWhetherToTrack(req("https://example.com/docs/guide.md", { "user-agent": GPTBOT }), cfg).shouldTrack).toBe(true);
    expect(decideWhetherToTrack(req("https://example.com/blog/post.mdx", { "user-agent": GPTBOT }), cfg).shouldTrack).toBe(true);
    expect(decideWhetherToTrack(req("https://example.com/pricing", { "user-agent": GPTBOT }), cfg).shouldTrack).toBe(true);
  });

  it("does not track framework or static assets, even for a crawler", () => {
    for (const path of ["/_next/static/chunk.js", "/_next/image?url=%2Fa.png&w=64", "/favicon.ico", "/images/logo.png", "/api/health", "/styles.css", "/notes.txt"]) {
      expect(decideWhetherToTrack(req(`https://example.com${path}`, { "user-agent": GPTBOT }), cfg).shouldTrack, path).toBe(false);
    }
  });

  it("skips sub-resource fetches", () => {
    const d = decideWhetherToTrack(req("https://example.com/pricing", { "user-agent": GPTBOT, "sec-fetch-dest": "image" }), cfg);
    expect(d).toMatchObject({ shouldTrack: false, skipReason: "static_asset_fetch" });
  });
});

describe("decideWhetherToTrack", () => {
  it("does not track humans", () => {
    expect(decideWhetherToTrack(req("https://example.com/", { "user-agent": CHROME }), cfg)).toMatchObject({
      shouldTrack: false,
      skipReason: "not_a_bot",
    });
  });

  it("tracks generic bots as other / unknown_bot", () => {
    const d = decideWhetherToTrack(req("https://example.com/", { "user-agent": "curl/8.4.0" }), cfg);
    expect(d.shouldTrack).toBe(true);
    expect(d.bot).toMatchObject({ agentName: "unknown_bot", category: "other" });
  });

  it("skipOtherBots drops generic bots but keeps AI crawlers", () => {
    const c = { ...cfg, skipOtherBots: true };
    expect(decideWhetherToTrack(req("https://example.com/", { "user-agent": "curl/8.4.0" }), c).shouldTrack).toBe(false);
    expect(decideWhetherToTrack(req("https://example.com/", { "user-agent": GPTBOT }), c).shouldTrack).toBe(true);
  });

  it("honours the category skip switches", () => {
    const d = decideWhetherToTrack(req("https://example.com/", { "user-agent": GPTBOT }), { ...cfg, skipTrainingCrawlers: true });
    expect(d.skipReason).toBe("training_crawler_skipped");
  });

  it("accepts the DataFast-style disable* option names", () => {
    const ua = (token: string) => `Mozilla/5.0 (compatible; ${token}; +https://example.com/bot)`;
    const at = (agent: string, c: ConvrsBotConfig) =>
      decideWhetherToTrack(req("https://example.com/", { "user-agent": agent }), { ...cfg, ...c }).skipReason;
    expect(at(GPTBOT, { disableTrainingCrawlers: true })).toBe("training_crawler_skipped");
    expect(at(ua("ChatGPT-User/1.0"), { disableAnswerFetch: true })).toBe("answer_agent_skipped");
    expect(at(ua("Googlebot/2.1"), { disableSearchCrawlers: true })).toBe("index_crawler_skipped");
    expect(at(GPTBOT, { disableAnswerFetch: true, disableSearchCrawlers: true })).toBeUndefined();
  });

  it("only tracks configured methods", () => {
    expect(decideWhetherToTrack(req("https://example.com/", { "user-agent": GPTBOT }, "POST"), cfg).skipReason).toBe("method_not_tracked");
  });

  it("requires a siteId and respects enabled:false", () => {
    expect(decideWhetherToTrack(req("https://example.com/", { "user-agent": GPTBOT }), { siteId: "" }).skipReason).toBe("missing_site_id");
    expect(decideWhetherToTrack(req("https://example.com/", { "user-agent": GPTBOT }), { ...cfg, enabled: false }).skipReason).toBe("disabled");
  });

  it("assigns a distinct UUID event id per tracked request", () => {
    const a = decideWhetherToTrack(req("https://example.com/", { "user-agent": GPTBOT }), cfg);
    const b = decideWhetherToTrack(req("https://example.com/", { "user-agent": GPTBOT }), cfg);
    expect(a.eventId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(a.eventId).not.toBe(b.eventId);
  });

  it("excludePaths prevents double reporting of handler-tracked routes", () => {
    const c = { ...cfg, excludePaths: ["/llms.txt", "/internal/"] };
    expect(decideWhetherToTrack(req("https://example.com/llms.txt", { "user-agent": GPTBOT }), c).skipReason).toBe("excluded_path");
    expect(decideWhetherToTrack(req("https://example.com/internal/a", { "user-agent": GPTBOT }), c).skipReason).toBe("excluded_path");
    expect(decideWhetherToTrack(req("https://example.com/llms-full.txt", { "user-agent": GPTBOT }), c).shouldTrack).toBe(true);
    expect(matchesExcludedPath("/internalx", ["/internal/"])).toBe(false);
  });

  it("rejects over-long URLs and non-http schemes", () => {
    expect(decideWhetherToTrack(req(`https://example.com/${"a".repeat(9000)}`, { "user-agent": GPTBOT }), cfg).skipReason).toBe("url_too_long");
    expect(decideWhetherToTrack(req("ftp://example.com/x", { "user-agent": GPTBOT }), cfg).skipReason).toBe("invalid_url");
  });
});
