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
import { DIMENSIONS as SOURCE_DIMENSIONS } from "@/app/api/v1/analytics/sources/route";
import { REVENUE_DIMENSION_METRICS } from "@/lib/api/v1/metrics";

export const querySchema = v1DateRangeFields
  .extend(v1FilterFields.shape)
  .extend(v1PaginationFields.shape)
  .extend({
    dimension: z
      .enum(["utm_campaign", "campaign"])
      .default("utm_campaign")
      .describe(
        "utm_campaign (default) groups by the raw UTM campaign value; campaign groups by the full attribution query string."
      ),
    metrics: z
      .string()
      .optional()
      .describe(`Comma-separated list of metrics. Defaults to: ${REVENUE_DIMENSION_METRICS.join(", ")}.`),
  });

// GET /api/v1/analytics/revenue/by-campaign — revenue grouped by campaign
// attribution. Reuses the same utm_campaign/campaign dimensions already
// wired for /api/v1/analytics/sources (no new attribution algorithm) —
// see that endpoint's comment for the last-touch attribution mechanism.
export const GET = withApiToken(
  async ({ workspace, searchParams }) => {
    try {
      const query = querySchema.parse(searchParams);

      const scopeError = checkWebsiteScope(workspace, query.websiteId);
      if (scopeError) return scopeError;

      const rows = await fetchDimensionBreakdown(
        workspace,
        query,
        SOURCE_DIMENSIONS[query.dimension],
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
