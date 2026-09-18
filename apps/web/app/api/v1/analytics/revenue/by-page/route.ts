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
import { DIMENSIONS as PAGE_DIMENSIONS } from "@/app/api/v1/analytics/pages/route";
import { REVENUE_DIMENSION_METRICS } from "@/lib/api/v1/metrics";

// Only `page` and `hostname` — NOT entrypage/exitlink. Revenue events are
// recorded from a server-side payment webhook (packages/analytics/src/
// payment.ts's processPayment), not a live browser session, so `page`/
// `hostname` come from the visitor's last-touch attribution context
// (attemptAttribution() -> v1_customer_attribution, most recent pageview
// before purchase) — but that same call never populates entrypage/exitlink
// on the revenue event (processPayment's payload to recordEvent doesn't set
// them), so those two dimensions would always group everything into a
// single empty/null bucket. Excluded rather than exposed as a fake signal.
export const querySchema = v1DateRangeFields
  .extend(v1FilterFields.shape)
  .extend(v1PaginationFields.shape)
  .extend({
    dimension: z.enum(["page", "hostname"]).default("page"),
    metrics: z
      .string()
      .optional()
      .describe(`Comma-separated list of metrics. Defaults to: ${REVENUE_DIMENSION_METRICS.join(", ")}.`),
  });

// GET /api/v1/analytics/revenue/by-page — revenue attributed to the page
// the visitor was last on before completing a purchase (see the
// attribution note above and in /api/v1/analytics/revenue/by-source).
export const GET = withApiToken(
  async ({ workspace, searchParams }) => {
    try {
      const query = querySchema.parse(searchParams);

      const scopeError = checkWebsiteScope(workspace, query.websiteId);
      if (scopeError) return scopeError;

      const rows = await fetchDimensionBreakdown(
        workspace,
        query,
        PAGE_DIMENSIONS[query.dimension],
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
