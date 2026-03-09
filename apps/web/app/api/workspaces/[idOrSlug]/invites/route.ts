import { withWorkspace } from "@/lib/auth/workspace";
import { inviteTeammatesSchema } from "@/lib/zod/schemas/invites";
import { prisma } from "@repo/db";
import { inviteUser } from "@/lib/api/users";
import {
  getWorkspaceUsersQuerySchema,
  roleSchema,
  workspaceUserSchema,
} from "@/lib/zod/schemas/workspaces";
import { NextResponse } from "next/server";
import { z } from "zod";

// GET /api/workspaces/[idOrSlug]/invites – get invites for a specific workspace
export const GET = withWorkspace(
  async ({ workspace, searchParams }) => {
    const { search, role } = getWorkspaceUsersQuerySchema.parse(searchParams);

    const invites = await prisma.workspaceInvite.findMany({
      where: {
        workspaceId: workspace.id,
        role,
        ...(search && {
          email: { contains: search },
        }),
      },
    });

    const parsedInvites = invites.map((invite) =>
      workspaceUserSchema.parse({
        ...invite,
        id: `${workspace.id}-${invite.email}`, // workspace ID + invite email for the dummy invite
        name: invite.email,
      })
    );

    return NextResponse.json(parsedInvites);
  },
  { requiredPermission: "workspace:read" }
);

export const POST = withWorkspace(
  async ({ req, workspace, session }) => {
    const { teammates } = inviteTeammatesSchema.parse(await req.json());

    if (teammates.length > 10) {
      return new Response(
        JSON.stringify({
          error: "You can invite up to 10 teammates at a time",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const [alreadyInWorkspace] = await Promise.all([
      prisma.workspaceUsers.findMany({
        where: {
          workspaceId: workspace.id,
          user: {
            email: {
              in: teammates.map(({ email }) => email),
            },
          },
        },
        select: {
          user: {
            select: {
              email: true,
            },
          },
        },
      }),
    ]);

    if (alreadyInWorkspace.length > 0) {
      return new Response(
        JSON.stringify({
          error: `The following users are already in the workspace: ${alreadyInWorkspace
            .map((u) => u.user.email)
            .join(", ")}`,
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const res = await Promise.allSettled(
      teammates.map(async ({ email, role }) =>
        inviteUser({
          email,
          role,
          workspace,
          session,
        })
      )
    );

    if (res.some((result) => result.status === "rejected")) {
      return new Response(
        JSON.stringify({
          error: `Failed to send some invites`,
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      );
    }
    // Your invite handling logic here
    return new Response(JSON.stringify({ message: "Invite sent" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  },
  { requiredPermission: "workspace:write" }
);

const updateInviteRoleSchema = z.object({
  email: z.string().email(),
  role: roleSchema,
});

// PATCH /api/workspaces/[idOrSlug]/invites – update a pending invite's role
export const PATCH = withWorkspace(
  async ({ req, workspace }) => {
    const { email, role } = updateInviteRoleSchema.parse(await req.json());

    await prisma.workspaceInvite.update({
      where: { email_workspaceId: { email, workspaceId: workspace.id } },
      data: { role },
    });

    return NextResponse.json({ message: "Invite role updated" });
  },
  { requiredPermission: "workspace:write" }
);
