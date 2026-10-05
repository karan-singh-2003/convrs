import { createHash, randomUUID } from "node:crypto";
import { test, expect } from "@playwright/test";
import { prisma } from "../fixtures/db";
import { createTrackingWorkspace, randomToken } from "../fixtures/seed";
import { INGEST_BASE_URL } from "../fixtures/env";

// Regression suite for the /api/ai-crawls security fix. Before this fix,
// botTrafficRequireAuth's check required a "cvbot_"-prefixed token, but
// nothing anywhere in the app ever minted one — the only tokens that exist
// are the real "cvrs_" (current) / "bc_" (legacy) API tokens minted via
// Settings -> API tokens (POST /api/tokens). So enabling botTrafficRequireAuth
// was previously a guaranteed lockout, not a real auth gate. These tests
// mint a real RestrictedToken row the same way that route does (same hash
// algorithm, same prefix) rather than inventing a new credential type.

async function mintBotToken(workspaceId: string): Promise<string> {
  const user = await prisma.user.create({
    data: { email: `${randomToken("e2e-bot")}@example.com`, name: "e2e bot token owner" },
  });
  const token = `cvrs_${randomToken("tok")}`;
  const hashedKey = createHash("sha256").update(token).digest("hex");
  await prisma.restrictedToken.create({
    data: {
      name: "e2e bot-traffic token",
      hashedKey,
      partialKey: `${token.slice(0, 10)}...${token.slice(-4)}`,
      workspaceId,
      userId: user.id,
    },
  });
  return token;
}

function aiCrawlPayload(overrides: {
  siteId: string;
  userAgent: string;
  extra?: Record<string, unknown>;
}) {
  return {
    siteId: overrides.siteId,
    url: "https://example.com/pricing",
    referrer: null,
    bot: {
      userAgent: overrides.userAgent,
      ip: "203.0.113.50",
      statusCode: 200,
      source: "server-sdk",
      ...overrides.extra,
    },
  };
}

const GPTBOT_UA = "Mozilla/5.0 AppleWebKit/537.36 (compatible; GPTBot/1.1; +https://openai.com/gptbot)";

test.describe("/api/ai-crawls authentication", () => {
  test("authenticated request succeeds when botTrafficRequireAuth is enabled", async ({ request }) => {
    const ws = await createTrackingWorkspace("aicrawl-auth-ok");
    await prisma.workspace.update({ where: { id: ws.id }, data: { botTrafficRequireAuth: true } });
    const token = await mintBotToken(ws.id);

    const response = await request.post(`${INGEST_BASE_URL}/api/ai-crawls`, {
      headers: { Authorization: `Bearer ${token}` },
      data: aiCrawlPayload({ siteId: ws.projectToken!, userAgent: GPTBOT_UA }),
    });

    expect(response.status()).toBe(202);
    const body = await response.json();
    expect(body).toMatchObject({ success: true, tracked: true, category: "training_crawler" });
  });

  test("unauthenticated request is rejected (401) when botTrafficRequireAuth is enabled", async ({ request }) => {
    const ws = await createTrackingWorkspace("aicrawl-auth-missing");
    await prisma.workspace.update({ where: { id: ws.id }, data: { botTrafficRequireAuth: true } });

    const response = await request.post(`${INGEST_BASE_URL}/api/ai-crawls`, {
      data: aiCrawlPayload({ siteId: ws.projectToken!, userAgent: GPTBOT_UA }),
    });

    expect(response.status()).toBe(401);
  });

  test("a token belonging to a DIFFERENT workspace is rejected", async ({ request }) => {
    const ws = await createTrackingWorkspace("aicrawl-auth-wrongws");
    await prisma.workspace.update({ where: { id: ws.id }, data: { botTrafficRequireAuth: true } });
    const otherWs = await createTrackingWorkspace("aicrawl-auth-otherws");
    const tokenForOtherWorkspace = await mintBotToken(otherWs.id);

    const response = await request.post(`${INGEST_BASE_URL}/api/ai-crawls`, {
      headers: { Authorization: `Bearer ${tokenForOtherWorkspace}` },
      data: aiCrawlPayload({ siteId: ws.projectToken!, userAgent: GPTBOT_UA }),
    });

    expect(response.status()).toBe(401);
  });

  test("an unauthenticated request still works when botTrafficRequireAuth is NOT enabled (unchanged behavior)", async ({
    request,
  }) => {
    const ws = await createTrackingWorkspace("aicrawl-auth-notrequired");
    await prisma.workspace.update({ where: { id: ws.id }, data: { botTrafficRequireAuth: false } });

    const response = await request.post(`${INGEST_BASE_URL}/api/ai-crawls`, {
      data: aiCrawlPayload({ siteId: ws.projectToken!, userAgent: GPTBOT_UA }),
    });

    expect(response.status()).toBe(202);
    const body = await response.json();
    expect(body.tracked).toBe(true);
  });
});

test.describe("/api/ai-crawls classification cannot be overridden by the client", () => {
  test("a spoofed vendor/category/isBot payload is ignored — server derives from the raw User-Agent", async ({
    request,
  }) => {
    const ws = await createTrackingWorkspace("aicrawl-spoof");

    const response = await request.post(`${INGEST_BASE_URL}/api/ai-crawls`, {
      data: {
        siteId: ws.projectToken!,
        url: "https://example.com/pricing",
        referrer: null,
        bot: {
          userAgent: GPTBOT_UA, // real GPTBot UA -> true classification is OpenAI / training_crawler
          ip: "203.0.113.51",
          source: "server-sdk",
          // Attempted spoofing — none of these are in the accepted schema,
          // and even if they were, the server must never use them.
          vendor: "TotallyLegitVendor",
          category: "other",
          isBot: false,
          botType: "human",
        },
      },
    });

    expect(response.status()).toBe(202);
    const body = await response.json();
    // Must reflect GPTBot's REAL category (training_crawler), not the
    // spoofed "other" the payload tried to claim.
    expect(body).toMatchObject({ success: true, tracked: true, category: "training_crawler" });
  });

  test("a genuinely non-AI User-Agent is correctly not tracked as a bot, regardless of payload claims", async ({
    request,
  }) => {
    const ws = await createTrackingWorkspace("aicrawl-nonbot");

    const response = await request.post(`${INGEST_BASE_URL}/api/ai-crawls`, {
      data: aiCrawlPayload({
        siteId: ws.projectToken!,
        userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36",
        extra: { vendor: "OpenAI", category: "training_crawler", isBot: true },
      }),
    });

    expect(response.status()).toBe(202);
    const body = await response.json();
    expect(body).toMatchObject({ success: true, tracked: false, reason: "not_a_bot" });
  });
});
