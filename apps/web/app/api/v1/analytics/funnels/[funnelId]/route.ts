import { withApiToken } from "@/lib/auth";
import { getWorkspaceFunnelById } from "@/lib/api/funnels/query-funnels";
import { getFunnelAnalytics } from "@/lib/analytics/get-funnel-analytics";
import { apiSuccess, apiError } from "@/lib/api/v1/response";
import { toV1ErrorResponse } from "@/lib/api/v1/errors";

// GET /api/v1/analytics/funnels/:funnelId — step-by-step conversion counts
// plus each step's top referrers/countries, reusing getFunnelAnalytics()
// exactly (packages/tinybird/pipes/v1_funnel*.pipe) — the same call the
// dashboard's /analytics/funnel route makes, just resolving `steps` from a
// saved Funnel instead of an ad hoc list.
//
// Two known, pre-existing limitations in the underlying pipes (not
// introduced here, and not worked around, since fixing Tinybird pipes is
// out of scope for this API layer):
//
// 1. v1_funnel.pipe only matches a step against goal-event names
//    (`event_type = 'goals' AND event_name IN (steps)`). A FunnelStep with
//    type "page_view" (matched by URL path, not a goal name) is never
//    satisfied by this pipe, so such a step will always show 0 users. This
//    mirrors the dashboard's own funnel feature exactly — it has the same
//    gap.
// 2. Neither v1_funnel, v1_funnel_step_sources, nor v1_funnel_step_countries
//    accept a date range — getFunnelAnalytics() always queries all-time
//    data. This endpoint intentionally does not accept startAt/endAt/
//    interval params, since accepting and silently ignoring them would be
//    misleading.
//
// We also deliberately do NOT pass `totalRevenue` (unlike the dashboard
// route, which derives a `stepValue` as totalRevenue ÷ step visitors — its
// own code labels this "a simple attribution" assumption). That's an
// invented approximation, not a real per-step revenue figure, so the
// public API omits it rather than exposing a manufactured metric.
export const GET = withApiToken(
  async ({ workspace, params }) => {
    try {
      const funnel = await getWorkspaceFunnelById(
        workspace.id,
        params.funnelId
      );

      if (!funnel) {
        return apiError("not_found", "Funnel not found.");
      }

      const steps = funnel.steps.map((s) => s.value);
      const data = await getFunnelAnalytics({
        workspaceId: workspace.id,
        steps,
      });

      return apiSuccess(data);
    } catch (err) {
      return toV1ErrorResponse(err);
    }
  },
  { requiredScope: "analytics.read" }
);
