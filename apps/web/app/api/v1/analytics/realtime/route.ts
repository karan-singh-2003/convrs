import { withApiToken } from "@/lib/auth";
import { getLiveStats } from "@/lib/analytics/live-visitors";
import { apiSuccess } from "@/lib/api/v1/response";
import { toV1ErrorResponse } from "@/lib/api/v1/errors";

// GET /api/v1/analytics/realtime — live visitor count, current pages,
// referrers, countries, and geo points for the realtime map.
//
// Reuses the exact same getLiveStats() the dashboard's realtime page and
// /api/live/count call. IMPORTANT: the live-visitor Redis keys are written
// by the tracker's heartbeat call keyed by `projectToken` (the public site
// ID embedded in the tracking snippet — see packages/tracker/src/analytics.js
// sendHeartbeat()), NOT by `workspace.id`. Calling getLiveStats(workspace.id)
// would silently query a Redis key nothing ever writes to and always return
// zeros, so this passes workspace.projectToken instead.
export const GET = withApiToken(
  async ({ workspace }) => {
    try {
      if (!workspace.projectToken) {
        return apiSuccess({
          count: 0,
          pages: [],
          points: [],
          referrers: [],
          countries: [],
        });
      }

      const stats = await getLiveStats(workspace.projectToken);
      return apiSuccess(stats);
    } catch (err) {
      return toV1ErrorResponse(err);
    }
  },
  { requiredScope: "analytics.read" }
);
