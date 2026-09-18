import { withApiToken } from "@/lib/auth";
import { apiSuccess } from "@/lib/api/v1/response";
import { checkWebsiteScope, toPublicWebsite } from "@/lib/api/v1/website";

// GET /api/v1/websites/:websiteId
export const GET = withApiToken(
  async ({ workspace, params }) => {
    const scopeError = checkWebsiteScope(workspace, params.websiteId);
    if (scopeError) return scopeError;

    return apiSuccess(toPublicWebsite(workspace));
  },
  { requiredScope: "websites.read" }
);
