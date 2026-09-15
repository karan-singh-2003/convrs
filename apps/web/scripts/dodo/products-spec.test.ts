/**
 * apps/web/scripts/dodo/products-spec.test.ts
 *
 * DEPLOY 0 — offline self-check. No network. Proves that `products-spec.ts`
 * exactly matches the approved pricing table in
 * docs/billing-invariants.md §1 (parsed independently here), and
 * that the derived 36-product spec is internally consistent.
 *
 * Run:  pnpm --filter web exec vitest run scripts/dodo/products-spec.test.ts
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  APPROVED_PRICING,
  PRODUCT_SPECS,
  TIER_META,
  TIER_ORDER,
  type BillingInterval,
  type PlanFamily,
  type TierKey,
} from "./products-spec";

const DOC = join(__dirname, "../../../../docs/billing-invariants.md");

const LABEL_TO_TIER: Record<string, TierKey> = {
  "10K": "t10k",
  "100K": "t100k",
  "200K": "t200k",
  "500K": "t500k",
  "1M": "t1m",
  "2M": "t2m",
  "5M": "t5m",
  "10M": "t10m",
  "10M+": "t10m_plus",
};

/** Parse a "### Monthly" / "### Yearly" markdown table out of the approved doc. */
function parseApprovedTable(section: "Monthly" | "Yearly"): Record<PlanFamily, Record<TierKey, number>> {
  const md = readFileSync(DOC, "utf8");
  const lines = md.split(/\r?\n/);
  const start = lines.findIndex((l) => l.trim() === `### ${section}`);
  if (start === -1) throw new Error(`section "### ${section}" not found in ${DOC}`);

  const rows: number[][] = [];
  const out = { standard: {}, growth: {} } as Record<PlanFamily, Record<TierKey, number>>;
  let seen = 0;

  for (let i = start + 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith("### ")) break; // next section
    if (!line.startsWith("|")) {
      if (seen > 0) break; // table ended
      continue;
    }
    const cells = line
      .split("|")
      .map((c) => c.trim())
      .filter((c) => c.length > 0);
    if (cells.length < 3) continue;
    if (cells[0].toLowerCase() === "events") continue; // header
    if (cells.every((c) => /^:?-{2,}:?$/.test(c))) continue; // separator

    const tier = LABEL_TO_TIER[cells[0]];
    if (!tier) throw new Error(`unknown events label "${cells[0]}" in ${section} table`);
    const num = (s: string) => Number(s.replace(/[$,]/g, ""));
    out.standard[tier] = num(cells[1]);
    out.growth[tier] = num(cells[2]);
    rows.push([num(cells[1]), num(cells[2])]);
    seen++;
  }

  if (seen !== TIER_ORDER.length) {
    throw new Error(`${section} table: parsed ${seen} rows, expected ${TIER_ORDER.length}`);
  }
  return out;
}

describe("products-spec matches the approved pricing table (doc §20)", () => {
  for (const [section, interval] of [
    ["Monthly", "monthly"],
    ["Yearly", "yearly"],
  ] as [("Monthly" | "Yearly"), BillingInterval][]) {
    it(`${section}: every cell equals APPROVED_PRICING.${interval}`, () => {
      const parsed = parseApprovedTable(section);
      for (const family of ["standard", "growth"] as PlanFamily[]) {
        for (const tier of TIER_ORDER) {
          expect(
            APPROVED_PRICING[interval][family][tier],
            `${interval}/${family}/${tier}`,
          ).toBe(parsed[family][tier]);
        }
      }
    });
  }

  it("locks Growth yearly 100K = 200K = $390 (billing-invariants.md §1 / D10)", () => {
    expect(APPROVED_PRICING.yearly.growth.t100k).toBe(390);
    expect(APPROVED_PRICING.yearly.growth.t200k).toBe(390);
  });
});

describe("36-product spec is internally consistent", () => {
  it("has exactly 36 entries with unique keys", () => {
    expect(PRODUCT_SPECS).toHaveLength(36);
    expect(new Set(PRODUCT_SPECS.map((s) => s.key)).size).toBe(36);
  });

  it("covers every (family × tier × interval) combination once", () => {
    const expected = new Set<string>();
    for (const f of ["standard", "growth"]) {
      for (const t of TIER_ORDER) {
        for (const i of ["monthly", "yearly"]) expected.add(`${f}.${t}.${i}`);
      }
    }
    expect(new Set(PRODUCT_SPECS.map((s) => s.key))).toEqual(expected);
  });

  it("priceCents === priceUsd * 100 for every product", () => {
    for (const s of PRODUCT_SPECS) {
      expect(s.priceCents, s.key).toBe(s.priceUsd * 100);
      expect(Number.isInteger(s.priceCents), s.key).toBe(true);
    }
  });

  it("priceUsd equals APPROVED_PRICING for every product", () => {
    for (const s of PRODUCT_SPECS) {
      expect(s.priceUsd, s.key).toBe(APPROVED_PRICING[s.interval][s.family][s.tier]);
    }
  });

  it("names and metadata are well-formed", () => {
    for (const s of PRODUCT_SPECS) {
      expect(s.name).toMatch(/^Convrs (Standard|Growth) — .+ events \/ (month|year)$/);
      expect(s.metadata.spec_key).toBe(s.key);
      expect(s.metadata.family).toBe(s.family);
      expect(s.metadata.tier).toBe(s.tier);
      expect(s.metadata.interval).toBe(s.interval);
      expect(s.metadata.max_workspaces).toBe(s.family === "growth" ? "30" : "1");
      expect(s.metadata.events_included).toBe(
        TIER_META[s.tier].eventsIncluded === null
          ? "uncapped"
          : String(TIER_META[s.tier].eventsIncluded),
      );
      expect(s.paymentFrequencyInterval).toBe(s.interval === "yearly" ? "Year" : "Month");
    }
  });

  it("prices are non-decreasing up the tier ladder within each family/interval", () => {
    for (const family of ["standard", "growth"] as PlanFamily[]) {
      for (const interval of ["monthly", "yearly"] as BillingInterval[]) {
        const prices = TIER_ORDER.map((t) => APPROVED_PRICING[interval][family][t]);
        for (let i = 1; i < prices.length; i++) {
          expect(prices[i], `${family}/${interval} ${TIER_ORDER[i]} vs ${TIER_ORDER[i - 1]}`)
            .toBeGreaterThanOrEqual(prices[i - 1]);
        }
      }
    }
  });

  it("the ONLY equal-adjacent price pair is Growth yearly t100k/t200k", () => {
    const equalPairs: string[] = [];
    for (const family of ["standard", "growth"] as PlanFamily[]) {
      for (const interval of ["monthly", "yearly"] as BillingInterval[]) {
        for (let i = 1; i < TIER_ORDER.length; i++) {
          const a = APPROVED_PRICING[interval][family][TIER_ORDER[i - 1]];
          const b = APPROVED_PRICING[interval][family][TIER_ORDER[i]];
          if (a === b) equalPairs.push(`${family}/${interval}/${TIER_ORDER[i - 1]}=${TIER_ORDER[i]}`);
        }
      }
    }
    expect(equalPairs).toEqual(["growth/yearly/t100k=t200k"]);
  });

  it("Growth costs strictly more than Standard at every tier/interval", () => {
    for (const interval of ["monthly", "yearly"] as BillingInterval[]) {
      for (const tier of TIER_ORDER) {
        expect(
          APPROVED_PRICING[interval].growth[tier],
          `${interval}/${tier}`,
        ).toBeGreaterThan(APPROVED_PRICING[interval].standard[tier]);
      }
    }
  });
});
