import { withApiToken } from "@/lib/auth";
import { apiSuccess } from "@/lib/api/v1/response";
import { toV1ErrorResponse } from "@/lib/api/v1/errors";
import {
  OVERVIEW_METRICS,
  DIMENSION_METRICS,
  REVENUE_METRICS,
} from "@/lib/api/v1/metrics";
import { V1_INTERVALS } from "@/lib/api/v1/query";
import { BOT_CATEGORIES } from "@/lib/analytics/get-bot-analytics";
import { BOT_BREAKDOWNS } from "@/app/api/v1/analytics/bots/route";
import { DIMENSIONS as PAGE_DIMENSIONS } from "@/app/api/v1/analytics/pages/route";
import { DIMENSIONS as SOURCE_DIMENSIONS } from "@/app/api/v1/analytics/sources/route";
import { DIMENSIONS as GEO_DIMENSIONS } from "@/app/api/v1/analytics/geo/route";
import { DIMENSIONS as DEVICE_DIMENSIONS } from "@/app/api/v1/analytics/devices/route";
import { listWorkspaceGoals } from "@/lib/api/goals/query-goals";

// GET /api/v1/meta — the actual metrics, dimensions, and goal catalogue
// this website's data supports. Everything here is derived from the same
// constants/queries the other v1 routes use, not a hand-maintained second
// list, so it can't drift from what those endpoints actually accept.
//
// No requiredScope: this is a discovery/metadata endpoint, meant to be
// callable by any valid token regardless of which resource scopes it was
// granted (e.g. a token scoped only to payments.read should still be able
// to introspect what the API supports) — same "any valid token" reasoning
// as /api/v1/account.
export const GET = withApiToken(
  async ({ workspace }) => {
    try {
      const { rows: goals } = await listWorkspaceGoals(workspace.id, {
        page: 1,
        limit: 500,
      });

      return apiSuccess({
        intervals: V1_INTERVALS,
        analytics: {
          metrics: OVERVIEW_METRICS,
        },
        breakdowns: {
          pages: { metrics: DIMENSION_METRICS, dimensions: Object.keys(PAGE_DIMENSIONS) },
          sources: { metrics: DIMENSION_METRICS, dimensions: Object.keys(SOURCE_DIMENSIONS) },
          geo: { metrics: DIMENSION_METRICS, dimensions: Object.keys(GEO_DIMENSIONS) },
          devices: { metrics: DIMENSION_METRICS, dimensions: Object.keys(DEVICE_DIMENSIONS) },
        },
        revenue: {
          metrics: REVENUE_METRICS,
        },
        bots: {
          breakdowns: BOT_BREAKDOWNS,
          categories: BOT_CATEGORIES,
        },
        goals: goals.map((g) => g.eventName),
      });
    } catch (err) {
      return toV1ErrorResponse(err);
    }
  }
);
