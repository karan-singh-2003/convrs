import { createHash, randomUUID } from "node:crypto";
import { test, expect } from "@playwright/test";
import { prisma } from "../fixtures/db";
import { createTrackingWorkspace, randomToken } from "../fixtures/seed";
import { INGEST_BASE_URL } from "../fixtures/env";

// /api/ai-crawls authentication. The public project token identifies the
// workspace; a bot/API token is optional hardening — required only when
// botTrafficRequireAuth is on (default off), but always validated when sent.
// Tokens are minted as real RestrictedToken rows (same hash and prefix as
// Settings -> API tokens) rather than inventing a new credential type.

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

  test("an unauthenticated request still works when botTrafficRequireAuth is NOT enabled", async ({ request }) => {
    const ws = await createTrackingWorkspace("aicrawl-auth-notrequired");
    await prisma.workspace.update({ where: { id: ws.id }, data: { botTrafficRequireAuth: false } });

    const response = await request.post(`${INGEST_BASE_URL}/api/ai-crawls`, {
      data: aiCrawlPayload({ siteId: ws.projectToken!, userAgent: GPTBOT_UA }),
    });

    expect(response.status()).toBe(202);
    const body = await response.json();
    expect(body).toMatchObject({ tracked: true, authenticated: false });
  });

  test("a new workspace defaults to optional auth: the public project ID alone is enough", async ({ request }) => {
    const ws = await createTrackingWorkspace("aicrawl-auth-default");
    const stored = await prisma.workspace.findUniqueOrThrow({
      where: { id: ws.id },
      select: { botTrafficRequireAuth: true },
    });
    expect(stored.botTrafficRequireAuth).toBe(false);

    const response = await request.post(`${INGEST_BASE_URL}/api/ai-crawls`, {
      data: aiCrawlPayload({ siteId: ws.projectToken!, userAgent: GPTBOT_UA }),
    });
    expect(response.status()).toBe(202);
    expect(await response.json()).toMatchObject({ tracked: true, authenticated: false });
  });

  test("auth optional: a valid token marks the event authenticated", async ({ request }) => {
    const ws = await createTrackingWorkspace("aicrawl-auth-optional-valid");
    const token = await mintBotToken(ws.id);
    const response = await request.post(`${INGEST_BASE_URL}/api/ai-crawls`, {
      headers: { Authorization: `Bearer ${token}` },
      data: aiCrawlPayload({ siteId: ws.projectToken!, userAgent: GPTBOT_UA }),
    });
    expect(response.status()).toBe(202);
    expect(await response.json()).toMatchObject({ tracked: true, authenticated: true });
  });

  test("auth optional: a supplied but invalid or other-workspace token is still rejected", async ({ request }) => {
    const ws = await createTrackingWorkspace("aicrawl-auth-optional-bad");
    const otherWs = await createTrackingWorkspace("aicrawl-auth-optional-other");
    const otherToken = await mintBotToken(otherWs.id);

    for (const authorization of [`Bearer cvbot_${randomToken("bogus")}`, `Bearer ${otherToken}`]) {
      const response = await request.post(`${INGEST_BASE_URL}/api/ai-crawls`, {
        headers: { Authorization: authorization },
        data: aiCrawlPayload({ siteId: ws.projectToken!, userAgent: GPTBOT_UA }),
      });
      expect(response.status()).toBe(401);
    }
  });
});

// Most tests below authenticate like a hardened install, with auth required
// explicitly so they don't depend on the schema default.
async function authedCrawlWorkspace(prefix: string) {
  const ws = await createTrackingWorkspace(prefix);
  await prisma.workspace.update({ where: { id: ws.id }, data: { botTrafficRequireAuth: true } });
  const token = await mintBotToken(ws.id);
  return { ws, auth: { Authorization: `Bearer ${token}` } };
}

async function usageFor(workspaceId: string): Promise<number> {
  const ws = await prisma.workspace.findUniqueOrThrow({ where: { id: workspaceId }, select: { usage: true } });
  return ws.usage;
}

