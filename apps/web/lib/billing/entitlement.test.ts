import { describe, it, expect } from "vitest";
import { getBillingState, isEntitled } from "./entitlement";

const DAY_MS = 24 * 60 * 60 * 1000;

describe("isEntitled", () => {
  it("active -> entitled", () => {
    expect(isEntitled({ subscriptionStatus: "active" })).toBe(true);
  });

  // Regression: a scheduled cancellation (cancel-at-period-end) flips
  // Subscription.status to "canceling" immediately, but access must continue
  // until the period actually ends — the webhook/reconcile cron is what later
  // flips this to "canceled"/"expired". Denying access the moment cancellation
  // is *requested* would mean paying customers lose access before their paid
  // period is over.
  it("canceling -> still entitled (access continues until period end)", () => {
    expect(isEntitled({ subscriptionStatus: "canceling" })).toBe(true);
  });

  it("trialing with a future freeTrialEndDate -> entitled", () => {
    expect(
      isEntitled({
        subscriptionStatus: "trialing",
        freeTrialEndDate: new Date(Date.now() + DAY_MS),
      }),
    ).toBe(true);
  });

  it("trialing with a past freeTrialEndDate -> not entitled", () => {
    expect(
      isEntitled({
        subscriptionStatus: "trialing",
        freeTrialEndDate: new Date(Date.now() - DAY_MS),
      }),
    ).toBe(false);
  });

  it("trialing with no freeTrialEndDate -> not entitled", () => {
    expect(isEntitled({ subscriptionStatus: "trialing" })).toBe(false);
  });

  // D6: past_due keeps access for exactly a 7-day grace window from
  // paymentFailedAt, enforced by the same shared function in both
  // apps/web (this file) and apps/ingestion/src/controllers/track.ts.
  describe("past_due grace (D6, 7 days from paymentFailedAt)", () => {
    it("just failed -> entitled", () => {
      expect(
        isEntitled({ subscriptionStatus: "past_due", paymentFailedAt: new Date() }),
      ).toBe(true);
    });

    it("6 days into the grace window -> still entitled", () => {
      expect(
        isEntitled({
          subscriptionStatus: "past_due",
          paymentFailedAt: new Date(Date.now() - 6 * DAY_MS),
        }),
      ).toBe(true);
    });

    it("past 7 days -> no longer entitled", () => {
      expect(
        isEntitled({
          subscriptionStatus: "past_due",
          paymentFailedAt: new Date(Date.now() - 8 * DAY_MS),
        }),
      ).toBe(false);
    });

    it("past_due with no paymentFailedAt recorded -> not entitled (fail closed)", () => {
      expect(isEntitled({ subscriptionStatus: "past_due" })).toBe(false);
    });
  });

  it("inactive / canceled / expired / missing status -> not entitled", () => {
    expect(isEntitled({ subscriptionStatus: "inactive" })).toBe(false);
    expect(isEntitled({ subscriptionStatus: "canceled" })).toBe(false);
    expect(isEntitled({ subscriptionStatus: "expired" })).toBe(false);
    expect(isEntitled({})).toBe(false);
  });
});

