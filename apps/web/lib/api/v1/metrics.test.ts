import { describe, it, expect } from "vitest";
import {
  parseMetricsParam,
  projectMetrics,
  resolveRevenueMetric,
  OVERVIEW_METRICS,
  DIMENSION_METRICS,
  REVENUE_DIMENSION_METRICS,
  REVENUE_METRICS,
} from "./metrics";
import { InvalidRequestError } from "./errors";

describe("DIMENSION_METRICS / REVENUE_DIMENSION_METRICS", () => {
  // Regression test: getAnalytics()'s revenueMetric:"mrr" override only
  // takes effect for groupBy "count"/"timeseries" (see get-analytics.ts's
  // `usingMrr` branch) — for any dimension breakdown it's silently ignored
  // and `revenue` stays plain revenue. Listing "mrr" as available on a
  // dimension breakdown would return plain revenue mislabeled as MRR.
  it("never lists mrr as available on a dimension breakdown", () => {
    expect(DIMENSION_METRICS).not.toContain("mrr");
    expect(REVENUE_DIMENSION_METRICS).not.toContain("mrr");
  });

  it("does list mrr as available on the count/timeseries-shaped revenue endpoint", () => {
    expect(REVENUE_METRICS).toContain("mrr");
  });

  it("excludes visitors from the revenue-focused dimension list (revenue by-source/by-campaign/by-page)", () => {
    expect(REVENUE_DIMENSION_METRICS).not.toContain("visitors");
  });
});

describe("parseMetricsParam", () => {
  it("defaults to the endpoint's full allowed list when omitted, excluding mrr (opt-in only)", () => {
    expect(parseMetricsParam(undefined, OVERVIEW_METRICS)).toEqual(
      OVERVIEW_METRICS.filter((m) => m !== "mrr")
    );
  });

  it("parses a comma-separated list", () => {
    expect(parseMetricsParam("visitors,revenue", OVERVIEW_METRICS)).toEqual([
      "visitors",
      "revenue",
    ]);
  });

  it("rejects an unknown metric name", () => {
    expect(() => parseMetricsParam("pageviews", OVERVIEW_METRICS)).toThrow(
      InvalidRequestError
    );
  });

  it("rejects a metric not available on this endpoint", () => {
    // `conversions` exists as a public metric but isn't part of the
    // overview/timeseries composite response.
    expect(() => parseMetricsParam("conversions", OVERVIEW_METRICS)).toThrow(
      InvalidRequestError
    );
    expect(parseMetricsParam("conversions", DIMENSION_METRICS)).toEqual([
      "conversions",
    ]);
  });

  it("rejects requesting both revenue and mrr in the same call", () => {
    expect(() =>
      parseMetricsParam("revenue,mrr", OVERVIEW_METRICS)
    ).toThrow(InvalidRequestError);
  });
});

describe("resolveRevenueMetric", () => {
  it("defaults to plain revenue", () => {
    expect(resolveRevenueMetric(["visitors", "revenue"])).toBe("revenue");
  });

  it("switches to mrr when requested", () => {
    expect(resolveRevenueMetric(["mrr"])).toBe("mrr");
  });
});

describe("projectMetrics", () => {
  it("maps internal field names to public metric names", () => {
    const row = { clicks: 42, revenue: 100, conversion_rate: 5.5 };
    expect(
      projectMetrics(row, ["visitors", "revenue", "conversion_rate"])
    ).toEqual({ visitors: 42, revenue: 100, conversion_rate: 5.5 });
  });

  it("defaults missing fields to 0 rather than throwing", () => {
    expect(projectMetrics({}, ["visitors", "revenue"])).toEqual({
      visitors: 0,
      revenue: 0,
    });
  });

  it("defaults to 0 for an undefined row (empty result set)", () => {
    expect(projectMetrics(undefined, ["visitors"])).toEqual({ visitors: 0 });
  });
});
