import { describe, it, expect } from "vitest";
import { TIER_KEYS, type PricingFamily, type TierKey } from "@repo/utils";
import { isDowngradeSelection } from "./plan-compare";
import { isDowngradeTransition } from "./subscription-service";
import { resolvePlanBySpec } from "./plan-resolver";

const FAMILIES: PricingFamily[] = ["standard", "growth"];
const INTERVALS = ["monthly", "yearly"] as const;

describe("plan-compare (billing UI) ↔ subscription-service (server authority)", () => {
  it("isDowngradeSelection agrees with isDowngradeTransition for every family/tier pair", () => {
    for (const cf of FAMILIES) {
      for (const ct of TIER_KEYS) {
        for (const nf of FAMILIES) {
          for (const nt of TIER_KEYS) {
            const ui = isDowngradeSelection(
              { family: cf, tier: ct as TierKey },
              { family: nf, tier: nt as TierKey },
            );
            const server = isDowngradeTransition(
              { family: cf, tier: ct as TierKey },
              { family: nf, tier: nt as TierKey },
            );
            expect(ui, `${cf}/${ct} → ${nf}/${nt}`).toBe(server);
          }
        }
      }
    }
  });

  it("every family/tier/interval the picker can emit resolves to a real Dodo product", () => {
    for (const family of FAMILIES) {
      for (const tier of TIER_KEYS) {
        for (const interval of INTERVALS) {
          const plan = resolvePlanBySpec({ family, tier: tier as TierKey, interval });
          expect(plan, `${family}/${tier}/${interval}`).not.toBeNull();
          expect(plan!.productId).toMatch(/^pdt_/);
        }
      }
    }
  });
});

describe("plan-compare spot checks", () => {
  it("Growth → Standard is always a downgrade; Standard → Growth never is", () => {
    expect(
      isDowngradeSelection({ family: "growth", tier: "t10k" }, { family: "standard", tier: "t10m" }),
    ).toBe(true);
    expect(
      isDowngradeSelection({ family: "standard", tier: "t10m" }, { family: "growth", tier: "t10k" }),
    ).toBe(false);
  });

  it("within a family the tier ladder decides", () => {
    expect(
      isDowngradeSelection({ family: "standard", tier: "t500k" }, { family: "standard", tier: "t100k" }),
    ).toBe(true);
    expect(
      isDowngradeSelection({ family: "standard", tier: "t100k" }, { family: "standard", tier: "t500k" }),
    ).toBe(false);
    expect(
      isDowngradeSelection({ family: "growth", tier: "t1m" }, { family: "growth", tier: "t1m" }),
    ).toBe(false);
  });
});
