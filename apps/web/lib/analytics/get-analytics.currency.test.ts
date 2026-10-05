import { describe, it, expect, vi, beforeEach } from "vitest";

// One Tinybird row in USD: $99 of revenue across 3 visitors.
const usdRow = {
  groupByField: "count",
  clicks: 3,
  revenue: 99,
  new_revenue: 99,
  refund_amount: 0,
  revenue_per_visitor: 33,
  conversion_rate: 33.33,
  bounce_rate: 0,
  avg_session_duration: 0,
};
let pipeRows: Record<string, unknown>[] = [];

vi.mock("@/lib/tinybird", () => ({
  tb: { buildPipe: () => async () => ({ data: pipeRows }) },
}));

vi.mock("@repo/db", () => ({
  prisma: {
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

vi.mock("./get-mrr-timeseries", () => ({
  getMrrTimeseries: vi.fn(),
  getMrrSnapshot: vi.fn(),
}));

async function count(currency: string, row: Record<string, unknown> = usdRow) {
  pipeRows = [row];
  vi.resetModules(); // fresh exchange-rate cache
  const { getAnalytics } = await import("./get-analytics");
  const [result] = (await getAnalytics({
    event: "composite",
    groupBy: "count",
    workspaceId: "ws_1",
    interval: "7d",
    timezone: "UTC",
    currency,
    kpiType: "revenue",
    revenueMetric: "revenue",
  } as any)) as any[];
  return result;
}

describe("getAnalytics currency conversion", () => {
  beforeEach(() => vi.clearAllMocks());

  it("converts revenue/visitor with the same rate as revenue", async () => {
    const inr = await count("INR");
    expect(inr.revenue).toBeCloseTo(99 * 83);
    expect(inr.revenue_per_visitor).toBeCloseTo(33 * 83);
    // ...so the ratio still holds in the display currency.
    expect(inr.revenue_per_visitor).toBeCloseTo(inr.revenue / 3);

    const eur = await count("EUR");
    expect(eur.revenue_per_visitor).toBeCloseTo(33 * 0.9);
  });

  it("leaves USD values untouched (no double conversion)", async () => {
    const usd = await count("USD");
    expect(usd.revenue).toBe(99);
    expect(usd.revenue_per_visitor).toBe(33);
  });

  it("reads the revenue breakdown's `total_revenue` as each row's revenue (and converts it)", async () => {
    // Exactly what v1_group_by's group_by_sales node returns for event=revenue.
    pipeRows = [{ groupByField: "example.com", total_revenue: 99 }];
    for (const [currency, expected] of [
      ["USD", 99],
      ["INR", 99 * 83],
    ] as const) {
      vi.resetModules();
      const { getAnalytics } = await import("./get-analytics");
      const rows = (await getAnalytics({
        event: "revenue",
        groupBy: "hostname",
        workspaceId: "ws_1",
        interval: "7d",
        timezone: "UTC",
        currency,
        kpiType: "revenue",
        revenueMetric: "revenue",
      } as any)) as any[];
      expect(rows).toHaveLength(1);
      expect(rows[0].hostname).toBe("example.com");
      expect(rows[0].revenue).toBeCloseTo(expected);
    }
  });

  it("keeps zero-visitor revenue/visitor at zero", async () => {
    const inr = await count("INR", { ...usdRow, clicks: 0, revenue_per_visitor: 0 });
    expect(inr.revenue_per_visitor).toBe(0);
  });
});
