import * as z from "zod/v4";
import { withApiToken } from "@/lib/auth";
import {
  getBotFilteringAnalytics,
  BOT_CATEGORIES,
} from "@/lib/analytics/get-bot-analytics";
import { apiSuccess, apiPaginated } from "@/lib/api/v1/response";
import { toV1ErrorResponse } from "@/lib/api/v1/errors";
import { checkWebsiteScope } from "@/lib/api/v1/website";
import {
  v1DateRangeFields,
  v1PaginationFields,
  resolveDateRange,
  paginate,
} from "@/lib/api/v1/query";

export const BOT_BREAKDOWNS = [
  "count",
  "timeseries",
  "providers",
  "top_pages",
  "categories",
] as const;

export const querySchema = v1DateRangeFields.extend(v1PaginationFields.shape).extend({
  breakdown: z
    .enum(BOT_BREAKDOWNS)
    .default("count")
    .describe("Which bot-traffic view to return."),
  domain: z.string().optional().describe("Filter to a single tracked hostname."),
  category: z
    .enum(BOT_CATEGORIES)
    .optional()
    .describe(`Filter to one bot category: ${BOT_CATEGORIES.join(", ")}.`),
  granularity: z
    .enum(["hour", "day", "week"])
    .optional()
    .describe("Bucket size for breakdown=timeseries. Chosen automatically from the date range if omitted."),
});

const EMPTY_OVERVIEW = {
  total_requests: 0,
  ai_answers: 0,
  indexing: 0,
  training: 0,
  other: 0,
  unique_providers: 0,
};

// GET /api/v1/analytics/bots — Convrs's AI-crawler traffic detector, exposed
// through the exact same getBotFilteringAnalytics() service the dashboard's
// bot-traffic section uses (packages/tinybird/pipes/bot_*.pipe).
export const GET = withApiToken(
  async ({ workspace, searchParams }) => {
    try {
      const query = querySchema.parse(searchParams);

      const scopeError = checkWebsiteScope(workspace, query.websiteId);
      if (scopeError) return scopeError;

      const { start, end, interval } = resolveDateRange(query);

      const result = await getBotFilteringAnalytics({
        workspaceId: workspace.id,
        domain: query.domain,
        category: query.category,
        groupBy: query.breakdown,
        interval,
        start: start?.toISOString(),
        end: end?.toISOString(),
        timezone: query.timezone ?? workspace.timezone ?? "UTC",
        granularity: query.granularity,
      });

      if (query.breakdown === "count") {
        return apiSuccess(result ?? EMPTY_OVERVIEW);
      }

      if (query.breakdown === "timeseries") {
        return apiSuccess(result ?? []);
      }

      // providers / top_pages / categories — small-cardinality lists, but
      // paginate for a consistent contract with the other breakdown endpoints.
      const { rows, pagination } = paginate(
        Array.isArray(result) ? result : [],
        query
      );
      return apiPaginated(rows, pagination);
    } catch (err) {
      return toV1ErrorResponse(err);
    }
  },
  { requiredScope: "analytics.read" }
);
