import { test, expect } from "@playwright/test";
import { prisma } from "../fixtures/db";
import { createTrackingWorkspace } from "../fixtures/seed";
import { buildPageviewPayload, REAL_CHROME_UA } from "../fixtures/track";
import { INGEST_BASE_URL } from "../fixtures/env";

// Regression suite for the detect-bot.ts fix: pre-fix, `if (ua) return
// ua.isBot || UA_BOTS.some(...)` always short-circuited (parseUserAgent()
// never returns falsy), so the referer- and IP-based checks below were dead
// code — unreachable under any input. These exercise exactly the paths that
// were unreachable, through the real running ingestion service.
//
// usage increments synchronously inside the /api/track request (Postgres,
// via prisma.workspace.update) before the response is sent, so reading it
// straight from the DB is a fast, low-flake "was this recorded" signal —
// no need to wait on Tinybird for these.

async function usageFor(workspaceId: string): Promise<number> {
  const ws = await prisma.workspace.findUniqueOrThrow({
    where: { id: workspaceId },
    select: { usage: true },
  });
  return ws.usage;
}

test.describe("bot detection (exercised through POST /api/track)", () => {
  test("referer-only bot signal is caught (was unreachable pre-fix)", async ({ request }) => {
    const ws = await createTrackingWorkspace("bot-referer");

    const response = await request.post(`${INGEST_BASE_URL}/api/track`, {
      headers: {
        "user-agent": REAL_CHROME_UA,
        referer: "https://urlsand.com/redirect?x=1",
      },
      data: buildPageviewPayload({ websiteId: ws.projectToken! }),
    });

    expect(response.ok()).toBe(true);
    expect(await usageFor(ws.id)).toBe(0);
  });

  test("IP-based bot signal is caught", async ({ request }) => {
    const ws = await createTrackingWorkspace("bot-ip");

    const response = await request.post(`${INGEST_BASE_URL}/api/track`, {
      headers: {
        "user-agent": REAL_CHROME_UA,
        "x-forwarded-for": "127.0.0.1",
      },
      data: buildPageviewPayload({ websiteId: ws.projectToken! }),
    });

    expect(response.ok()).toBe(true);
    expect(await usageFor(ws.id)).toBe(0);
  });

  test("a clean request is recorded normally (negative control)", async ({ request }) => {
    const ws = await createTrackingWorkspace("bot-clean");

    const response = await request.post(`${INGEST_BASE_URL}/api/track`, {
      headers: {
        "user-agent": REAL_CHROME_UA,
        referer: "https://example.com/",
        "x-forwarded-for": "203.0.113.42",
      },
      data: buildPageviewPayload({ websiteId: ws.projectToken! }),
    });

    expect(response.ok()).toBe(true);
    expect(await usageFor(ws.id)).toBe(1);
  });
});

