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
import { fetchDimensionBreakdown, DimensionConfig } from "@/lib/api/v1/breakdown";
import { DIMENSION_METRICS } from "@/lib/api/v1/metrics";

export const DIMENSIONS: Record<string, DimensionConfig> = {
  referrer: { groupBy: "referers", field: "referer", outputKey: "referrer" },
  referrer_url: {
    groupBy: "referer_urls",
    field: "refererUrl",
    outputKey: "referrerUrl",
  },
  utm_source: {
    groupBy: "utm_sources",
    field: "utm_source",
    outputKey: "utmSource",
  },
  utm_medium: {
    groupBy: "utm_mediums",
    field: "utm_medium",
    outputKey: "utmMedium",
  },
  utm_campaign: {
    groupBy: "utm_campaigns",
    field: "utm_campaign",
    outputKey: "utmCampaign",
  },
  utm_term: { groupBy: "utm_terms", field: "utm_term", outputKey: "utmTerm" },
  utm_content: {
    groupBy: "utm_contents",
    field: "utm_content",
    outputKey: "utmContent",
  },
  campaign: { groupBy: "campaigns", field: "campaign", outputKey: "campaign" },
};

const DIMENSION_VALUES = Object.keys(DIMENSIONS) as [string, ...string[]];

export const querySchema = v1DateRangeFields
  .extend(v1FilterFields.shape)
  .extend(v1PaginationFields.shape)
  .extend({
    dimension: z.enum(DIMENSION_VALUES).default("referrer"),
    metrics: z
      .string()
      .optional()
      .describe(`Comma-separated list of metrics. Defaults to all of: ${DIMENSION_METRICS.join(", ")}.`),
  });

// GET /api/v1/analytics/sources — referrer/UTM breakdown. `dimension` picks
// which one; defaults to `referrer`.
export const GET = withApiToken(
  async ({ workspace, searchParams }) => {
    try {
      const query = querySchema.parse(searchParams);

      const scopeError = checkWebsiteScope(workspace, query.websiteId);
      if (scopeError) return scopeError;

      const rows = await fetchDimensionBreakdown(
        workspace,
        query,
        DIMENSIONS[query.dimension]
      );

      const { rows: pageRows, pagination } = paginate(rows, query);
      return apiPaginated(pageRows, pagination);
    } catch (err) {
      return toV1ErrorResponse(err);
    }
  },
  { requiredScope: "analytics.read" }
);
