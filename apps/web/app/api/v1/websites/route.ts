import { withApiToken } from "@/lib/auth";
import { apiSuccess } from "@/lib/api/v1/response";
import { toPublicWebsite } from "@/lib/api/v1/website";

// GET /api/v1/websites — websites this token can access. A token is bound
// to exactly one workspace (RestrictedToken.workspaceId), so this always
// returns a single-item array today.
export const GET = withApiToken(
  async ({ workspace }) => {
    return apiSuccess([toPublicWebsite(workspace)]);
  },
  { requiredScope: "websites.read" }
);
