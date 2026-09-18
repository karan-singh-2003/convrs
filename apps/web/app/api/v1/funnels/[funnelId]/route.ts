import { withApiToken } from "@/lib/auth";
import { getWorkspaceFunnelById } from "@/lib/api/funnels/query-funnels";
import { apiSuccess, apiError } from "@/lib/api/v1/response";
import { toV1ErrorResponse } from "@/lib/api/v1/errors";

// GET /api/v1/funnels/:funnelId — one funnel's definition and ordered
// steps. getWorkspaceFunnelById() filters by workspaceId internally, so a
// funnel ID from another workspace 404s rather than leaking.
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

      return apiSuccess(funnel);
    } catch (err) {
      return toV1ErrorResponse(err);
    }
  },
  { requiredScope: "analytics.read" }
);
