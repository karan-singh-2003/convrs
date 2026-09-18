import { getAnalytics } from "@/lib/analytics/get-analytics";
import { WorkspaceProps } from "@/lib/types";
import { AnalyticsGroupByOptions } from "@/lib/analytics/types";
import { resolveDateRange } from "./query";
import {
  DIMENSION_METRICS,
  parseMetricsParam,
  projectMetrics,
  resolveRevenueMetric,
  PublicMetric,
} from "./metrics";

export interface DimensionConfig {
  /** getAnalytics()'s `groupBy` value for this dimension. */
  groupBy: AnalyticsGroupByOptions;
  /** Field name on the internal response row holding the dimension value. */
  field: string;
  /** Public field name in the API response. */
  outputKey: string;
  /** Extra fields carried alongside (e.g. `regions`/`cities` also return `country`). */
  extraFields?: { internal: string; public: string }[];
}

interface BreakdownQuery {
  websiteId?: string;
  interval?: string;
  startAt?: string;
  endAt?: string;
  timezone?: string;
  metrics?: string;
  country?: any;
  city?: any;
  region?: any;
  continent?: any;
  device?: any;
  browser?: any;
  os?: any;
  referer?: any;
  refererUrl?: any;
  hostname?: any;
  page?: any;
  entrypage?: any;
  exitlink?: any;
  utm_source?: any;
  utm_medium?: any;
  utm_campaign?: any;
  utm_term?: any;
  utm_content?: any;
  goal?: any;
  saleType?: any;
}

/**
 * Shared implementation behind /api/v1/analytics/{pages,sources,geo,devices}
 * — all four are the same v1_group_by composite query with a different
 * `groupBy` dimension, so this is the one place that calls getAnalytics()
 * for all of them rather than four near-duplicate route bodies.
 */
export async function fetchDimensionBreakdown(
  workspace: WorkspaceProps,
  query: BreakdownQuery,
  dimension: DimensionConfig,
  allowedMetrics: readonly PublicMetric[] = DIMENSION_METRICS
) {
  const metrics = parseMetricsParam(query.metrics, allowedMetrics);
  const { start, end, interval } = resolveDateRange(query);

  const rows = await getAnalytics({
    event: "composite",
    groupBy: dimension.groupBy,
    workspaceId: workspace.id,
    interval,
    start,
    end,
    timezone: query.timezone ?? workspace.timezone ?? "UTC",
    currency: workspace.currency,
    kpiType: workspace.kpiType as "revenue" | "goal",
    kpiEventName: workspace.kpiEventName ?? undefined,
    revenueMetric: resolveRevenueMetric(metrics),
    country: query.country,
    city: query.city,
    region: query.region,
    continent: query.continent,
    device: query.device,
    browser: query.browser,
    os: query.os,
    referer: query.referer,
    refererUrl: query.refererUrl,
    hostname: query.hostname,
    page: query.page,
    entrypage: query.entrypage,
    exitlink: query.exitlink,
    utm_source: query.utm_source,
    utm_medium: query.utm_medium,
    utm_campaign: query.utm_campaign,
    utm_term: query.utm_term,
    utm_content: query.utm_content,
    goal: query.goal,
    saleType: query.saleType,
  });

  return (Array.isArray(rows) ? rows : []).map((r: Record<string, any>) => ({
    [dimension.outputKey]: r[dimension.field],
    ...Object.fromEntries(
      (dimension.extraFields ?? []).map((f) => [f.public, r[f.internal]])
    ),
    ...projectMetrics(r, metrics),
  }));
}
