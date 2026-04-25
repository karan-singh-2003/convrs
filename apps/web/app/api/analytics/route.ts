import { analyticsQuerySchema } from "@/lib/zod/schemas/analytics";
import { getAnalytics } from "@/lib/analytics/get-analytics";
import { NextResponse } from "next/server";
import { getSearchParams } from "@repo/utils";
import { prisma } from "@repo/db";
import { normalizeWorkspaceId } from "@/lib/api/workspaces/workspace-id";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { getPermissionsForRole } from "@/lib/api/rbac/permissions";

export const GET = async (req: Request) => {
  const searchParams = getSearchParams(req.url);

  // Parse query early so invalid requests fail consistently.
  const parsedParams = analyticsQuerySchema.parse(searchParams);

  const workspaceIdOrSlug =
    searchParams.workspaceId || searchParams.workspaceSlug;

  if (!workspaceIdOrSlug) {
    return new Response(
      JSON.stringify({ error: "workspaceId or workspaceSlug is required" }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  const isPrefixedWorkspaceId = workspaceIdOrSlug.startsWith("");

  const session = await getServerSession(authOptions);

  console.log("workspaceIdOrSlug:", workspaceIdOrSlug);

  const workspace = await prisma.workspace.findUnique({
    where: isPrefixedWorkspaceId
      ? { id: normalizeWorkspaceId(workspaceIdOrSlug) }
      : { slug: workspaceIdOrSlug },
    include: {
      users: session?.user?.id
        ? {
            where: { userId: session.user.id },
            select: { role: true },
          }
        : false,
    },
  });


  if (!workspace) {
    return new Response(JSON.stringify({ error: "Workspace not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  const isPublicWorkspace = Boolean(workspace.isPublic);

  if (!isPublicWorkspace) {
    if (!session?.user?.id || !workspace.users?.length) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const permissions = getPermissionsForRole(workspace.users[0].role);
    if (!permissions.includes("analytics.read")) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      });
    }
  }

  const data = await getAnalytics({
    ...parsedParams,
    workspaceId: workspace.id,
  });

  return NextResponse.json({ data });
};
