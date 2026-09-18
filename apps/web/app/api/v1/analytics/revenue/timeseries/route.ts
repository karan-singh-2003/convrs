import * as z from "zod/v4";
import { withApiToken } from "@/lib/auth";
import { getAnalytics } from "@/lib/analytics/get-analytics";
import { apiSuccess } from "@/lib/api/v1/response";
import { toV1ErrorResponse } from "@/lib/api/v1/errors";
import { checkWebsiteScope } from "@/lib/api/v1/website";
import {
  v1FilterFields,
  v1DateRangeFields,
  resolveDateRange,
} from "@/lib/api/v1/query";
import {
  REVENUE_METRICS,
  parseMetricsParam,
  projectMetrics,
  resolveRevenueMetric,
} from "@/lib/api/v1/metrics";

export const querySchema = v1DateRangeFields.extend(v1FilterFields.shape).extend({
  metrics: z
    .string()
    .optional()
    .describe(
      `Comma-separated list of metrics to return. Defaults to all of: ${REVENUE_METRICS.join(", ")}.`
    ),
});

// GET /api/v1/analytics/revenue/timeseries — the same composite timeseries
// call as /api/v1/analytics/timeseries, restricted to revenue metrics, with
// an explicit `currency` field — same conventions as /api/v1/analytics/revenue.
export const GET = withApiToken(
  async ({ workspace, searchParams }) => {
    try {
      const query = querySchema.parse(searchParams);

      const scopeError = checkWebsiteScope(workspace, query.websiteId);
      if (scopeError) return scopeError;

      const metrics = parseMetricsParam(query.metrics, REVENUE_METRICS);
      const { start, end, interval } = resolveDateRange(query);

      const rows = await getAnalytics({
        event: "composite",
        groupBy: "timeseries",
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

      const points = (Array.isArray(rows) ? rows : []).map((r: any) => ({
        date: r.start,
        ...projectMetrics(r, metrics),
      }));

      return apiSuccess({ currency: workspace.currency, points });
    } catch (err) {
      return toV1ErrorResponse(err);
    }
  },
  { requiredScope: "analytics.read" }
);
