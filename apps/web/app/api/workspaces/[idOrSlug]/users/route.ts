import { withWorkspace } from "@/lib/auth";
import { getWorkspaceUsersQuerySchema, workspaceUserSchema } from "@/lib/zod/schemas/workspaces";
import { prisma } from "@repo/db";
import { NextResponse } from "next/server";

export const GET = withWorkspace(
  async ({ workspace, searchParams }) => {
    const { search, role } = getWorkspaceUsersQuerySchema.parse(searchParams);

    const users = await prisma.workspaceUsers.findMany({
      where: {
        workspaceId: workspace.id,
        role,
        ...(search && {
          user: {
            OR: [
              { name: { contains: search } },
              { email: { contains: search } },
            ],
          },
        }),
      },
      include: {
        user: true,
      },
    });

    const parsedUsers = users.map(({ user, ...rest }) =>
      workspaceUserSchema.parse({
        ...rest,
        ...user,
        name: user.name || user.email ,
        createdAt: rest.createdAt, // preserve the createdAt field from WorkspaceUsers
      }),
    );

    return NextResponse.json(parsedUsers);
  },
  {
    requiredPermission: "workspace:read",
  },
);