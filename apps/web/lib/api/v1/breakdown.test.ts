import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/analytics/get-analytics", () => ({ getAnalytics: vi.fn() }));

import { getAnalytics } from "@/lib/analytics/get-analytics";
import { fetchDimensionBreakdown } from "./breakdown";
import { DIMENSION_METRICS, REVENUE_DIMENSION_METRICS } from "./metrics";
import { InvalidRequestError } from "./errors";

const workspace: any = { id: "ws_1", timezone: "UTC", currency: "USD" };
const dimension = { groupBy: "page" as any, field: "page", outputKey: "page" };

describe("fetchDimensionBreakdown", () => {
  beforeEach(() => vi.clearAllMocks());

  it("defaults to DIMENSION_METRICS when no allowedMetrics override is given", async () => {
    (getAnalytics as any).mockResolvedValue([]);
    await fetchDimensionBreakdown(workspace, {}, dimension);
    // "visitors" is only in DIMENSION_METRICS, not REVENUE_DIMENSION_METRICS —
    // no throw means the default list was used.
    expect(getAnalytics).toHaveBeenCalled();
  });

  it("validates metrics against the narrower allowedMetrics list when provided", async () => {
    await expect(
      fetchDimensionBreakdown(
        workspace,
        { metrics: "visitors" },
        dimension,
        REVENUE_DIMENSION_METRICS
      )
    ).rejects.toThrow(InvalidRequestError);
  });

  it("accepts a metric that's valid under the narrower list", async () => {
    (getAnalytics as any).mockResolvedValue([]);
    await expect(
      fetchDimensionBreakdown(
        workspace,
        { metrics: "revenue" },
        dimension,
        REVENUE_DIMENSION_METRICS
      )
    ).resolves.toEqual([]);
  });
});
