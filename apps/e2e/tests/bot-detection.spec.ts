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
