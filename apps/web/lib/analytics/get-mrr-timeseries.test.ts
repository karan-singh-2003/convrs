import { describe, it, expect, vi, beforeEach } from "vitest";

const subscriptions: any[] = [];

vi.mock("@repo/db", () => ({
  prisma: {
    customerSubscription: { findMany: vi.fn(async () => subscriptions) },
    // Rates are only ever stored against USD (see lib/currency/update-rates.ts).
    exchangeRate: {
      findMany: vi.fn(async ({ where }: { where: { baseCurrency: string } }) =>
        where.baseCurrency === "USD"
          ? [
              { baseCurrency: "USD", targetCurrency: "INR", rate: 83 },
              { baseCurrency: "USD", targetCurrency: "EUR", rate: 0.9 },
            ]
          : []
      ),
    },
  },
}));

// The real, dependency-free MRR math — the package barrel pulls in prisma,
// encryption, etc. that a unit test doesn't need.
vi.mock("@repo/analytics", () => import("../../../../packages/analytics/src/mrr"));

const startedAt = new Date("2026-09-01T00:00:00Z");
const asOf = new Date("2026-10-01T00:00:00Z");

function sub(overrides: Record<string, unknown>) {
  return {
    status: "active",
    amount: 0,
    currency: "USD",
    interval: "month",
    intervalCount: 1,
    startedAt,
    canceledAt: null,
    ...overrides,
  };
}

async function snapshot(currency: string) {
  vi.resetModules(); // fresh exchange-rate cache per test
  const { getMrrSnapshot } = await import("./get-mrr-timeseries");
  return getMrrSnapshot("ws_1", currency, asOf);
}

describe("getMrrSnapshot — stored minor units are reported in major units", () => {
  beforeEach(() => {
    subscriptions.length = 0;
  });

  it("$29/month (2900 cents) is $29 MRR, not $2,900", async () => {
    subscriptions.push(sub({ amount: 2900 }));
    expect(await snapshot("USD")).toBeCloseTo(29);
  });

  it("$120/year (12000 cents) contributes $10/month", async () => {
    subscriptions.push(sub({ amount: 12000, interval: "year" }));
    expect(await snapshot("USD")).toBeCloseTo(10);
  });

  it("sums multiple subscriptions", async () => {
    subscriptions.push(sub({ amount: 2900 }), sub({ amount: 12000, interval: "year" }));
    expect(await snapshot("USD")).toBeCloseTo(39);
  });

  it("converts mixed currencies after normalizing to major units", async () => {
    // $29/month + €120/year (= €10/month)
    subscriptions.push(
      sub({ amount: 2900 }),
      sub({ amount: 12000, currency: "eur", interval: "year" })
    );
    expect(await snapshot("USD")).toBeCloseTo(29 + 10 / 0.9);
    expect(await snapshot("EUR")).toBeCloseTo(29 * 0.9 + 10);
    expect(await snapshot("INR")).toBeCloseTo(29 * 83 + (10 / 0.9) * 83);
  });

  it("excludes subscriptions canceled before the snapshot", async () => {
    subscriptions.push(
      sub({ amount: 2900 }),
      sub({ amount: 5000, status: "canceled", canceledAt: new Date("2026-09-15T00:00:00Z") })
    );
    expect(await snapshot("USD")).toBeCloseTo(29);
  });
});

describe("getMrrTimeseries", () => {
  beforeEach(() => {
    subscriptions.length = 0;
  });

  it("reports each bucket in major units", async () => {
    subscriptions.push(sub({ amount: 2900 }), sub({ amount: 12000, interval: "year" }));
    vi.resetModules();
    const { getMrrTimeseries } = await import("./get-mrr-timeseries");
    const rows = await getMrrTimeseries({
      workspaceId: "ws_1",
      start: new Date("2026-09-10T00:00:00Z"),
      end: new Date("2026-09-12T23:59:59Z"),
      timezone: "UTC",
      currency: "USD",
    } as any);
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) expect(row.revenue).toBeCloseTo(39);
  });
});