// Audit gap fix: the suite above only ever exercised the referer- and
// IP-based branches of detectBot() — the UA-substring branch (UA_BOTS /
// parseUserAgent().isBot), which is what actually catches the overwhelming
// majority of real-world bot traffic (Googlebot, generic "*Bot/*" clients,
// and — incidentally, since the list has no AI-specific awareness — most AI
// crawlers too, since their UAs happen to contain the generic substring
// "bot"), had zero coverage. These close that gap through the same real
// running ingestion service, using the same usage-counter signal.
test.describe("bot detection: User-Agent substring matching (exercised through POST /api/track)", () => {
  test("Googlebot UA is caught", async ({ request }) => {
    const ws = await createTrackingWorkspace("bot-ua-googlebot");

    const response = await request.post(`${INGEST_BASE_URL}/api/track`, {
      headers: {
        "user-agent": "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
      },
      data: buildPageviewPayload({ websiteId: ws.projectToken! }),
    });

    expect(response.ok()).toBe(true);
    expect(await usageFor(ws.id)).toBe(0);
  });

  test("a generic '*Bot/1.0' UA is caught", async ({ request }) => {
    const ws = await createTrackingWorkspace("bot-ua-generic");

    const response = await request.post(`${INGEST_BASE_URL}/api/track`, {
      headers: { "user-agent": "SomeBot/1.0" },
      data: buildPageviewPayload({ websiteId: ws.projectToken! }),
    });

    expect(response.ok()).toBe(true);
    expect(await usageFor(ws.id)).toBe(0);
  });

  test("a crawler-style UA is caught", async ({ request }) => {
    const ws = await createTrackingWorkspace("bot-ua-crawler");

    const response = await request.post(`${INGEST_BASE_URL}/api/track`, {
      headers: { "user-agent": "Mozilla/5.0 (compatible; SomeCrawler/2.0; +https://example.com/crawler)" },
      data: buildPageviewPayload({ websiteId: ws.projectToken! }),
    });

    expect(response.ok()).toBe(true);
    expect(await usageFor(ws.id)).toBe(0);
  });

  // The main /api/track pipeline has no AI-specific taxonomy at all (that
  // lives entirely in the separate @convrs/ai-bot-sdk / /api/ai-crawls
  // system — see ai-bot-classification.spec.ts and ai-crawl-auth.spec.ts).
  // It still correctly excludes AI crawlers from regular analytics, purely
  // because their UAs happen to contain the generic substring "bot" — this
  // locks that observed behavior in as a regression test.
  test("GPTBot UA is caught by the generic bot filter (no AI-specific logic involved)", async ({ request }) => {
    const ws = await createTrackingWorkspace("bot-ua-gptbot");

    const response = await request.post(`${INGEST_BASE_URL}/api/track`, {
      headers: {
        "user-agent": "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; GPTBot/1.1; +https://openai.com/gptbot",
      },
      data: buildPageviewPayload({ websiteId: ws.projectToken! }),
    });

    expect(response.ok()).toBe(true);
    expect(await usageFor(ws.id)).toBe(0);
  });

  // Audit fix: "answer agent" AI UAs (an AI assistant fetching a page a user
  // shared in a live chat, e.g. Claude-User/ChatGPT-User/Copilot) don't
  // contain the substring "bot" the way crawlers do, so bots-list.ts's stale
  // AI section previously let them straight through as ordinary human
  // traffic. Reconciled against @convrs/ai-bot-sdk's registry — this proves
  // the closed gap through the real pipeline, not just the list itself.
  test("Claude-User (Anthropic answer-agent UA, no 'bot' substring) is now caught", async ({ request }) => {
    const ws = await createTrackingWorkspace("bot-ua-claude-user");

    const response = await request.post(`${INGEST_BASE_URL}/api/track`, {
      headers: {
        "user-agent": "Mozilla/5.0 (compatible; Claude-User/1.0; +https://www.anthropic.com/claude-user)",
      },
      data: buildPageviewPayload({ websiteId: ws.projectToken! }),
    });

    expect(response.ok()).toBe(true);
    expect(await usageFor(ws.id)).toBe(0);
  });
});

// Audit fix: the response body used to hardcode `recorded: true`
// unconditionally, even when recordEvent() silently dropped the event as a
// bot — identical response either way, nothing in the contract distinguished
// them. No existing caller (tracker, @convrs/sdk) reads this field, so
// fixing its accuracy is behavior-preserving for real clients.
test.describe("POST /api/track response accuracy: `recorded` reflects what actually happened", () => {
  test("a bot-dropped event reports recorded: false", async ({ request }) => {
    const ws = await createTrackingWorkspace("bot-recorded-false");

    const response = await request.post(`${INGEST_BASE_URL}/api/track`, {
      headers: {
        "user-agent": "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
      },
      data: buildPageviewPayload({ websiteId: ws.projectToken! }),
    });

    expect(response.ok()).toBe(true);
    const body = await response.json();
    expect(body.recorded).toBe(false);
    expect(await usageFor(ws.id)).toBe(0);
  });

  test("a genuinely stored event reports recorded: true", async ({ request }) => {
    const ws = await createTrackingWorkspace("bot-recorded-true");

    const response = await request.post(`${INGEST_BASE_URL}/api/track`, {
      headers: {
        "user-agent": REAL_CHROME_UA,
        referer: "https://example.com/",
        "x-forwarded-for": "203.0.113.60",
      },
      data: buildPageviewPayload({ websiteId: ws.projectToken! }),
    });

    expect(response.ok()).toBe(true);
    const body = await response.json();
    expect(body.recorded).toBe(true);
    expect(await usageFor(ws.id)).toBe(1);
  });
});
