import { describe, it, expect } from "vitest";
import { mapStatus, RELEVANT_EVENTS, isUnsafeDowngradeDetach } from "@/lib/billing/webhook-processor";
import type { PendingPlanChange } from "@/lib/dodo/types";

describe("webhook-processor: mapStatus (Dodo -> Prisma SubscriptionStatus)", () => {
  it("active -> active", () => expect(mapStatus("active", false)).toBe("active"));
  it("on_hold / paused / failed -> past_due", () => {
    expect(mapStatus("on_hold", false)).toBe("past_due");
    expect(mapStatus("paused", false)).toBe("past_due");
    expect(mapStatus("failed", false)).toBe("past_due");
  });
  it("cancelled -> canceled, expired -> expired", () => {
    expect(mapStatus("cancelled", false)).toBe("canceled");
    expect(mapStatus("expired", false)).toBe("expired");
  });
  it("pending / unknown -> inactive", () => {
    expect(mapStatus("pending", false)).toBe("inactive");
    expect(mapStatus("weird", false)).toBe("inactive");
  });
  it("cancel_at_next_billing_date -> canceling (unless already terminal)", () => {
    expect(mapStatus("active", true)).toBe("canceling");
    expect(mapStatus("on_hold", true)).toBe("canceling");
    expect(mapStatus("cancelled", true)).toBe("canceled"); // terminal wins
    expect(mapStatus("expired", true)).toBe("expired");
  });
});

describe("webhook-processor: RELEVANT_EVENTS", () => {
  it("covers the subscription lifecycle, excludes payment.* and unrelated events", () => {
    for (const t of [
      "subscription.active",
      "subscription.updated",
      "subscription.renewed",
      "subscription.plan_changed",
      "subscription.on_hold",
      "subscription.cancelled",
      "subscription.expired",
      "subscription.failed",
    ]) {
      expect(RELEVANT_EVENTS.has(t)).toBe(true);
    }
    expect(RELEVANT_EVENTS.has("payment.succeeded")).toBe(false);
    expect(RELEVANT_EVENTS.has("dispute.opened")).toBe(false);
  });
});

describe("webhook-processor: isUnsafeDowngradeDetach", () => {
  const base: Omit<PendingPlanChange, "keepWorkspaceId"> = {
    kind: "downgrade_to_standard",
    effectiveAt: "2026-01-01T00:00:00.000Z",
    targetFamily: "standard",
    targetTier: "t10k",
    targetInterval: "monthly",
  };

  it("unsafe: downgrade_to_standard with no keepWorkspaceId — would silently detach everyone", () => {
    expect(isUnsafeDowngradeDetach({ ...base })).toBe(true);
  });

  it("safe: keepWorkspaceId set -> not unsafe", () => {
    expect(isUnsafeDowngradeDetach({ ...base, keepWorkspaceId: "ws_1" })).toBe(false);
  });

  it("other pending-change kinds never trigger this guard", () => {
    expect(
      isUnsafeDowngradeDetach({ ...base, kind: "tier_down" }),
    ).toBe(false);
    expect(
      isUnsafeDowngradeDetach({ ...base, kind: "consolidate" }),
    ).toBe(false);
  });
});
