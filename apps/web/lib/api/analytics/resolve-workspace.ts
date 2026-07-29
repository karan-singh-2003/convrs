import { prisma } from "@repo/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { getPermissionsForRole } from "@/lib/api/rbac/permissions";
import { normalizeWorkspaceId } from "@/lib/api/workspaces/workspace-id";

type Workspace = NonNullable<Awaited<ReturnType<typeof prisma.workspace.findUnique>>>;

type ResolveResult =
  | { ok: true; workspace: Workspace }
  | { ok: false; status: number; error: string };

/**
 * Shared auth + workspace lookup for analytics endpoints (/api/analytics and
 * /api/analytics/bot-filtering), so the two routes can't drift on who's
 * allowed to read analytics data.
 *
 * Note: this intentionally preserves the existing /api/analytics behavior of
 * allowing unauthenticated reads for workspaces marked isPublic. It does NOT
 * use the stricter withWorkspace() wrapper (which always requires a session
 * + membership, no public bypass) — if bot-filtering should be
 * membership-only regardless of isPublic, swap this for withWorkspace.
 */
export async function resolveWorkspaceForAnalytics(
  searchParams: {
    workspaceId?: string;
    workspaceSlug?: string;
  }
): Promise<ResolveResult> {
  const workspaceIdOrSlug = searchParams.workspaceId || searchParams.workspaceSlug;

  if (!workspaceIdOrSlug) {
    return { ok: false, status: 400, error: "workspaceId or workspaceSlug is required" };
  }

  // Fixed: real ID prefix is "ws_", not "" (which every string starts with).
  const isPrefixedWorkspaceId = workspaceIdOrSlug.startsWith("ws_");
  const session = await getServerSession(authOptions);

  const workspace = await prisma.workspace.findUnique({
    where: isPrefixedWorkspaceId
      ? { id: normalizeWorkspaceId(workspaceIdOrSlug) }
      : { slug: workspaceIdOrSlug },
    include: {
      users: session?.user?.id
        ? { where: { userId: session.user.id }, select: { role: true } }
        : false,
    },
  });

  if (!workspace) {
    return { ok: false, status: 404, error: "Workspace not found" };
  }

  if (!workspace.isPublic) {
    if (!session?.user?.id || !workspace.users?.length) {
      return { ok: false, status: 401, error: "Unauthorized" };
    }
    const permissions = getPermissionsForRole(workspace.users[0].role);
    if (!permissions.includes("analytics.read")) {
      return { ok: false, status: 403, error: "Forbidden" };
    }
  }

  return { ok: true, workspace };
}