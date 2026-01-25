import { withWorkspace } from "@/lib/auth/workspace";
import { inviteTeammatesSchema } from "@/lib/zod/schemas/invites";
import { prisma } from "@repo/db";
import { inviteUser } from "@/lib/api/users";

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
