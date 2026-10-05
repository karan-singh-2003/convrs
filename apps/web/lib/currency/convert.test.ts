import { describe, it, expect, vi, beforeEach } from "vitest";

// Exchange rates are only ever stored against USD (see update-rates.ts).
const USD_RATES = [
  { baseCurrency: "USD", targetCurrency: "INR", rate: 83 },
  { baseCurrency: "USD", targetCurrency: "EUR", rate: 0.9 },
  { baseCurrency: "USD", targetCurrency: "GBP", rate: 0.8 },
];

vi.mock("@repo/db", () => ({
  prisma: {
    exchangeRate: {
      findMany: vi.fn(async ({ where }: { where: { baseCurrency: string } }) =>
        USD_RATES.filter((r) => r.baseCurrency === where.baseCurrency)
      ),
    },
  },
}));

import { prisma } from "@repo/db";

// get-rate.ts keeps a module-level cache, so load a fresh copy per test.
async function load() {
  vi.resetModules();
  const { convertCurrency } = await import("./convert");
  const { getRates } = await import("./get-rate");
  return { convertCurrency, getRates };
}

describe("convertCurrency", () => {
  beforeEach(() => vi.clearAllMocks());

  it.each([
    ["INR", 99 * 83],
    ["EUR", 99 * 0.9],
    ["GBP", 99 * 0.8],
  ])("converts USD to %s using the stored rate", async (to, expected) => {
    const { convertCurrency } = await load();
    expect(await convertCurrency(99, "USD", to)).toBeCloseTo(expected);
  });

  it("returns the amount unchanged for same-currency conversion", async () => {
    const { convertCurrency } = await load();
    expect(await convertCurrency(42, "EUR", "EUR")).toBe(42);
  });

  it.each([
    // €10 -> USD (10 / 0.9) -> INR (* 83)
    ["EUR", "INR", (10 / 0.9) * 83],
    // £10 -> USD (10 / 0.8) -> INR (* 83)
    ["GBP", "INR", (10 / 0.8) * 83],
    ["EUR", "USD", 10 / 0.9],
    ["GBP", "EUR", (10 / 0.8) * 0.9],
  ])("derives %s -> %s as a cross rate through USD", async (from, to, expected) => {
    const { convertCurrency } = await load();
    expect(await convertCurrency(10, from, to)).toBeCloseTo(expected);
  });

  it("keeps results correct across repeated lookups with different base currencies", async () => {
    const { convertCurrency } = await load();
    for (let i = 0; i < 2; i++) {
      expect(await convertCurrency(99, "USD", "INR")).toBeCloseTo(8217);
      expect(await convertCurrency(10, "EUR", "INR")).toBeCloseTo((10 / 0.9) * 83);
      expect(await convertCurrency(99, "USD", "EUR")).toBeCloseTo(89.1);
      expect(await convertCurrency(10, "GBP", "INR")).toBeCloseTo((10 / 0.8) * 83);
    }
  });

  it("does not let a non-USD lookup poison the cached USD rates", async () => {
    const { convertCurrency } = await load();
    await convertCurrency(10, "EUR", "INR");
    expect(await convertCurrency(99, "USD", "INR")).toBeCloseTo(8217);
  });

  it("falls back to the unconverted amount when a currency has no rate", async () => {
    const { convertCurrency } = await load();
    expect(await convertCurrency(5, "USD", "XYZ")).toBe(5);
    expect(await convertCurrency(5, "XYZ", "INR")).toBe(5);
    expect(await convertCurrency(5, "XYZ", "ABC")).toBe(5);
    // ...and the unsupported lookups leave real conversions untouched.
    expect(await convertCurrency(99, "USD", "INR")).toBeCloseTo(8217);
  });
});

describe("getRates cache", () => {
  beforeEach(() => vi.clearAllMocks());

  it("caches per base currency and never answers one base with another's rates", async () => {
    const { getRates } = await load();
    expect(await getRates("USD")).toEqual({ INR: 83, EUR: 0.9, GBP: 0.8 });
    expect(await getRates("EUR")).toEqual({});
    expect(await getRates("USD")).toEqual({ INR: 83, EUR: 0.9, GBP: 0.8 });
    expect(await getRates("EUR")).toEqual({});
    // One DB read per base; the repeats are served from that base's own entry.
    expect(prisma.exchangeRate.findMany).toHaveBeenCalledTimes(2);
  });
});
