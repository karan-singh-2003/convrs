import { test, expect } from "@playwright/test";
import { prisma } from "../fixtures/db";
import { createTrackingWorkspace, createStripeIntegration, randomToken } from "../fixtures/seed";
import { buildPageviewPayload, REAL_CHROME_UA } from "../fixtures/track";
import {
  signStripePayload,
  buildCheckoutSessionCompletedPayload,
} from "../fixtures/stripe-signature";
import {
  INGEST_BASE_URL,
  STRIPE_WEBHOOK_SECRET,
  TINYBIRDS_API_URL,
  TINYBIRDS_API_KEY,
} from "../fixtures/env";

// Tagged @tinybird and isolated into its own Playwright project
// (playwright.config.ts) specifically so `pnpm test` never depends on a
// local Tinybird instance being up. Run explicitly via `pnpm test:tinybird`.
//
// This is the one suite that talks to real Tinybird: it needs the visitor's
// pageview to have actually been ingested and become queryable before firing
// the revenue webhook, which the app's own attemptAttribution() only waits
// up to ~2.5s for. We poll longer here since we don't control Tinybird's
// ingest latency.

async function isTinybirdReachable(): Promise<boolean> {
  try {
    const res = await fetch(`${TINYBIRDS_API_URL}/v0/pipes`, {
      headers: { Authorization: `Bearer ${TINYBIRDS_API_KEY}` },
      signal: AbortSignal.timeout(3000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function isVisitorQueryable(workspaceId: string, visitorId: string): Promise<boolean> {
  const params = new URLSearchParams({ workspaceId, visitorId, limit: "1" });
  const res = await fetch(
    `${TINYBIRDS_API_URL}/v0/pipes/v1_customer_attribution.json?${params}`,
    { headers: { Authorization: `Bearer ${TINYBIRDS_API_KEY}` } }
  );
  if (!res.ok) return false;
  const body = await res.json();
  return (body?.data ?? []).length > 0;
}

test.describe("UTM attribution end-to-end @tinybird", () => {
  test.beforeAll(async () => {
    const reachable = await isTinybirdReachable();
    test.skip(
      !reachable,
      `Local Tinybird (${TINYBIRDS_API_URL}) is not reachable — this environment has no local Tinybird instance running. ` +
        "This is an environmental gap, not an application failure; see the e2e README."
    );
  });

  test("a UTM-tagged pageview attributes a matching revenue webhook", async ({ request }) => {
    const ws = await createTrackingWorkspace("utm-attribution");
    await createStripeIntegration(ws.id, STRIPE_WEBHOOK_SECRET);

    const visitorId = randomToken("vid");
    const pageviewPayload = {
      ...buildPageviewPayload({ websiteId: ws.projectToken! }),
      visitorId,
      href: "https://example.com/pricing?utm_source=e2e&utm_medium=test&utm_campaign=fixtures",
    };

    const trackResponse = await request.post(`${INGEST_BASE_URL}/api/track`, {
      headers: { "user-agent": REAL_CHROME_UA },
      data: pageviewPayload,
    });
    expect(trackResponse.ok()).toBe(true);

    await expect
      .poll(() => isVisitorQueryable(ws.id, visitorId), {
        message: "waiting for the pageview to become queryable in Tinybird",
        timeout: 20_000,
        intervals: [1000, 2000, 3000],
      })
      .toBe(true);

    const eventId = randomToken("evt");
    const payload = buildCheckoutSessionCompletedPayload({
      sessionId: randomToken("cs"),
      eventId,
      amountTotal: 9900,
      currency: "usd",
      customerEmail: "e2e-attributed-payer@example.com",
      visitorId,
    });
    const { signatureHeader } = signStripePayload(payload, STRIPE_WEBHOOK_SECRET);

    const webhookResponse = await request.post(
      `${INGEST_BASE_URL}/api/stripe/webhook/${ws.id}`,
      {
        headers: {
          "content-type": "application/json",
          "stripe-signature": signatureHeader,
        },
        data: payload,
      }
    );
    expect(webhookResponse.ok()).toBe(true);

    const payment = await prisma.payment.findUniqueOrThrow({
      where: { provider_externalEventId: { provider: "stripe", externalEventId: eventId } },
    });
    expect(payment.attributionStatus).toBe("attributed");
    expect(payment.visitorId).toBe(visitorId);
  });

  test("a webhook with no matching visitor is recorded but left unattributed, not dropped", async ({
    request,
  }) => {
    const ws = await createTrackingWorkspace("utm-unattributed");
    await createStripeIntegration(ws.id, STRIPE_WEBHOOK_SECRET);

    const eventId = randomToken("evt");
    const payload = buildCheckoutSessionCompletedPayload({
      sessionId: randomToken("cs"),
      eventId,
      amountTotal: 1500,
      currency: "usd",
      customerEmail: "e2e-unattributed-payer@example.com",
      // no visitorId at all
    });
    const { signatureHeader } = signStripePayload(payload, STRIPE_WEBHOOK_SECRET);

    const response = await request.post(`${INGEST_BASE_URL}/api/stripe/webhook/${ws.id}`, {
      headers: { "content-type": "application/json", "stripe-signature": signatureHeader },
      data: payload,
    });
    expect(response.ok()).toBe(true);

    const payment = await prisma.payment.findUniqueOrThrow({
      where: { provider_externalEventId: { provider: "stripe", externalEventId: eventId } },
    });
    expect(payment.attributionStatus).toBe("unattributed");
    expect(payment.amount).toBe(1500);
  });
});
