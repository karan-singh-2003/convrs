import { describe, expect, it } from "vitest";
import { AGENTS, CLASSIFIER_VERSION, classifyBotUserAgent, classifyUserAgent, getAgentByToken } from "../src";

const CHROME =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

describe("exact crawler tokens", () => {
  const cases: Array<[string, string, string, string]> = [
    ["Mozilla/5.0 AppleWebKit/537.36 (compatible; GPTBot/1.1; +https://openai.com/gptbot)", "OpenAI", "gptbot", "training_crawler"],
    ["Mozilla/5.0 AppleWebKit/537.36 (compatible; ChatGPT-User/1.0; +https://openai.com/bot)", "OpenAI", "chatgpt-user", "answer_agent"],
    ["Mozilla/5.0 AppleWebKit/537.36 (compatible; OAI-SearchBot/1.0; +https://openai.com/searchbot)", "OpenAI", "oai-searchbot", "index_crawler"],
    ["Mozilla/5.0 AppleWebKit/537.36 (compatible; ClaudeBot/1.0; +claudebot@anthropic.com)", "Anthropic", "claudebot", "training_crawler"],
    ["Mozilla/5.0 AppleWebKit/537.36 (compatible; Claude-User/1.0; +Claude-User@anthropic.com)", "Anthropic", "claude-user", "answer_agent"],
    ["Mozilla/5.0 AppleWebKit/537.36 (compatible; Claude-SearchBot/1.0)", "Anthropic", "claude-searchbot", "index_crawler"],
    ["Mozilla/5.0 (compatible; PerplexityBot/1.0; +https://perplexity.ai/perplexitybot)", "Perplexity", "perplexitybot", "index_crawler"],
    ["Mozilla/5.0 AppleWebKit/537.36 (compatible; Perplexity-User/1.0; +https://perplexity.ai/perplexity-user)", "Perplexity", "perplexity-user", "answer_agent"],
    ["Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)", "Google", "googlebot", "index_crawler"],
    ["Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)", "Microsoft", "bingbot", "index_crawler"],
    ["Mozilla/5.0 (Macintosh) AppleWebKit/605.1.15 (Applebot/0.1; +http://www.apple.com/go/applebot)", "Apple", "applebot", "index_crawler"],
    ["Mozilla/5.0 (compatible; Bytespider; spider-feedback@bytedance.com)", "ByteDance", "bytespider", "training_crawler"],
    ["CCBot/2.0 (https://commoncrawl.org/faq/)", "Common Crawl", "ccbot", "training_crawler"],
    ["Mozilla/5.0 (compatible; GoogleOther)", "Google", "googleother", "other"],
    ["Mozilla/5.0 (compatible; meta-externalagent/1.1 (+https://developers.facebook.com/docs/sharing/webmasters/crawler))", "Meta", "meta-externalagent", "training_crawler"],
  ];
  it.each(cases)("%s", (ua, vendor, agentName, category) => {
    expect(classifyBotUserAgent(ua)).toEqual({ vendor, agentName, category });
    expect(classifyUserAgent(ua)?.matchType).toBe("exact");
  });

  it("is case-insensitive", () => {
    expect(classifyBotUserAgent("COMPATIBLE; GPTBOT/1.1")?.agentName).toBe("gptbot");
  });

  it("the most specific token wins over a shorter one", () => {
    expect(classifyBotUserAgent("X OAI-SearchBot/1.0 GPTBot-adjacent")?.agentName).toBe("oai-searchbot");
  });

  it("does not match a token glued inside a longer word", () => {
    expect(classifyBotUserAgent("Mozilla/5.0 MyGrokPoweredApp/2.0")).toBeNull();
  });

  it("carries registry metadata and the classifier version", () => {
    const result = classifyUserAgent("Mozilla/5.0 (compatible; GPTBot/1.1)");
    expect(result?.name).toBe("GPTBot");
    expect(result?.verification.method).toBe("ip_ranges");
    expect(result?.verification.ipRangeUrls?.[0]).toMatch(/^https:\/\//);
    expect(result?.classifierVersion).toBe(CLASSIFIER_VERSION);
  });
});

describe("registry hygiene", () => {
  it("never lists robots.txt control tokens as crawler UAs", () => {
    const tokens = AGENTS.map((a) => a.token);
    expect(tokens).not.toContain("google-extended");
    expect(tokens).not.toContain("applebot-extended");
  });

  it("classifies Applebot as indexing and GoogleOther as other (not training)", () => {
    expect(getAgentByToken("applebot")?.category).toBe("index_crawler");
    expect(getAgentByToken("googleother")?.category).toBe("other");
  });

  it("has unique tokens", () => {
    const tokens = AGENTS.map((a) => a.token);
    expect(new Set(tokens).size).toBe(tokens.length);
  });

  it("every ip_ranges agent names an https range URL; every rdns agent a suffix", () => {
    for (const agent of AGENTS) {
      if (agent.verification.method === "ip_ranges") {
        expect(agent.verification.ipRangeUrls?.length, agent.token).toBeGreaterThan(0);
        for (const url of agent.verification.ipRangeUrls!) expect(url).toMatch(/^https:\/\//);
      }
      if (agent.verification.method === "rdns") {
        expect(agent.verification.rdnsSuffixes?.length, agent.token).toBeGreaterThan(0);
      }
    }
  });
});

describe("generic bots", () => {
  it.each([
    "curl/8.4.0",
    "python-requests/2.31.0",
    "Go-http-client/1.1",
    "Wget/1.21",
    "Pingdom.com_bot_version_1.4_(http://www.pingdom.com/)",
    "Mozilla/5.0 (compatible; SomeNewScraper/1.0)",
    "Mozilla/5.0 (X11; Linux x86_64) HeadlessChrome/120.0.0.0 Safari/537.36",
    "node-fetch/1.0 (+https://github.com/bitinn/node-fetch)",
    "axios/1.6.0",
  ])("%s -> other / unknown_bot", (ua) => {
    const result = classifyUserAgent(ua);
    expect(result).toMatchObject({ vendor: "Unknown", agentName: "unknown_bot", category: "other", matchType: "generic" });
  });
});

describe("ordinary browsers are never bots", () => {
  it.each([
    CHROME,
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0",
    "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36 SamsungBrowser/23.0",
    // a vendor name alone must not turn a person's browser or desktop app into a crawler
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Claude/0.12.0 Chrome/120.0.0.0 Electron/28.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Copilot/1.0",
    "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36 GSA/14.0 Google",
    "MyGrokPoweredApp/2.0",
    // CUBOT phones contain the substring "bot"
    "Mozilla/5.0 (Linux; Android 10; CUBOT_X30) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36",
  ])("%s", (ua) => {
    expect(classifyUserAgent(ua)).toBeNull();
  });

  it("handles empty input", () => {
    expect(classifyUserAgent("")).toBeNull();
    expect(classifyUserAgent(undefined)).toBeNull();
    expect(classifyBotUserAgent(null)).toBeNull();
  });
});

describe("constrained fallback", () => {
  it("labels an unregistered agent from a known vendor when it self-identifies as automated", () => {
    const result = classifyUserAgent("Mozilla/5.0 (compatible; Claude-FutureCrawler/1.0; +https://anthropic.com/bot)");
    expect(result).toMatchObject({ vendor: "Anthropic", category: "other", matchType: "fallback" });
  });
});
