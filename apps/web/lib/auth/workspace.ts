import { getSession, Session } from "./utils";
import { WorkspaceProps } from "../types";
import {
  getPermissionsForRole,
  PermissionAction,
} from "../api/rbac/permissions";
import { prisma } from "@repo/db";
import { getSearchParams } from "@repo/utils";
import { normalizeWorkspaceId } from "../api/workspaces/workspace-id";
import { NextRequest } from "next/server";
import { isEntitled, upgradeRequiredResponse } from "../billing/entitlement";

interface withWorkspaceHandler {
  ({
    req,
    params,
    searchParams,
    session,
    workspace,
    permission,
  }: {
    req: NextRequest;
    session: Session;
    params: Record<string, string>;
    searchParams: Record<string, string>;
    workspace: WorkspaceProps;
    permission: PermissionAction;
  }): Promise<Response>;
}

export const withWorkspace = (
  handler: withWorkspaceHandler,
  {
    requiredPermission,
    skipPermissionChecks,
    skipEntitlementCheck,
  }: {
    requiredPermission: PermissionAction;
    skipPermissionChecks?: boolean;
    /**
     * Set only on routes that MUST keep working when the workspace has no
     * active subscription/trial entitlement — the billing-recovery surface
     * itself (checkout/manage/invoices/payment-methods/attach/detach/
     * start-free-trial/the deprecated upgrade shim) and read/delete of the
     * bare workspace record (identity data the dashboard shell + billing
     * page need to render at all, and "delete an unwanted workspace" which
     * shouldn't require paying first). Every other workspace-scoped route
     * requires entitlement by default — see lib/billing/entitlement.ts.
     */
    skipEntitlementCheck?: boolean;
  }
) => {
  return async (
    req: NextRequest,
    context: { params: Promise<Record<string, string>> }
  ): Promise<Response> => {
    const params = (await context.params) || {};
    const searchParams = getSearchParams(req.url) as Record<string, string>;

    try {
      let workspace: WorkspaceProps | null;
      let workspaceId: string | undefined;
      let workspaceSlug: string | undefined;
      let permission: PermissionAction[] = [];

      const idOrSlug =
        params.idOrSlug ||
        params.slug ||
        searchParams.workspaceId ||
        searchParams.workspaceSlug;

      const session = await getSession();
      if (!session.user.id) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        });
      }

      if (idOrSlug) {
        if (idOrSlug.startsWith("ws_")) {
          workspaceId = normalizeWorkspaceId(idOrSlug);
        } else {
          workspaceSlug = idOrSlug;
        }
      }

      workspace = (await prisma.workspace.findUnique({
        where: {
          id: workspaceId || undefined,
          slug: workspaceSlug || undefined,
        },
        include: {
          users: {
            where: {
              userId: session.user.id,
            },
            select: {
              role: true,
            },
          },
        },
      })) as WorkspaceProps | null;

      // workspace does not exists
      if (!workspace) {
        return new Response(JSON.stringify({ error: "Workspace not found" }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        });
      }
      // Deploy 5: the per-request trial-expiry flip is removed. It only ever
      // wrote `Workspace.subscriptionStatus` for the ONE workspace on the
      // current request, never the owning `Subscription` (and never fanned
      // out to sibling workspaces on a Growth trial) — a genuine
      // Subscription<->Workspace drift source, plus a write on every
      // authenticated API call. It's also unnecessary: `isEntitled` /
      // `isWorkspaceEntitled` (@repo/analytics) already deny access for a
      // "trialing" workspace once `freeTrialEndDate` is in the past,
      // regardless of the cached status string. The cached label itself is
      // corrected — atomically, for every sibling workspace — by the hourly
      // reconciliation cron (`reconcileBilling`'s lapsed-cardless-trial pass)
      // or the next webhook, not by this per-request side effect.

      // workspace exits but user is not a member
      if (workspace.users.length === 0) {
        const pendingInvite = await prisma.workspaceInvite.findUnique({
          where: {
            email_workspaceId: {
              email: session.user.email!,
              workspaceId: workspace.id,
            },
          },
          select: { expires: true },
        });

        if (!pendingInvite) {
          return new Response(JSON.stringify({ error: "Unauthorized" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
          });
        } else if (pendingInvite.expires < new Date()) {
          return new Response(JSON.stringify({ error: "Invite expired" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
          });
        } else {
          return new Response(JSON.stringify({ error: "pending invite" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
          });
        }
      }

      // check permissions
      permission = getPermissionsForRole(workspace.users[0].role);

      if (!skipPermissionChecks && !permission.includes(requiredPermission)) {
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403,
          headers: { "Content-Type": "application/json" },
        });
      }

      // Highest-priority fix from the billing audit: dashboard *pages* redirect
      // an unentitled workspace to /{slug}/billing (hasWorkspaceAccess, in the
      // [slug] layout), but that's a page-render-only gate — it never ran for
      // a direct API call. Enforce the same policy here, at the one shared
      // entry point nearly every workspace-scoped route goes through, so a
      // session cookie + membership alone can no longer read/write paid data
      // once the subscription is inactive/canceled/expired or past its trial
      // or past_due-grace window. Routes that must stay reachable regardless
      // (billing management, workspace identity) opt out explicitly.
      if (!skipEntitlementCheck && !isEntitled(workspace)) {
        return upgradeRequiredResponse(
          "This workspace does not have an active subscription or trial.",
        );
      }

      return handler({
        req,
        params,
        searchParams,
        session,
        workspace,
        permission: requiredPermission,
      });
    } catch (error) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }
  };
};
