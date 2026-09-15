import { describe, it, expect } from "vitest";
import {
  dodoSubscriptionToPayload,
  decideReconcile,
  type DodoSubscriptionLike,
  type LocalSubscriptionState,
} from "./reconcile";
import type { PendingPlanChange } from "@/lib/dodo/types";

const NOW = new Date("2026-06-15T00:00:00.000Z");

function live(over: Partial<DodoSubscriptionLike> = {}): DodoSubscriptionLike {
  return {
    subscription_id: "sub_dodo_1",
    product_id: "pdt_standard_t100k_monthly",
    status: "active",
    currency: "usd",
    next_billing_date: "2026-07-01T00:00:00.000Z",
    previous_billing_date: "2026-06-01T00:00:00.000Z",
    cancel_at_next_billing_date: false,
    customer: { customer_id: "cus_1", email: "a@b.com", name: "A" },
    metadata: { intent: "standard" },
    ...over,
  };
}

function local(over: Partial<LocalSubscriptionState> = {}): LocalSubscriptionState {
  return {
    status: "active",
    dodoProductId: "pdt_standard_t100k_monthly",
    currentPeriodEnd: new Date("2026-07-01T00:00:00.000Z"),
    pendingPlanChange: null,
    ...over,
  };
}

describe("dodoSubscriptionToPayload", () => {
  it("maps SDK fields onto the webhook payload shape and uppercases currency", () => {
    const p = dodoSubscriptionToPayload(live());
    expect(p.subscription_id).toBe("sub_dodo_1");
    expect(p.product_id).toBe("pdt_standard_t100k_monthly");
    expect(p.customer).toEqual({ customer_id: "cus_1", email: "a@b.com", name: "A" });
    expect(p.currency).toBe("USD");
    expect(p.cancel_at_next_billing_date).toBe(false);
    expect(p.next_billing_date).toBe("2026-07-01T00:00:00.000Z");
  });

  it("tolerates missing customer / metadata / dates", () => {
    const p = dodoSubscriptionToPayload({
      subscription_id: "s",
      product_id: "p",
      status: "active",
    });
    expect(p.customer).toEqual({ customer_id: "", email: "", name: "" });
    expect(p.metadata).toEqual({});
    expect(typeof p.next_billing_date).toBe("string");
  });
});

describe("decideReconcile", () => {
  it("returns null when our row already matches Dodo", () => {
    expect(decideReconcile(local(), dodoSubscriptionToPayload(live()), NOW)).toBeNull();
  });

  it("flags a due pending plan change (Dodo never confirmed)", () => {
    const pending: PendingPlanChange = {
      kind: "tier_down",
      effectiveAt: "2026-06-01T00:00:00.000Z",
      targetFamily: "standard",
      targetTier: "t10k",
      targetInterval: "monthly",
    };
    const d = decideReconcile(local({ pendingPlanChange: pending }), dodoSubscriptionToPayload(live()), NOW);
    expect(d?.event).toBe("subscription.plan_changed");
  });

  it("ignores a consolidate pending change (handled elsewhere)", () => {
    const pending = {
      kind: "consolidate",
      effectiveAt: "2026-06-01T00:00:00.000Z",
      targetFamily: "growth",
      targetTier: "t500k",
      targetInterval: "monthly",
    } as PendingPlanChange;
    expect(
      decideReconcile(local({ pendingPlanChange: pending }), dodoSubscriptionToPayload(live()), NOW),
    ).toBeNull();
  });

  it("forces terminal when a canceling sub is past its period end", () => {
    const d = decideReconcile(
      local({ status: "canceling", currentPeriodEnd: new Date("2026-06-01T00:00:00.000Z") }),
      dodoSubscriptionToPayload(live({ status: "active", cancel_at_next_billing_date: true })),
      NOW,
    );
    expect(d?.event).toBe("subscription.expired");
  });

  it("detects status drift and picks a terminal vs non-terminal replay event", () => {
    const past = decideReconcile(
      local({ status: "active" }),
      dodoSubscriptionToPayload(live({ status: "on_hold" })),
      NOW,
    );
    expect(past?.event).toBe("subscription.updated");

    const gone = decideReconcile(
      local({ status: "active" }),
      dodoSubscriptionToPayload(live({ status: "cancelled" })),
      NOW,
    );
    expect(gone?.event).toBe("subscription.cancelled");
  });

  it("detects product drift", () => {
    const d = decideReconcile(
      local(),
      dodoSubscriptionToPayload(live({ product_id: "pdt_growth_t1m_yearly" })),
      NOW,
    );
    expect(d?.event).toBe("subscription.plan_changed");
  });

  it("replays as a renewal when the billing period advanced", () => {
    const d = decideReconcile(
      local({ currentPeriodEnd: new Date("2026-07-01T00:00:00.000Z") }),
      dodoSubscriptionToPayload(live({ next_billing_date: "2026-08-01T00:00:00.000Z" })),
      NOW,
    );
    expect(d?.event).toBe("subscription.renewed");
  });

  it("replays as an update for a non-advancing period-end mismatch", () => {
    const d = decideReconcile(
      local({ currentPeriodEnd: new Date("2026-07-05T00:00:00.000Z") }),
      dodoSubscriptionToPayload(live({ next_billing_date: "2026-07-01T00:00:00.000Z" })),
      NOW,
    );
    expect(d?.event).toBe("subscription.updated");
  });
});
