import { prisma } from "@repo/db";
import { getSession } from "@/lib/auth";
import { getPermissionsForRole, PermissionAction } from "@/lib/api/rbac/permissions";
import { normalizeWorkspaceId } from "@/lib/api/workspaces/workspace-id";
import { isEntitled } from "@/lib/billing/entitlement";

type Result =
  | { ok: true; workspaceId: string }
  | { ok: false; status: number; error: string };

/**
 * Session + membership + permission check for /api/integrations* — these
 * routes previously had no authentication at all (any caller who knew or
 * guessed a workspace id/slug could read, and even disconnect, another
 * workspace's revenue-provider connections). Mirrors the same
 * session-then-role-permission pattern withWorkspace() and
 * resolveWorkspaceForAnalytics() already use elsewhere, kept as a small
 * standalone helper here because the two integrations routes read the
 * workspace identifier from different places (query string for GET, JSON
 * body for DELETE) and withWorkspace() only looks at params/query.
 */
export async function authorizeWorkspaceForIntegrations(
  workspaceIdentifier: string | undefined,
  requiredPermission: PermissionAction
): Promise<Result> {
  const identifier = workspaceIdentifier?.trim();
  if (!identifier) {
    return { ok: false, status: 400, error: "Missing workspace id" };
  }

  const session = await getSession();
  if (!session?.user?.id) {
    return { ok: false, status: 401, error: "Unauthorized" };
  }

  const normalized = normalizeWorkspaceId(identifier);
  const workspace = await prisma.workspace.findFirst({
    where: { OR: [{ id: normalized }, { slug: identifier }] },
    include: {
      users: { where: { userId: session.user.id }, select: { role: true } },
    },
  });

  if (!workspace) {
    return { ok: false, status: 404, error: "Workspace not found" };
  }

  if (workspace.users.length === 0) {
    return { ok: false, status: 401, error: "Unauthorized" };
  }

  const permissions = getPermissionsForRole(workspace.users[0].role);
  if (!permissions.includes(requiredPermission)) {
    return { ok: false, status: 403, error: "Forbidden" };
  }

  // This mirrors withWorkspace()'s entitlement gate — revenue-integration
  // connections are workspace data/feature access like any other, so they
  // must not stay reachable by direct API call once the subscription is
  // inactive/canceled/expired or past its trial or past_due-grace window.
  if (!isEntitled(workspace)) {
    return {
      ok: false,
      status: 402,
      error: "This workspace does not have an active subscription or trial.",
    };
  }

  return { ok: true, workspaceId: workspace.id };
}
