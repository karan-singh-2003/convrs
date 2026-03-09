import { withWorkspace } from "@/lib/auth";
import { getWorkspaceUsersQuerySchema, roleSchema, workspaceUserSchema } from "@/lib/zod/schemas/workspaces";
import { prisma } from "@repo/db";
import { NextResponse } from "next/server";
import { z } from "zod";

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

const updateUserRoleSchema = z.object({
  userId: z.string(),
  role: roleSchema,
});

// PATCH /api/workspaces/[idOrSlug]/users – update a member's role
export const PATCH = withWorkspace(
  async ({ req, workspace }) => {
    const { userId, role } = updateUserRoleSchema.parse(await req.json());

    // Cannot demote the last owner
    if (role !== "owner") {
      const ownerCount = await prisma.workspaceUsers.count({
        where: { workspaceId: workspace.id, role: "owner" },
      });
      const targetIsOwner = await prisma.workspaceUsers.findUnique({
        where: { userId_workspaceId: { userId, workspaceId: workspace.id } },
        select: { role: true },
      });
      if (ownerCount === 1 && targetIsOwner?.role === "owner") {
        return NextResponse.json(
          { error: { message: "Cannot demote the last owner of a workspace" } },
          { status: 400 }
        );
      }
    }

    await prisma.workspaceUsers.update({
      where: { userId_workspaceId: { userId, workspaceId: workspace.id } },
      data: { role },
    });

    return NextResponse.json({ message: "Role updated" });
  },
  { requiredPermission: "workspace:write" }
);