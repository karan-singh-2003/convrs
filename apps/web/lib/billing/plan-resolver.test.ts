import { describe, it, expect } from "vitest";
import {
  resolvePlanByProductId,
  resolvePlanBySpec,
  productIdFor,
  catalogIsComplete,
  FAMILY_MAX_WORKSPACES,
  ALL_TIER_KEYS,
} from "./plan-resolver";
import {
  PRICING_FAMILIES,
  getProductIdByTier,
  getPlanFromProductId,
  isDowngradePlan,
  formatEventLimit,
} from "@repo/utils";
import { PRODUCT_SPECS, APPROVED_PRICING } from "../../scripts/dodo/products-spec";
// pricing.tsx now runs Live Mode ids (products.created.json is the preserved
// Test Mode record, no longer what pricing.tsx is checked against).
import CREATED from "../../scripts/dodo/products.created.live.json";

const created = CREATED as Record<string, string>;

describe("plan-resolver", () => {
  it("Deploy 0 catalog is complete (all 36 products have ids)", () => {
    expect(catalogIsComplete()).toBe(true);
    expect(Object.keys(created)).toHaveLength(36);
  });

  it("round-trips every one of the 36 products: productId -> plan -> productId", () => {
    for (const spec of PRODUCT_SPECS) {
      const pid = created[spec.key];
      const resolved = resolvePlanByProductId(pid);
      expect(resolved, spec.key).not.toBeNull();
      expect(resolved!.family).toBe(spec.family);
      expect(resolved!.tier).toBe(spec.tier);
      expect(resolved!.interval).toBe(spec.interval);
      expect(resolved!.productId).toBe(pid);
      expect(productIdFor({ family: spec.family, tier: spec.tier, interval: spec.interval })).toBe(pid);
    }
  });

  it("resolvePlanBySpec matches resolvePlanByProductId", () => {
    for (const spec of PRODUCT_SPECS) {
      const a = resolvePlanBySpec({ family: spec.family, tier: spec.tier, interval: spec.interval });
      const b = resolvePlanByProductId(created[spec.key]);
      expect(a).toEqual(b);
    }
  });

  it("maxWorkspaces: standard=1, growth=30", () => {
    expect(FAMILY_MAX_WORKSPACES).toEqual({ standard: 1, growth: 30 });
    for (const spec of PRODUCT_SPECS) {
      const r = resolvePlanByProductId(created[spec.key])!;
      expect(r.maxWorkspaces).toBe(spec.family === "growth" ? 30 : 1);
    }
  });

  it("t10m_plus tier is an uncapped sentinel; others are finite", () => {
    const plus = resolvePlanBySpec({ family: "standard", tier: "t10m_plus", interval: "monthly" })!;
    // NOT Number.MAX_SAFE_INTEGER: tierEvents/usageLimit are Postgres Int
    // (32-bit) columns — MAX_SAFE_INTEGER overflows them (verified against
    // the dev DB: "Value out of range for the type: ... integer"), which
    // would crash every checkout/webhook/fan-out for this tier. The sentinel
    // must stay well under Int32's ~2.147B ceiling.
    expect(plus.tierEvents).toBe(2_000_000_000);
    expect(plus.tierEvents).toBeLessThan(2_147_483_647);
    const t1m = resolvePlanBySpec({ family: "standard", tier: "t1m", interval: "monthly" })!;
    expect(t1m.tierEvents).toBe(1_000_000);
  });

  it("every tier's tierEvents fits in a Postgres Int32 column (Subscription.tierEvents / Workspace.tierEvents / Workspace.usageLimit)", () => {
    const INT32_MAX = 2_147_483_647;
    for (const family of ["standard", "growth"] as const) {
      for (const tier of ALL_TIER_KEYS) {
        const plan = resolvePlanBySpec({ family, tier, interval: "monthly" })!;
        expect(plan.tierEvents).toBeLessThanOrEqual(INT32_MAX);
        expect(Number.isSafeInteger(plan.tierEvents)).toBe(true);
      }
    }
  });

  it("unrecognised / retired product ids resolve to null", () => {
    expect(resolvePlanByProductId("pdt_0NdQZEKYFbEhiC2G1iuxI")).toBeNull(); // old test product
    expect(resolvePlanByProductId("pdt_does_not_exist")).toBeNull();
    expect(resolvePlanByProductId(null)).toBeNull();
    expect(resolvePlanByProductId(undefined)).toBeNull();
  });

  it("billingInterval maps yearly->year, monthly->month", () => {
    expect(resolvePlanBySpec({ family: "standard", tier: "t10k", interval: "yearly" })!.billingInterval).toBe("year");
    expect(resolvePlanBySpec({ family: "growth", tier: "t100k", interval: "monthly" })!.billingInterval).toBe("month");
  });
});

