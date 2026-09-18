import * as z from "zod/v4";
import { withApiToken } from "@/lib/auth";
import { apiPaginated } from "@/lib/api/v1/response";
import { toV1ErrorResponse } from "@/lib/api/v1/errors";
import { checkWebsiteScope } from "@/lib/api/v1/website";
import {
  v1FilterFields,
  v1DateRangeFields,
  v1PaginationFields,
  paginate,
} from "@/lib/api/v1/query";
import { fetchDimensionBreakdown } from "@/lib/api/v1/breakdown";
import { DIMENSIONS } from "@/app/api/v1/analytics/sources/route";
import { REVENUE_DIMENSION_METRICS } from "@/lib/api/v1/metrics";

const DIMENSION_VALUES = Object.keys(DIMENSIONS) as [string, ...string[]];

export const querySchema = v1DateRangeFields
  .extend(v1FilterFields.shape)
  .extend(v1PaginationFields.shape)
  .extend({
    dimension: z.enum(DIMENSION_VALUES).default("referrer"),
    metrics: z
      .string()
      .optional()
      .describe(`Comma-separated list of metrics. Defaults to: ${REVENUE_DIMENSION_METRICS.join(", ")}.`),
  });

// GET /api/v1/analytics/revenue/by-source — revenue attributed to a
// visitor's referrer/UTM parameters at last touch before purchase. Reuses
// the exact same v1_group_by breakdown as /api/v1/analytics/sources
// (fetchDimensionBreakdown / DIMENSIONS), just defaulting to revenue-focused
// metrics instead of visitor-focused ones.
//
// Attribution note: revenue events carry the visitor's most recent
// pageview context at the time of payment (see attemptAttribution() in
// packages/analytics/src/attribution.ts, which queries v1_customer_attribution
// ORDER BY timestamp DESC LIMIT 1) — this is real last-touch attribution,
// not a fabricated join. Unattributed payments are recorded with revenue=0
// and are excluded from these sums by the pipe's `revenue > 0` filter.
export const GET = withApiToken(
  async ({ workspace, searchParams }) => {
    try {
      const query = querySchema.parse(searchParams);

      const scopeError = checkWebsiteScope(workspace, query.websiteId);
      if (scopeError) return scopeError;

      const rows = await fetchDimensionBreakdown(
        workspace,
        query,
        DIMENSIONS[query.dimension],
        REVENUE_DIMENSION_METRICS
      );

      const { rows: pageRows, pagination } = paginate(rows, query);
      return apiPaginated(pageRows, pagination);
    } catch (err) {
      return toV1ErrorResponse(err);
    }
  },
  { requiredScope: "analytics.read" }
);
