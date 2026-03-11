import { onboardingStepCache } from "@/lib/api/workspaces/onboarding-step-cache";
import { withSession } from "@/lib/auth/session";
import { prisma } from "@repo/db";

export const POST = withSession(async ({ session, params }) => {
  const { idOrSlug: slug } = params;

  const invite = await prisma.workspaceInvite.findFirst({
    where: {
      email: session.user.email,
      workspace: {
        slug,
      },
    },
  });


  if (!invite) {
    return new Response(JSON.stringify({ message: "Invite not found" }), {
      status: 404,
    });
  }
  if (invite.expires < new Date()) {
    return new Response(JSON.stringify({ message: "Invite expired" }), {
      status: 400,
    });
  }

  //   add user to workspace

  // Check if user is already a member
  const existingMembership = await prisma.workspaceUsers.findFirst({
    where: {
      userId: session.user.id,
      workspaceId: invite.workspaceId,
    },
  });
  if (existingMembership) {
    return new Response(
      JSON.stringify({ message: "User is already a member of workspace" }),
      {
        status: 400,
      }
    );
  }

  const workspace = await prisma.$transaction(async (tx) => {
    await tx.workspaceUsers.create({
      data: {
        userId: session.user.id,
        role: invite.role,
        workspaceId: invite.workspaceId,
      },
    });

    await tx.workspaceInvite.delete({
      where: {
        email_workspaceId: {
          email: session.user.email,
          workspaceId: invite.workspaceId,
        },
      },
    });

    return tx.workspace.findUnique({
      where: {
        id: invite.workspaceId,
      },
    });
  });

  if (!workspace) {
    return new Response(JSON.stringify({ message: "Workspace not found" }), {
      status: 404,
    });
  }

  if (!session.user.defaultWorkspace) {
    await prisma.user.update({
      where: {
        id: session.user.id,
      },
      data: {
        defaultWorkspace: workspace.id,
      },
    });
  }

  await onboardingStepCache.set({
    userId: session.user.id,
    step: "completed",
  });
  return new Response(JSON.stringify({ message: "Invite accepted" }), {
    status: 200,
  });
});
