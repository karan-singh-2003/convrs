import { describe, it, expect } from "vitest";
import { decideBillingIdentity } from "./billing-identity";

describe("decideBillingIdentity (D9: only Subscription.ownerUserId views/manages billing)", () => {
  it("workspace has no subscription yet -> no_subscription (not an authz question)", () => {
    expect(decideBillingIdentity(null, "user_1")).toBe("no_subscription");
    expect(decideBillingIdentity(undefined, "user_1")).toBe("no_subscription");
  });

  it("caller IS the subscription owner -> authorized", () => {
    expect(decideBillingIdentity("user_1", "user_1")).toBe("authorized");
  });

  // Regression: a workspace member with billing:read/billing:write who is NOT
  // the subscription owner must be refused, not silently shown their own
  // (unrelated) Dodo data or the owner's (cross-customer exposure).
  it("caller is a different user than the subscription owner -> forbidden", () => {
    expect(decideBillingIdentity("user_1", "user_2")).toBe("forbidden");
  });
});
