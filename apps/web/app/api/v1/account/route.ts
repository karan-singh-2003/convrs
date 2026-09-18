import { withApiToken } from "@/lib/auth";
import { prisma } from "@repo/db";
import { prefixWorkspaceId } from "@/lib/api/workspaces/workspace-id";
import { isEntitled } from "@/lib/billing/entitlement";
import { apiSuccess } from "@/lib/api/v1/response";
import { toV1ErrorResponse } from "@/lib/api/v1/errors";

// GET /api/v1/account — verify a token works and see basic authenticated
// context. Any valid, non-expired token can call this regardless of scope,
// same as /api/v1/websites requiring only that the token exists.
export const GET = withApiToken(
  async ({ workspace, token }) => {
    try {
      const record = await prisma.restrictedToken.findUnique({
        where: { id: token.id },
        select: { user: { select: { id: true, name: true, email: true } } },
      });

      return apiSuccess({
        user: record?.user
          ? {
              id: record.user.id,
              name: record.user.name,
              email: record.user.email,
            }
          : null,
        website: {
          id: prefixWorkspaceId(workspace.id),
          name: workspace.name,
          domain: workspace.domain,
        },
        token: {
          name: token.name,
          scopes: token.scopes,
        },
        plan: {
          plan: workspace.plan,
          planFamily: workspace.planFamily,
          status: isEntitled(workspace) ? "active" : "inactive",
        },
      });
    } catch (err) {
      return toV1ErrorResponse(err);
    }
  }
  // No requiredScope: this endpoint only proves "this token is valid" —
  // any token, regardless of which scopes it was granted, can call it.
);
