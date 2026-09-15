import { describe, it, expect } from "vitest";
import { isEntitled } from "./entitlement";

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
