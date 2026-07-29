import { prefixWorkspaceId } from "@/lib/api/workspaces/workspace-id";
import { withSession } from "@/lib/auth";
import { WorkspaceSchema } from "@/lib/zod/schemas/workspaces";
import { prisma } from "@repo/db";
import { NextResponse } from "next/server";

// GET /api/workspaces - get all workspaces for the authenticated user
export const GET = withSession(async ({ session }) => {
  console.log("in get route api/workspaces")
  const workspaces = await prisma.workspace.findMany({
    where: {
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
    orderBy: {
      createdAt: "desc",
    },
  });


  return NextResponse.json(
    workspaces.map((workspace) =>
      WorkspaceSchema.parse({
        ...workspace,
        id: prefixWorkspaceId(workspace.id),
      })
    )
  );
});