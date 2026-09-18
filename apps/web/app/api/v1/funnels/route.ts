import * as z from "zod/v4";
import { withApiToken } from "@/lib/auth";
import { listWorkspaceFunnels } from "@/lib/api/funnels/query-funnels";
import { apiPaginated } from "@/lib/api/v1/response";
import { toV1ErrorResponse } from "@/lib/api/v1/errors";
import { checkWebsiteScope } from "@/lib/api/v1/website";
import { v1PaginationFields } from "@/lib/api/v1/query";

export const querySchema = v1PaginationFields.extend({
  websiteId: z.string().optional(),
});

// GET /api/v1/funnels — list this website's funnel definitions (name +
// ordered steps), reusing the same Funnel/FunnelStep Prisma models and
// workspace scoping as the dashboard's own /funnels route.
export const GET = withApiToken(
  async ({ workspace, searchParams }) => {
    try {
      const query = querySchema.parse(searchParams);

      const scopeError = checkWebsiteScope(workspace, query.websiteId);
      if (scopeError) return scopeError;

      const { rows, hasMore } = await listWorkspaceFunnels(workspace.id, {
        page: query.page,
        limit: query.limit,
      });

      return apiPaginated(rows, {
        page: query.page,
        limit: query.limit,
        hasMore,
      });
    } catch (err) {
      return toV1ErrorResponse(err);
    }
  },
  { requiredScope: "analytics.read" }
);