test.describe("/api/ai-crawls classification cannot be overridden by the client", () => {
  test("a spoofed vendor/category/isBot payload is ignored — server derives from the raw User-Agent", async ({
    request,
  }) => {
    const { ws, auth } = await authedCrawlWorkspace("aicrawl-spoof");

    const response = await request.post(`${INGEST_BASE_URL}/api/ai-crawls`, {
      headers: auth,
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
    expect(body).toMatchObject({ success: true, tracked: true, category: "training_crawler", vendor: "OpenAI" });
  });

  test("a genuinely non-AI User-Agent is correctly not tracked as a bot, regardless of payload claims", async ({
    request,
  }) => {
    const { ws, auth } = await authedCrawlWorkspace("aicrawl-nonbot");

    const response = await request.post(`${INGEST_BASE_URL}/api/ai-crawls`, {
      headers: auth,
      data: aiCrawlPayload({
        siteId: ws.projectToken!,
        userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36",
        extra: { vendor: "OpenAI", category: "training_crawler", isBot: true },
      }),
    });

    expect(response.status()).toBe(202);
    const body = await response.json();
    expect(body).toMatchObject({ success: true, tracked: false, reason: "not_a_bot" });
    expect(await usageFor(ws.id)).toBe(0);
  });

  test("with auth required, an unauthenticated attempt is rejected before anything is classified", async ({
    request,
  }) => {
    const ws = await createTrackingWorkspace("aicrawl-unauth-classify");
    await prisma.workspace.update({ where: { id: ws.id }, data: { botTrafficRequireAuth: true } });

    const response = await request.post(`${INGEST_BASE_URL}/api/ai-crawls`, {
      data: aiCrawlPayload({ siteId: ws.projectToken!, userAgent: GPTBOT_UA }),
    });

    expect(response.status()).toBe(401);
    expect(response.headers()["www-authenticate"]).toContain("Bearer");
    expect(await usageFor(ws.id)).toBe(0);
  });
});

test.describe("/api/ai-crawls hardening", () => {
  test("lower-case 'bearer' scheme is accepted (normalized like the public API)", async ({ request }) => {
    const ws = await createTrackingWorkspace("aicrawl-bearer-case");
    const token = await mintBotToken(ws.id);

    const response = await request.post(`${INGEST_BASE_URL}/api/ai-crawls`, {
      headers: { Authorization: `bearer ${token}` },
      data: aiCrawlPayload({ siteId: ws.projectToken!, userAgent: GPTBOT_UA }),
    });
    expect(response.status()).toBe(202);
  });

  test("an expired token is rejected", async ({ request }) => {
    const ws = await createTrackingWorkspace("aicrawl-expired");
    const token = await mintBotToken(ws.id);
    await prisma.restrictedToken.updateMany({
      where: { workspaceId: ws.id },
      data: { expires: new Date(Date.now() - 60_000) },
    });

    const response = await request.post(`${INGEST_BASE_URL}/api/ai-crawls`, {
      headers: { Authorization: `Bearer ${token}` },
      data: aiCrawlPayload({ siteId: ws.projectToken!, userAgent: GPTBOT_UA }),
    });
    expect(response.status()).toBe(401);
  });

  test("events for a host the workspace does not own are rejected and not counted", async ({ request }) => {
    const { ws, auth } = await authedCrawlWorkspace("aicrawl-hostname");

    const response = await request.post(`${INGEST_BASE_URL}/api/ai-crawls`, {
      headers: auth,
      data: { ...aiCrawlPayload({ siteId: ws.projectToken!, userAgent: GPTBOT_UA }), url: "https://evil.com/x" },
    });

    expect(response.status()).toBe(403);
    expect((await response.json()).code).toBe("hostname_not_allowed");
    expect(await usageFor(ws.id)).toBe(0);
  });

  test("subdomains and allowedHostnames are accepted", async ({ request }) => {
    const { ws, auth } = await authedCrawlWorkspace("aicrawl-allowed");
    await prisma.workspace.update({ where: { id: ws.id }, data: { allowedHostnames: ["docs.partner.io"] } });

    for (const url of ["https://blog.example.com/a", "https://docs.partner.io/b"]) {
      const response = await request.post(`${INGEST_BASE_URL}/api/ai-crawls`, {
        headers: auth,
        data: { ...aiCrawlPayload({ siteId: ws.projectToken!, userAgent: GPTBOT_UA }), url },
      });
      expect(response.status(), url).toBe(202);
    }
    expect(await usageFor(ws.id)).toBe(0); // bot events use the daily bot cap, not the plan quota
  });

  test("a repeated SDK eventId is counted once", async ({ request }) => {
    const { ws, auth } = await authedCrawlWorkspace("aicrawl-idem");
    const eventId = randomUUID();
    const data = { ...aiCrawlPayload({ siteId: ws.projectToken!, userAgent: GPTBOT_UA }), eventId };

    const first = await request.post(`${INGEST_BASE_URL}/api/ai-crawls`, { headers: auth, data });
    const second = await request.post(`${INGEST_BASE_URL}/api/ai-crawls`, { headers: auth, data });

    expect(first.status()).toBe(202);
    expect(await first.json()).toMatchObject({ tracked: true, eventId });
    expect(await second.json()).toMatchObject({ tracked: false, duplicate: true, eventId });
    expect(await usageFor(ws.id)).toBe(0);
  });

  test("a non-UUID eventId is replaced with a server-generated UUID", async ({ request }) => {
    const { ws, auth } = await authedCrawlWorkspace("aicrawl-bad-eventid");
    const response = await request.post(`${INGEST_BASE_URL}/api/ai-crawls`, {
      headers: auth,
      data: { ...aiCrawlPayload({ siteId: ws.projectToken!, userAgent: GPTBOT_UA }), eventId: "not-a-uuid" },
    });
    const body = await response.json();
    expect(response.status()).toBe(202);
    expect(body.eventId).toMatch(/^[0-9a-f-]{36}$/);
  });

  test("bot traffic never consumes the human quota, even unauthenticated and at the plan limit", async ({
    request,
  }) => {
    const ws = await createTrackingWorkspace("aicrawl-quota");
    await prisma.workspace.update({
      where: { id: ws.id },
      data: { botTrafficRequireAuth: false, usage: 0, usageLimit: 5 },
    });

    for (let i = 0; i < 8; i++) {
      const response = await request.post(`${INGEST_BASE_URL}/api/ai-crawls`, {
        data: aiCrawlPayload({ siteId: ws.projectToken!, userAgent: GPTBOT_UA }),
      });
      expect(response.status()).toBe(202);
    }
    expect(await usageFor(ws.id)).toBe(0);

    // Human quota already used up: Bot Traffic has its own allowance.
    await prisma.workspace.update({ where: { id: ws.id }, data: { usage: 5 } });
    const atLimit = await request.post(`${INGEST_BASE_URL}/api/ai-crawls`, {
      data: aiCrawlPayload({ siteId: ws.projectToken!, userAgent: GPTBOT_UA }),
    });
    expect(atLimit.status()).toBe(202);
    expect(await usageFor(ws.id)).toBe(5);
  });

  test("crawler identity verification state is reported", async ({ request }) => {
    const { ws, auth } = await authedCrawlWorkspace("aicrawl-verify");
    // 203.0.113.0/24 is TEST-NET-3 and never in OpenAI's GPTBot ranges, so a
    // completed check says "spoofed"; "unknown" only if the vendor list could
    // not be fetched in time from this machine.
    const gpt = await request.post(`${INGEST_BASE_URL}/api/ai-crawls`, {
      headers: auth,
      data: aiCrawlPayload({ siteId: ws.projectToken!, userAgent: GPTBOT_UA }),
    });
    expect(["spoofed", "unknown"]).toContain((await gpt.json()).verification);

    const claude = await request.post(`${INGEST_BASE_URL}/api/ai-crawls`, {
      headers: auth,
      data: aiCrawlPayload({
        siteId: ws.projectToken!,
        userAgent: "Mozilla/5.0 (compatible; ClaudeBot/1.0; +claudebot@anthropic.com)",
      }),
    });
    expect((await claude.json()).verification).toBe("unverifiable");
  });

  test("oversized or malformed payloads are rejected", async ({ request }) => {
    const { ws, auth } = await authedCrawlWorkspace("aicrawl-malformed");
    const huge = await request.post(`${INGEST_BASE_URL}/api/ai-crawls`, {
      headers: auth,
      data: aiCrawlPayload({ siteId: ws.projectToken!, userAgent: "x".repeat(5000) }),
    });
    expect(huge.status()).toBe(400);

    const badUrl = await request.post(`${INGEST_BASE_URL}/api/ai-crawls`, {
      headers: auth,
      data: { ...aiCrawlPayload({ siteId: ws.projectToken!, userAgent: GPTBOT_UA }), url: "javascript:alert(1)" },
    });
    expect(badUrl.status()).toBe(400);
  });
});
