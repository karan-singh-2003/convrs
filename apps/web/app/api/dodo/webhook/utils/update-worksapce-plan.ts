import { WorkspaceProps } from "@/lib/types";
import { getPlanFromPriceId } from "@repo/utils";
import { prisma } from "@repo/db";

export async function updateWorkspacePlan({
  workspace,
  priceId,
}: {
  workspace: Pick<WorkspaceProps, "id" | "paymentFailedAt"> & { plan: string };
  priceId: string;
}) {
  const { plan: newPlan } = getPlanFromPriceId({ priceId });
  if (!newPlan) {
    return;
  }

  const newPlanName = newPlan.name.toLowerCase();
  if (workspace.plan !== newPlanName) {
    const [updatedWorkspace] = await Promise.allSettled([
      prisma.workspace.update({
        where: { id: workspace.id },
        data: {
          plan: newPlanName,
          paymentFailedAt: null,
        },
        include: {
          users: {
            where: {
              role: "owner",
            },
            select: {
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                },
              },
            },
            orderBy: {
              createdAt: "asc",
            },
            take: 1,
          },
        },
      }),
    ]);

    if (
      updatedWorkspace.status === "fulfilled" &&
      updatedWorkspace.value.users.length
    ) {
      const workspaceOwner = updatedWorkspace.value.users[0].user;
    } else if (workspace.paymentFailedAt) {
      await prisma.workspace.update({
        where: { id: workspace.id },
        data: {
          paymentFailedAt: null,
        },
      });
    }
  }
}
