import { describe, it, expect, vi, beforeEach } from "vitest";

// createSubscriptionCheckout with a workspace whose Subscription is a cardless
// trial — live, lapsed-but-not-yet-reconciled ("trialing", past end), or
// lapsed-and-reconciled ("inactive"). Only the DB and the Dodo checkout-session
// call are mocked; the reuse decision under test is the real code.

vi.mock("@repo/db", () => ({
  prisma: {
    user: { findUniqueOrThrow: vi.fn(), update: vi.fn() },
    subscription: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
    workspace: { findUnique: vi.fn() },
  },
}));
vi.mock("@/lib/dodo", () => ({ dodo: {} }));
vi.mock("@/lib/billing/dodo-checkout", () => ({
  createCheckoutSession: vi.fn(async () => ({ url: "https://checkout.example/session" })),
  appUrl: (p: string) => `https://app.example${p}`,
}));
vi.mock("@/lib/billing/plan-resolver", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/billing/plan-resolver")>();
  return {
    ...actual,
    resolvePlanBySpec: vi.fn(({ family, tier }: { family: string; tier: string }) => ({
      family,
      tier,
      productId: `pdt_${family}_${tier}`,
      tierEvents: 10_000,
      billingInterval: "month",
    })),
  };
});

import { prisma } from "@repo/db";
import { createCheckoutSession } from "@/lib/billing/dodo-checkout";
import { createSubscriptionCheckout } from "./subscription-service";

const DAY_MS = 86_400_000;
const OWNER = "user_owner";

function trialRow(overrides: Record<string, unknown>) {
  return {
    id: "sub_trial",
    status: "trialing",
    ownerUserId: OWNER,
    trialEndsAt: new Date(Date.now() + 5 * DAY_MS),
    dodoSubscriptionId: null,
    ...overrides,
  };
}

function givenWorkspaceSubscription(subscription: Record<string, unknown> | null) {
  (prisma.workspace.findUnique as any).mockResolvedValue({
    id: "ws_raw",
    subscriptionId: subscription ? subscription.id : null,
    subscription,
  });
}

const checkout = (intent: "standard" | "growth" = "standard") =>
  createSubscriptionCheckout({
    actorUserId: OWNER,
    intent,
    tier: "t10k",
    interval: "monthly",
    targetWorkspaceId: "ws_raw",
  });

describe("createSubscriptionCheckout — cardless trial reuse", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (prisma.user.findUniqueOrThrow as any).mockResolvedValue({
      id: OWNER,
      email: "o@example.com",
      name: "Owner",
      dodoCustomerId: null,
      // A user whose cardless trial has run has used their lifetime trial.
      freeTrialUsedAt: new Date(Date.now() - 20 * DAY_MS),
    });
    (prisma.subscription.findFirst as any).mockResolvedValue(null);
  });

  it.each([
    ["lapsed and reconciled (inactive)", { status: "inactive", trialEndsAt: new Date(Date.now() - DAY_MS) }],
    ["lapsed, not yet reconciled (trialing, end in the past)", { status: "trialing", trialEndsAt: new Date(Date.now() - DAY_MS) }],
    ["ended exactly now (boundary)", { status: "trialing", trialEndsAt: new Date(Date.now()) }],
  ])("expired trial %s: reuses the row for a normal paid checkout, writing nothing", async (_label, fields) => {
    givenWorkspaceSubscription(trialRow(fields));

    for (const intent of ["standard", "growth"] as const) {
      vi.mocked(createCheckoutSession).mockClear();
      const result = await checkout(intent);

      expect(result.internalSubscriptionId).toBe("sub_trial");
      expect(createCheckoutSession).toHaveBeenCalledWith(
        expect.objectContaining({
          productId: `pdt_${intent}_t10k`,
          trialPeriodDays: null, // no new trial — it's a paid checkout
          metadata: expect.objectContaining({ internalSubscriptionId: "sub_trial" }),
        })
      );
    }
    // Nothing is created or mutated before Dodo confirms: no new row, no
    // plan/status/dodoSubscriptionId change on the trial row, no new trial.
    expect(prisma.subscription.create).not.toHaveBeenCalled();
    expect(prisma.subscription.update).not.toHaveBeenCalled();
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it("active trial: reuses the row and carries the remaining trial days (unchanged behavior)", async () => {
    givenWorkspaceSubscription(trialRow({ status: "trialing", trialEndsAt: new Date(Date.now() + 5 * DAY_MS) }));

    const result = await checkout("growth");

    expect(result.internalSubscriptionId).toBe("sub_trial");
    expect(createCheckoutSession).toHaveBeenCalledWith(expect.objectContaining({ trialPeriodDays: 5 }));
    expect(prisma.subscription.update).not.toHaveBeenCalled();
  });

  it("a workspace covered by a real paid subscription is still refused", async () => {
    givenWorkspaceSubscription(trialRow({ status: "active", trialEndsAt: null, dodoSubscriptionId: "sub_dodo_1" }));
    await expect(checkout()).rejects.toMatchObject({ code: "workspace_covered" });
    expect(createCheckoutSession).not.toHaveBeenCalled();
  });

  it("an inactive row that never was a trial is still refused", async () => {
    givenWorkspaceSubscription(trialRow({ status: "inactive", trialEndsAt: null }));
    await expect(checkout()).rejects.toMatchObject({ code: "workspace_covered" });
  });

  it("a lapsed trial owned by another user is still refused", async () => {
    givenWorkspaceSubscription(trialRow({ status: "inactive", trialEndsAt: new Date(Date.now() - DAY_MS), ownerUserId: "someone_else" }));
    await expect(checkout()).rejects.toMatchObject({ code: "workspace_covered" });
  });

  it("a cancelled paid subscription keeps its Dodo binding and is not treated as a trial", async () => {
    givenWorkspaceSubscription(trialRow({ status: "canceled", trialEndsAt: new Date(Date.now() - 40 * DAY_MS), dodoSubscriptionId: "sub_dodo_2" }));
    await expect(checkout()).rejects.toMatchObject({ code: "workspace_covered" });
  });
});
