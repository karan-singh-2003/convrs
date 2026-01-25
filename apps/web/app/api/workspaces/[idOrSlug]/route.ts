import { NextResponse } from "next/server";
import { prefixWorkspaceId } from "@/lib/api/workspaces/workspace-id";
import { withSession } from "@/lib/auth/session";
import { prisma } from "@repo/db";
import { WorkspaceSchema } from "@/lib/zod/schemas/workspaceSchema";

// GET /api/workspaces/[idOrSlug] - get a specific workspace by id or slug
export const GET = withSession(async ({ session, params }) => {
  const { idOrSlug } = params;

  const workspace = await prisma.workspace.findFirst({
    where: {
      OR: [{ slug: idOrSlug }, { id: idOrSlug }],
      users: {
        some: {
          userId: session.user.id,
        },
      },
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
  });

  if (!workspace) {
    return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
  }

  const res = WorkspaceSchema.parse({
    ...workspace,
    id: prefixWorkspaceId(workspace.id),
  });

  return NextResponse.json(res);
});
