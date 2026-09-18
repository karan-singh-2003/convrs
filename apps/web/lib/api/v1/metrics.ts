import { InvalidRequestError } from "./errors";

/**
 * Public metric vocabulary for /api/v1/analytics/*. Every name here maps to
 * a field that lib/analytics/get-analytics.ts's composite response actually
 * computes today — nothing here is fabricated. `visitors` is intentionally
 * not called `pageviews`/`sessions`: Convrs only computes a distinct-visitor
 * count (Tinybird `clicks` = uniq(visitor_id)), not raw pageview or session
 * totals, so the public name matches what's really measured.
 */
export const PUBLIC_METRICS = [
  "visitors",
  "new_visitors",
  "returning_visitors",
  "bounce_rate",
  "avg_session_duration",
  "conversion_rate",
  "revenue_per_visitor",
  "revenue",
  "mrr",
  "new_revenue",
  "refund_amount",
  "conversions",
] as const;

export type PublicMetric = (typeof PUBLIC_METRICS)[number];

/** public metric name -> field name on getAnalytics()'s response row. */
export const METRIC_FIELD_MAP: Record<PublicMetric, string> = {
  visitors: "clicks",
  new_visitors: "new_visitors",
  returning_visitors: "returning_visitors",
  bounce_rate: "bounce_rate",
  avg_session_duration: "avg_session_duration",
  conversion_rate: "conversion_rate",
  revenue_per_visitor: "revenue_per_visitor",
  revenue: "revenue",
  mrr: "revenue", // revenueMetric: "mrr" swaps what the `revenue` field means
  new_revenue: "new_revenue",
  refund_amount: "refund_amount",
  conversions: "conversions",
};

// Available on GET /api/v1/analytics and /analytics/timeseries (v1_count /
// v1_timeseries composite pipes — see packages/tinybird/pipes/v1_count.pipe
// and v1_timeseries.pipe). No `conversions` field at this level.
export const OVERVIEW_METRICS = PUBLIC_METRICS.filter(
  (m) => m !== "conversions"
);

// Available on the dimension breakdowns: /analytics/pages, /sources, /geo,
// /devices (v1_group_by's group_by_metrics node only computes these). NOTE:
// no `mrr` here — getAnalytics()'s revenueMetric:"mrr" override only takes
// effect for groupBy "count" and "timeseries" (see the `usingMrr` branch in
// lib/analytics/get-analytics.ts); for every other groupBy it's silently
// ignored and `revenue` stays plain revenue. Listing `mrr` as available here
// would return plain revenue mislabeled as MRR, so it's deliberately absent
// — same reasoning applies to REVENUE_DIMENSION_METRICS below.
export const DIMENSION_METRICS: PublicMetric[] = [
  "visitors",
  "conversions",
  "revenue",
  "revenue_per_visitor",
  "conversion_rate",
];

// Available on GET /api/v1/analytics/revenue (groupBy: "count", where the
// mrr override does apply).
export const REVENUE_METRICS: PublicMetric[] = [
  "revenue",
  "mrr",
  "new_revenue",
  "refund_amount",
  "revenue_per_visitor",
  "conversion_rate",
];

// Available on GET /api/v1/analytics/revenue/{by-source,by-campaign,by-page}
// — same underlying dimension breakdown as DIMENSION_METRICS, but scoped to
// revenue-relevant fields only (no `visitors`, no `mrr` — see note above).
export const REVENUE_DIMENSION_METRICS: PublicMetric[] = [
  "revenue",
  "conversions",
  "revenue_per_visitor",
  "conversion_rate",
];

export function parseMetricsParam(
  raw: string | undefined,
  allowed: readonly PublicMetric[]
): PublicMetric[] {
  // `mrr` is opt-in only — it's the same underlying field as `revenue`
  // computed a different way, so it's never part of the implicit "all
  // metrics" default (that would trip the revenue/mrr conflict check below
  // on every unfiltered request).
  const requested = raw
    ? raw.split(",").map((m) => m.trim()).filter(Boolean)
    : allowed.filter((m) => m !== "mrr");

  for (const metric of requested) {
    if (!(PUBLIC_METRICS as readonly string[]).includes(metric)) {
      throw new InvalidRequestError(
        `Unknown metric: \`${metric}\`. Valid metrics are: ${PUBLIC_METRICS.join(", ")}.`
      );
    }
    if (!allowed.includes(metric as PublicMetric)) {
      throw new InvalidRequestError(
        `Metric \`${metric}\` is not available on this endpoint. Available metrics: ${allowed.join(", ")}.`
      );
    }
  }

  if (requested.includes("revenue") && requested.includes("mrr")) {
    throw new InvalidRequestError(
      "Cannot request both `revenue` and `mrr` in the same call — they represent the same underlying field computed two different ways. Make two requests instead."
    );
  }

  return requested as PublicMetric[];
}

/** "mrr" requested anywhere -> ask getAnalytics for the MRR variant of revenue. */
export function resolveRevenueMetric(
  metrics: PublicMetric[]
): "revenue" | "mrr" {
  return metrics.includes("mrr") ? "mrr" : "revenue";
}

export function projectMetrics(
  row: Record<string, unknown> | undefined,
  metrics: PublicMetric[]
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const metric of metrics) {
    const field = METRIC_FIELD_MAP[metric];
    const value = row?.[field];
    out[metric] = typeof value === "number" ? value : Number(value ?? 0);
  }
  return out;
}
