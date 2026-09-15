import { test, expect } from "@playwright/test";
import { prisma } from "../fixtures/db";
import { createBillingTestWorkspace, randomToken } from "../fixtures/seed";
import { buildPageviewPayload, REAL_CHROME_UA } from "../fixtures/track";
import { INGEST_BASE_URL } from "../fixtures/env";

async function track(request: import("@playwright/test").APIRequestContext, websiteId: string) {
  return request.post(`${INGEST_BASE_URL}/api/track`, {
    headers: { "user-agent": REAL_CHROME_UA },
    data: buildPageviewPayload({ websiteId, eventId: randomToken("evt") }),
  });
}

async function usageFor(workspaceId: string): Promise<number> {
  const ws = await prisma.workspace.findUniqueOrThrow({
    where: { id: workspaceId },
    select: { usage: true },
  });
  return ws.usage;
}

const DAY_MS = 24 * 60 * 60 * 1000;

test.describe("billing enforcement — usage-limit atomicity (concurrent requests)", () => {
  // Regression for the check-then-act race in apps/ingestion/src/controllers/track.ts:
  // the atomic guarded `updateMany({ where: { usage: { lt: usageLimit } } } )`
  // must serialize concurrent increments so usage can never blow past usageLimit.
  test("10 concurrent requests against a workspace with 1 slot left: exactly 1 succeeds, usage stops at the limit", async ({
    request,
  }) => {
    const ws = await createBillingTestWorkspace("race", {
      subscriptionStatus: "active",
      usage: 4,
      usageLimit: 5, // exactly one slot left
    });

    const responses = await Promise.all(
      Array.from({ length: 10 }, () => track(request, ws.projectToken!))
    );
    const bodies = await Promise.all(responses.map((r) => r.json().catch(() => ({}))));

    const succeeded = bodies.filter((b) => b.success !== false).length;
    const rejected = bodies.filter((b) => b.code === "exceeded_limit").length;

    expect(succeeded).toBe(1);
    expect(rejected).toBe(9);
    expect(await usageFor(ws.id)).toBe(5); // never exceeds usageLimit
  });

  test("workspace already at the limit: every request is rejected, usage never increments", async ({
    request,
  }) => {
    const ws = await createBillingTestWorkspace("at-limit", {
      subscriptionStatus: "active",
      usage: 5,
      usageLimit: 5,
    });

    const responses = await Promise.all(
      Array.from({ length: 5 }, () => track(request, ws.projectToken!))
    );
    for (const r of responses) {
      const body = await r.json();
      expect(body.code).toBe("exceeded_limit");
    }
    expect(await usageFor(ws.id)).toBe(5);
  });

  test("usageLimit = 0 means uncapped (uncovered-workspace baseline is never reached here since status already gates access)", async ({
    request,
  }) => {
    const ws = await createBillingTestWorkspace("uncapped", {
      subscriptionStatus: "active",
      usage: 1_000,
      usageLimit: 0,
    });
    const res = await track(request, ws.projectToken!);
    expect(res.ok()).toBe(true);
    expect(await usageFor(ws.id)).toBe(1_001);
  });
});

test.describe("billing enforcement — D6 entitlement matrix (/api/track access gate)", () => {
  test("active -> allowed", async ({ request }) => {
    const ws = await createBillingTestWorkspace("ent-active", { subscriptionStatus: "active" });
    expect((await track(request, ws.projectToken!)).ok()).toBe(true);
  });

  // Cancellation is scheduled for period end — access must continue until
  // the subscription actually terminates (webhook_processor.ts / reconcile.ts
  // flip this to canceled/expired later, not this per-request check).
  test("canceling -> still allowed (access continues until period end)", async ({ request }) => {
    const ws = await createBillingTestWorkspace("ent-canceling", { subscriptionStatus: "canceling" });
    expect((await track(request, ws.projectToken!)).ok()).toBe(true);
  });

  test("trialing with a future freeTrialEndDate -> allowed", async ({ request }) => {
    const ws = await createBillingTestWorkspace("ent-trial-active", {
      subscriptionStatus: "trialing",
      freeTrialEndDate: new Date(Date.now() + DAY_MS),
    });
    expect((await track(request, ws.projectToken!)).ok()).toBe(true);
  });

  test("trialing with a past freeTrialEndDate -> blocked", async ({ request }) => {
    const ws = await createBillingTestWorkspace("ent-trial-expired", {
      subscriptionStatus: "trialing",
      freeTrialEndDate: new Date(Date.now() - DAY_MS),
    });
    const res = await track(request, ws.projectToken!);
    expect(res.status()).toBe(403);
  });

  // D6: exactly 7 days of grace from paymentFailedAt.
  test("past_due, failed just now -> allowed (within the 7-day grace)", async ({ request }) => {
    const ws = await createBillingTestWorkspace("ent-pastdue-fresh", {
      subscriptionStatus: "past_due",
      paymentFailedAt: new Date(),
    });
    expect((await track(request, ws.projectToken!)).ok()).toBe(true);
  });

  test("past_due, failed 6 days ago -> still allowed", async ({ request }) => {
    const ws = await createBillingTestWorkspace("ent-pastdue-6d", {
      subscriptionStatus: "past_due",
      paymentFailedAt: new Date(Date.now() - 6 * DAY_MS),
    });
    expect((await track(request, ws.projectToken!)).ok()).toBe(true);
  });

  test("past_due, failed 8 days ago -> blocked (grace expired)", async ({ request }) => {
    const ws = await createBillingTestWorkspace("ent-pastdue-8d", {
      subscriptionStatus: "past_due",
      paymentFailedAt: new Date(Date.now() - 8 * DAY_MS),
    });
    const res = await track(request, ws.projectToken!);
    expect(res.status()).toBe(403);
  });

  test("past_due with no paymentFailedAt recorded -> blocked (fail closed)", async ({ request }) => {
    const ws = await createBillingTestWorkspace("ent-pastdue-nodate", {
      subscriptionStatus: "past_due",
      paymentFailedAt: null,
    });
    const res = await track(request, ws.projectToken!);
    expect(res.status()).toBe(403);
  });

  test("inactive -> blocked", async ({ request }) => {
    const ws = await createBillingTestWorkspace("ent-inactive", { subscriptionStatus: "inactive" });
    const res = await track(request, ws.projectToken!);
    expect(res.status()).toBe(403);
  });
});
