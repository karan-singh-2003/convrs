import { prisma } from "@repo/db";

export async function hasWorkspaceAccess(workspaceId: string) {
  const workspace = await prisma.workspace.findUnique({
    where: {
      id: workspaceId,
    },
    select: {
      subscriptionStatus: true,
      freeTrialEndDate: true,
    },
  });

  if (!workspace) {
    return false;
  }

  if (workspace.subscriptionStatus === "active") {
    return true;
  }

  if (
    workspace.subscriptionStatus === "trialing" &&
    workspace.freeTrialEndDate &&
    workspace.freeTrialEndDate > new Date()
  ) {
    return true;
  }

  return false;
}