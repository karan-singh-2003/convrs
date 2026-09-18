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
  country: { groupBy: "countries", field: "country", outputKey: "country" },
  region: {
    groupBy: "regions",
    field: "region",
    outputKey: "region",
    extraFields: [{ internal: "country", public: "country" }],
  },
  city: {
    groupBy: "cities",
    field: "city",
    outputKey: "city",
    extraFields: [
      { internal: "country", public: "country" },
      { internal: "region", public: "region" },
    ],
  },
  continent: {
    groupBy: "continents",
    field: "continent",
    outputKey: "continent",
  },
};

export const querySchema = v1DateRangeFields
  .extend(v1FilterFields.shape)
  .extend(v1PaginationFields.shape)
  .extend({
    dimension: z.enum(["country", "region", "city", "continent"]).default("country"),
    metrics: z
      .string()
      .optional()
      .describe(`Comma-separated list of metrics. Defaults to all of: ${DIMENSION_METRICS.join(", ")}.`),
  });

// GET /api/v1/analytics/geo — country/region/city/continent breakdown.
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
