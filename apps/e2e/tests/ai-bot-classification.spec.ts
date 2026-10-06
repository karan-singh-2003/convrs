import { test, expect } from "@playwright/test";
import { classifyBotUserAgent } from "@convrs/ai-bot-sdk";

// Unit coverage for the ACTUAL published @convrs/ai-bot-sdk package (the one
// apps/ingestion really imports — see packages/ai-bot-sdk/CLAUDE.md note:
// that workspace directory has no local source, it's resolved from the npm
// registry). classifyBotUserAgent() is a pure function, so this needs no
// server — it's a plain assertion suite riding on the existing Playwright
// runner rather than introducing a new one.
//
// Audit gap: this function is the entire source of truth for the AI-crawler
// vendor x category taxonomy (feeds /api/ai-crawls, bot_traffic_events, and
// the "AI-crawler / bot traffic detection" dashboard), and had zero test
// coverage before this.

test.describe("classifyBotUserAgent()", () => {
  test("exact token match: OpenAI's GPTBot (training_crawler)", () => {
    const result = classifyBotUserAgent("Mozilla/5.0 AppleWebKit/537.36 (compatible; GPTBot/1.1; +https://openai.com/gptbot)");
    expect(result).toEqual({ vendor: "OpenAI", agentName: "gptbot", category: "training_crawler" });
  });

  test("exact token match: OpenAI's ChatGPT-User (answer_agent)", () => {
    const result = classifyBotUserAgent("Mozilla/5.0 (compatible; ChatGPT-User/1.0; +https://openai.com/bot)");
    expect(result).toEqual({ vendor: "OpenAI", agentName: "chatgpt-user", category: "answer_agent" });
  });

  test("exact token match: Anthropic's ClaudeBot (training_crawler)", () => {
    const result = classifyBotUserAgent("Mozilla/5.0 (compatible; ClaudeBot/1.0; +claudebot@anthropic.com)");
    expect(result).toEqual({ vendor: "Anthropic", agentName: "claudebot", category: "training_crawler" });
  });

  test("exact token match: Perplexity's PerplexityBot (index_crawler)", () => {
    const result = classifyBotUserAgent("Mozilla/5.0 (compatible; PerplexityBot/1.0; +https://perplexity.ai/bot)");
    expect(result).toEqual({ vendor: "Perplexity", agentName: "perplexitybot", category: "index_crawler" });
  });

  test("exact token match: Google's Googlebot (index_crawler)", () => {
    const result = classifyBotUserAgent("Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)");
    expect(result).toEqual({ vendor: "Google", agentName: "googlebot", category: "index_crawler" });
  });

  test("exact token match is case-insensitive (UA lowercased before comparison)", () => {
    const result = classifyBotUserAgent("COMPATIBLE; GPTBOT/1.1");
    expect(result).toEqual({ vendor: "OpenAI", agentName: "gptbot", category: "training_crawler" });
  });

  test("fallback-hint match: an unregistered agent that names a vendor AND self-identifies as automated", () => {
    // "anthropic" isn't itself a registered token — with crawler wording /
    // a +https contact URL it falls through to FALLBACK_VENDOR_HINTS.
    const result = classifyBotUserAgent("Anthropic-Research-Crawler/1.0 (+https://anthropic.com)");
    expect(result).toEqual({ vendor: "Anthropic", agentName: "Anthropic", category: "other" });
  });

  test("a vendor name alone is not enough (desktop apps / extensions mention vendors)", () => {
    // SDK 1.1: vendor hints only apply with automation context, so a person's
    // app or browser that mentions a vendor is never labelled a crawler.
    expect(classifyBotUserAgent("SomeInternalTool/1.0 (built by anthropic research)")).toBeNull();
    expect(classifyBotUserAgent("MyGrokPoweredApp/2.0")).toBeNull();
  });

  test("unknown UA returns null, not a guessed classification", () => {
    expect(classifyBotUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36")).toBeNull();
  });

  test("a generic automated client outside the registry is reported as Other / unknown_bot", () => {
    // SDK 1.1: generic automation is no longer dropped — it lands in the
    // dashboard's "Other" bucket instead of disappearing.
    expect(classifyBotUserAgent("Pingdom.com_bot_version_1.4")).toEqual({
      vendor: "Unknown",
      agentName: "unknown_bot",
      category: "other",
    });
  });

  test("empty/missing UA returns null rather than throwing", () => {
    expect(classifyBotUserAgent("")).toBeNull();
    expect(classifyBotUserAgent(undefined)).toBeNull();
  });
});
