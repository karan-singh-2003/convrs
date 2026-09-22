import { describe, it, expect } from "vitest";
import {
  isDowngradeTransition,
  resolveKeepWorkspaceId,
  canDetachWorkspace,
  reuseTrialPreCheckoutPatch,
} from "./subscription-service";
import type { PendingPlanChange } from "@/lib/dodo/types";

describe("isDowngradeTransition", () => {
  it("growth -> standard is always a downgrade", () => {
    expect(isDowngradeTransition({ family: "growth", tier: "t1m" }, { family: "standard", tier: "t10m_plus" })).toBe(true);
    expect(isDowngradeTransition({ family: "growth", tier: "t10k" }, { family: "standard", tier: "t10k" })).toBe(true);
  });

  it("standard -> growth is never a downgrade", () => {
    expect(isDowngradeTransition({ family: "standard", tier: "t10m_plus" }, { family: "growth", tier: "t10k" })).toBe(false);
    expect(isDowngradeTransition({ family: "standard", tier: "t1m" }, { family: "growth", tier: "t1m" })).toBe(false);
  });

  it("same family: lower tier index = downgrade", () => {
    expect(isDowngradeTransition({ family: "standard", tier: "t1m" }, { family: "standard", tier: "t100k" })).toBe(true);
    expect(isDowngradeTransition({ family: "standard", tier: "t100k" }, { family: "standard", tier: "t1m" })).toBe(false);
    expect(isDowngradeTransition({ family: "growth", tier: "t10m" }, { family: "growth", tier: "t5m" })).toBe(true);
  });

  it("equal tier (interval-only change) is not a downgrade", () => {
    expect(isDowngradeTransition({ family: "growth", tier: "t100k" }, { family: "growth", tier: "t100k" })).toBe(false);
  });

  it("Growth-yearly t100k <-> t200k (both $390, intentionally equal — D10): t100k -> t200k is NOT a downgrade", () => {
    // D10 (confirmed, verified against the live Dodo catalog): Growth-yearly
    // t100k and t200k are BOTH $390/year on purpose (see pricing.tsx, PRICES.growth.t200k.yearly
    // and docs/billing-invariants.md §1) — NOT $590. Price alone can't distinguish
    // them, so the tier-index tie-break is what makes this resolve correctly:
    // t200k has the higher tier index (more events, same price), so it's an
    // upgrade-equivalent despite the price tie.
    expect(isDowngradeTransition({ family: "growth", tier: "t100k" }, { family: "growth", tier: "t200k" })).toBe(false);
    // and the reverse IS a downgrade
    expect(isDowngradeTransition({ family: "growth", tier: "t200k" }, { family: "growth", tier: "t100k" })).toBe(true);
  });
});

describe("resolveKeepWorkspaceId", () => {
  // Regression test: a Growth subscription with exactly one workspace downgrading
  // to Standard has nothing to "choose" (the UI never asks), but the pending
  // change must still carry a keepWorkspaceId — otherwise webhook-processor.ts's
  // `id: { not: pending.keepWorkspaceId } }` filter loses its `not` condition
  // entirely (Prisma drops `undefined` filters at any depth) and detaches every
  // workspace on the subscription, including the one that should survive.
  it("single workspace, no explicit choice -> keeps that workspace (never undefined)", () => {
    expect(resolveKeepWorkspaceId(["ws_1"], undefined)).toBe("ws_1");
  });

  it("single workspace, redundant explicit choice -> same result", () => {
    expect(resolveKeepWorkspaceId(["ws_1"], "ws_1")).toBe("ws_1");
  });

  it("zero workspaces -> undefined (nothing to keep, nothing to detach)", () => {
    expect(resolveKeepWorkspaceId([], undefined)).toBeUndefined();
  });

  it("multiple workspaces -> passes the caller-validated choice through unchanged", () => {
    expect(resolveKeepWorkspaceId(["ws_1", "ws_2", "ws_3"], "ws_2")).toBe("ws_2");
  });
});

describe("reuseTrialPreCheckoutPatch", () => {
  // Regression coverage for the critical billing bug: clicking "Pick Growth
  // Plan" on a cardless Standard trial used to write planFamily/planTier/
  // tierEvents/billingInterval/dodoProductId/maxWorkspaces onto the real,
  // already-attached trial Subscription row immediately — before Dodo
  // Checkout even opened, let alone was completed. An abandoned/closed
  // checkout then permanently left the workspace looking like a Growth
  // customer with no Dodo subscription behind it (dodoSubscriptionId still
  // null), including tripping the "Add this website to your Growth plan"
  // banner and the one-non-terminal-Growth-subscription (I-12) guard on
  // retry. createSubscriptionCheckout() now calls this function to decide
  // what (if anything) may be written to the reused row *before* checkout;
  // the actual plan commit happens only later, in webhook-processor.ts, off
  // the Dodo-confirmed product_id on subscription.active/updated/plan_changed.

  it("no consolidation requested -> no patch at all (nothing to write pre-checkout)", () => {
    // This is the ordinary Standard-trial -> Growth-checkout case. No patch
    // means createSubscriptionCheckout() skips the Prisma write entirely,
    // so the reused row's planFamily/planTier/dodoProductId/dodoSubscriptionId
    // are left exactly as they were — an abandoned checkout is a true no-op.
    expect(reuseTrialPreCheckoutPatch(undefined)).toBeNull();
  });

  it("consolidation requested -> patch carries ONLY pendingPlanChange, never plan identity", () => {
    const pending: PendingPlanChange = {
      kind: "consolidate",
      effectiveAt: "2026-09-23T00:00:00.000Z",
      targetFamily: "growth",
      targetTier: "t100k",
      targetInterval: "monthly",
      consolidateStandardSubIds: ["sub_a", "sub_b"],
    };
    const patch = reuseTrialPreCheckoutPatch(pending);
    expect(patch).toEqual({ pendingPlanChange: pending });
    // Explicitly assert the dangerous fields are absent from the patch shape
    // itself, not just unasserted — this is what the whole fix is about.
    expect(patch).not.toHaveProperty("planFamily");
    expect(patch).not.toHaveProperty("planTier");
    expect(patch).not.toHaveProperty("dodoProductId");
    expect(patch).not.toHaveProperty("tierEvents");
    expect(patch).not.toHaveProperty("billingInterval");
    expect(patch).not.toHaveProperty("maxWorkspaces");
  });
});

describe("canDetachWorkspace", () => {
  // Billing audit fix: a workspace's own `owner`-role member used to be able
  // to detach it from someone ELSE's subscription (isWsOwner bypass) — that
  // let an unrelated-to-billing member mutate the billing owner's seat
  // count / trigger auto-cancel without consent. Only the subscription's
  // actual owner (D9) may detach now.
  it("the subscription owner can detach", () => {
    expect(canDetachWorkspace({ subscriptionOwnerId: "user_owner", actorUserId: "user_owner" })).toBe(true);
  });

  it("an unrelated user cannot detach", () => {
    expect(canDetachWorkspace({ subscriptionOwnerId: "user_owner", actorUserId: "user_stranger" })).toBe(false);
  });

  it("a workspace-owner-role member who is NOT the subscription's billing owner cannot detach (the fixed bug)", () => {
    // Same shape as the real bug: the caller is `owner` on the WORKSPACE's
    // WorkspaceUsers row, but a different person entirely owns the
    // Subscription paying for it.
    expect(
      canDetachWorkspace({ subscriptionOwnerId: "user_billing_owner", actorUserId: "user_workspace_owner" }),
    ).toBe(false);
  });
});
