import * as z from "zod/v4";
import { withApiToken } from "@/lib/auth";
import { getGoalsTimeseries } from "@/lib/analytics/get-goal-timeseries";
import { apiSuccess } from "@/lib/api/v1/response";
import { toV1ErrorResponse } from "@/lib/api/v1/errors";
import { checkWebsiteScope } from "@/lib/api/v1/website";
import { v1DateRangeFields, resolveDateRange } from "@/lib/api/v1/query";

export const querySchema = v1DateRangeFields.extend({
  goals: z
    .string()
    .optional()
    .describe(
      "Comma-separated goal names to filter to (matches names from GET /api/v1/goals). Defaults to all goals."
    ),
});

// GET /api/v1/analytics/goals — goal completions over time, backed by the
// same v1_goals_timeseries_pipe the dashboard uses.
export const GET = withApiToken(
  async ({ workspace, searchParams }) => {
    try {
      const query = querySchema.parse(searchParams);

      const scopeError = checkWebsiteScope(workspace, query.websiteId);
      if (scopeError) return scopeError;

      const { start, end, interval } = resolveDateRange(query);

      const goalNames = query.goals
        ?.split(",")
        .map((g) => g.trim())
        .filter(Boolean);

      const rows = await getGoalsTimeseries({
        workspaceId: workspace.id,
        interval,
        start,
        end,
        timezone: query.timezone ?? workspace.timezone ?? "UTC",
        goalNames,
      });

      const points = (rows ?? []).map((r) => ({
        date: r.groupByField,
        goal: r.goal,
        count: r.count,
      }));

      return apiSuccess(points);
    } catch (err) {
      return toV1ErrorResponse(err);
    }
  },
  { requiredScope: "goals.read" }
);
