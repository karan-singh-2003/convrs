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
  }: { requiredPermission: PermissionAction; skipPermissionChecks?: boolean }
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
      if (!workspace || !workspace.users || workspace.users.length === 0) {
        return new Response(JSON.stringify({ error: "Workspace not found" }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        });
      }

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