describe("getBillingState", () => {
  const future = () => new Date(Date.now() + 5 * DAY_MS);
  const past = () => new Date(Date.now() - DAY_MS);
  // What a new workspace's auto-granted cardless trial stores.
  const standardTrialRow = (overrides: Record<string, unknown> = {}) => ({
    planFamily: "standard",
    planTier: "t10k",
    billingInterval: "month",
    trialEndsAt: future(),
    dodoSubscriptionId: null,
    ...overrides,
  });
  const STANDARD = { family: "standard", tier: "t10k", billingInterval: "month" };

  it("active cardless trial: Standard is the current (trial) plan", () => {
    const trialEnd = future();
    expect(
      getBillingState(
        { subscriptionStatus: "trialing", freeTrialEndDate: trialEnd },
        standardTrialRow({ trialEndsAt: trialEnd }),
      ),
    ).toEqual({
      isEntitled: true,
      isTrialing: true,
      isTrialExpired: false,
      hasActivePaidSubscription: false,
      currentPlan: STANDARD,
    });
  });

  it.each([
    ["still 'trialing' (reconcile cron hasn't run)", "trialing"],
    ["flipped to 'inactive' by the reconcile cron", "inactive"],
  ])("expired cardless trial, %s: no current plan, no paid subscription", (_label, status) => {
    const trialEnd = past();
    expect(
      getBillingState(
        { subscriptionStatus: status, freeTrialEndDate: trialEnd },
        standardTrialRow({ trialEndsAt: trialEnd }),
      ),
    ).toEqual({
      isEntitled: false,
      isTrialing: false,
      isTrialExpired: true,
      hasActivePaidSubscription: false,
      // The row still stores Standard — that is history, not a current plan.
      currentPlan: null,
    });
  });

  it("trial ending exactly now counts as expired (matches isEntitled's boundary)", () => {
    const now = new Date();
    const state = getBillingState(
      { subscriptionStatus: "trialing", freeTrialEndDate: now },
      standardTrialRow({ trialEndsAt: now }),
    );
    expect(state.isEntitled).toBe(false);
    expect(state.isTrialExpired).toBe(true);
    expect(state.currentPlan).toBeNull();
  });

  it("missing dodoSubscriptionId (undefined) is treated like null: cardless", () => {
    const state = getBillingState(
      { subscriptionStatus: "inactive", freeTrialEndDate: past() },
      { planFamily: "standard", planTier: "t10k", billingInterval: "month", trialEndsAt: past() },
    );
    expect(state.isTrialExpired).toBe(true);
    expect(state.hasActivePaidSubscription).toBe(false);
  });

  it.each([
    ["Standard", "standard", "t10k"],
    ["Growth", "growth", "t100k"],
  ])("active paid %s: that plan is current, never classed as an expired trial", (_l, family, tier) => {
    // A converted trial keeps its (past) trialEndsAt populated.
    const state = getBillingState(
      { subscriptionStatus: "active", freeTrialEndDate: past() },
      { planFamily: family, planTier: tier, billingInterval: "month", trialEndsAt: past(), dodoSubscriptionId: "sub_dodo" },
    );
    expect(state).toEqual({
      isEntitled: true,
      isTrialing: false,
      isTrialExpired: false,
      hasActivePaidSubscription: true,
      currentPlan: { family, tier, billingInterval: "month" },
    });
  });

  it("past_due within the 7-day grace: still paid and current, not an expired trial", () => {
    const state = getBillingState(
      { subscriptionStatus: "past_due", paymentFailedAt: new Date(Date.now() - 2 * DAY_MS), freeTrialEndDate: past() },
      standardTrialRow({ trialEndsAt: past(), dodoSubscriptionId: "sub_dodo" }),
    );
    expect(state.hasActivePaidSubscription).toBe(true);
    expect(state.isTrialExpired).toBe(false);
    expect(state.currentPlan).toEqual(STANDARD);
  });

  it("past_due beyond the grace: no current plan, but still not a lapsed trial", () => {
    const state = getBillingState(
      { subscriptionStatus: "past_due", paymentFailedAt: new Date(Date.now() - 10 * DAY_MS) },
      standardTrialRow({ trialEndsAt: past(), dodoSubscriptionId: "sub_dodo" }),
    );
    expect(state.isEntitled).toBe(false);
    expect(state.isTrialExpired).toBe(false);
    expect(state.currentPlan).toBeNull();
  });

  it.each(["canceled", "expired"])("%s paid subscription: no current plan, not an expired trial", (status) => {
    const state = getBillingState(
      { subscriptionStatus: status, freeTrialEndDate: past() },
      standardTrialRow({ trialEndsAt: past(), dodoSubscriptionId: "sub_dodo" }),
    );
    expect(state).toMatchObject({
      isEntitled: false,
      isTrialing: false,
      isTrialExpired: false,
      hasActivePaidSubscription: false,
      currentPlan: null,
    });
  });

  it("canceling (cancel at period end) keeps its paid plan current until it ends", () => {
    const state = getBillingState(
      { subscriptionStatus: "canceling" },
      standardTrialRow({ trialEndsAt: null, dodoSubscriptionId: "sub_dodo" }),
    );
    expect(state.hasActivePaidSubscription).toBe(true);
    expect(state.currentPlan).toEqual(STANDARD);
  });

  it("no subscription and no trial at all: nothing current, not an expired trial", () => {
    expect(getBillingState({ subscriptionStatus: "inactive" }, null)).toEqual({
      isEntitled: false,
      isTrialing: false,
      isTrialExpired: false,
      hasActivePaidSubscription: false,
      currentPlan: null,
    });
  });
});
