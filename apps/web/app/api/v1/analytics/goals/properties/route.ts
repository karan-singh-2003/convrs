import * as z from "zod/v4";
import { withApiToken } from "@/lib/auth";
import { getAnalytics } from "@/lib/analytics/get-analytics";
import { apiPaginated } from "@/lib/api/v1/response";
import { toV1ErrorResponse } from "@/lib/api/v1/errors";
import { checkWebsiteScope } from "@/lib/api/v1/website";
import {
  v1DateRangeFields,
  v1PaginationFields,
  resolveDateRange,
  paginate,
} from "@/lib/api/v1/query";

// Deliberately NOT reusing v1FilterFields here: the underlying Tinybird node
// (v1_group_by.pipe's group_by_goal_properties) only conditions its WHERE
// clause on workspaceId, goalName, start, and end — it has no hostname/
// page/device/etc. filter branches and doesn't wire into the generic
// `filters` JSON mechanism the other group_by nodes use. Accepting those
// params here and silently ignoring them would be misleading, so this
// endpoint's query schema only exposes what the pipe actually honors.
export const querySchema = v1DateRangeFields
  .pick({ websiteId: true, interval: true, startAt: true, endAt: true, timezone: true })
  .extend(v1PaginationFields.shape)
  .extend({
    goal: z
      .string()
      .optional()
      .describe(
        "The goal name to analyze (from GET /api/v1/goals). If omitted, aggregates properties across all goal events, which usually mixes unrelated property keys together."
      ),
  });

// GET /api/v1/analytics/goals/properties — grouped custom event-property
// values for goal-completion events, reusing getAnalytics() with
// groupBy: "goal_properties" exactly as the dashboard does (same pipe:
// packages/tinybird/pipes/v1_group_by.pipe's group_by_goal_properties node).
export const GET = withApiToken(
  async ({ workspace, searchParams }) => {
    try {
      const query = querySchema.parse(searchParams);

      const scopeError = checkWebsiteScope(workspace, query.websiteId);
      if (scopeError) return scopeError;

      const { start, end, interval } = resolveDateRange(query);

      const rows = await getAnalytics({
        event: "goals",
        groupBy: "goal_properties",
        workspaceId: workspace.id,
        interval,
        start,
        end,
        timezone: query.timezone ?? workspace.timezone ?? "UTC",
        goalName: query.goal,
      });

      const properties = (Array.isArray(rows) ? rows : []).map((r: any) => ({
        propertyKey: r.prop_key ?? "",
        propertyValue:
          typeof r.goal_property === "string" && typeof r.prop_key === "string"
            ? r.goal_property.slice(r.prop_key.length + 2)
            : "",
        count: r.clicks ?? 0,
      }));

      const { rows: pageRows, pagination } = paginate(properties, query);
      return apiPaginated(pageRows, pagination);
    } catch (err) {
      return toV1ErrorResponse(err);
    }
  },
  { requiredScope: "goals.read" }
);
