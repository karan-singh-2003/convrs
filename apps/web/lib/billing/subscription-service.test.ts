import { describe, it, expect } from "vitest";
import { isDowngradeTransition, resolveKeepWorkspaceId, canDetachWorkspace } from "./subscription-service";

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