describe("pricing catalog (@repo/utils) <-> Deploy 0 source of record", () => {
  it("every (family,tier,interval) product id in the catalog equals products.created.live.json", () => {
    let checked = 0;
    for (const spec of PRODUCT_SPECS) {
      const fromCatalog = getProductIdByTier({
        family: spec.family,
        tier: spec.tier,
        interval: spec.interval,
      });
      expect(fromCatalog, spec.key).toBe(created[spec.key]);
      checked++;
    }
    expect(checked).toBe(36);
  });

  it("getPlanFromProductId round-trips all 36 ids back to their (family,tier,interval)", () => {
    for (const spec of PRODUCT_SPECS) {
      const { plan, interval, family } = getPlanFromProductId(created[spec.key]);
      expect(plan, spec.key).not.toBeNull();
      expect(plan!.tier).toBe(spec.tier);
      expect(family).toBe(spec.family);
      expect(interval).toBe(spec.interval);
    }
  });

  it("catalog prices match the approved pricing table verbatim (incl. Growth-yearly t100k == t200k == 390)", () => {
    for (const family of ["standard", "growth"] as const) {
      for (const plan of PRICING_FAMILIES[family]) {
        expect(plan.price.monthly, `${family}.${plan.tier}.monthly`).toBe(
          APPROVED_PRICING.monthly[family][plan.tier],
        );
        expect(plan.price.yearly, `${family}.${plan.tier}.yearly`).toBe(
          APPROVED_PRICING.yearly[family][plan.tier],
        );
      }
    }
    const g = PRICING_FAMILIES.growth;
    expect(g.find((p) => p.tier === "t100k")!.price.yearly).toBe(390);
    expect(g.find((p) => p.tier === "t200k")!.price.yearly).toBe(390);
  });

  it("isDowngradePlan: tier rank breaks the Growth-yearly price tie", () => {
    // same monthly price (Growth t100k=39, t200k=59 monthly -> not a tie on monthly;
    // the documented tie is on the YEARLY price). isDowngradePlan compares monthly,
    // so t100k(39) -> t200k(59) is an upgrade, t200k -> t100k is a downgrade.
    expect(
      isDowngradePlan({ currentPlan: "t100k", currentFamily: "growth", newPlan: "t200k", newFamily: "growth" }),
    ).toBe(false);
    expect(
      isDowngradePlan({ currentPlan: "t200k", currentFamily: "growth", newPlan: "t100k", newFamily: "growth" }),
    ).toBe(true);
    // cross-family same tier: Growth costs more -> Standard->Growth is an upgrade
    expect(
      isDowngradePlan({ currentPlan: "t1m", currentFamily: "standard", newPlan: "t1m", newFamily: "growth" }),
    ).toBe(false);
    expect(
      isDowngradePlan({ currentPlan: "t1m", currentFamily: "growth", newPlan: "t1m", newFamily: "standard" }),
    ).toBe(true);
    // plain ladder moves within a family
    expect(isDowngradePlan({ currentPlan: "t500k", newPlan: "t10k" })).toBe(true);
    expect(isDowngradePlan({ currentPlan: "t10k", newPlan: "t500k" })).toBe(false);
    expect(isDowngradePlan({ currentPlan: "t500k", newPlan: "t500k" })).toBe(false);
  });

  it("formatEventLimit: uncapped t10m_plus renders as 10M+", () => {
    expect(formatEventLimit(Number.MAX_SAFE_INTEGER)).toBe("10M+ events/mo");
    expect(formatEventLimit(10_000)).toBe("10K events/mo");
    expect(formatEventLimit(1_000_000)).toBe("1M events/mo");
  });
});
