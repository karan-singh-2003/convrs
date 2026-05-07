import type { WorkspaceProps } from "@/lib/types";
import { getPlanFromProductId } from "@repo/utils";
import { prisma } from "@repo/db";
import { WorkspacePlan } from "@prisma/client";
import UpgradeEmail from "@repo/email/templates/upgrade-email";
import { sendBatchEmail } from "@repo/email";

export async function updateWorkspacePlan({
  workspace,
  productId,
}: {
  workspace: Pick<WorkspaceProps, "id" | "paymentFailedAt"> & {
    plan: WorkspaceProps["plan"];
  };
  productId: string;
}) {
  const { plan: newPlan } = getPlanFromProductId(productId);
  if (!newPlan) return;

  const newPlanName = newPlan.name.toLowerCase();

  // Validate the resolved name is actually a known Prisma enum value
  // before writing — catches any pricing.ts/schema drift at runtime.
  if (!(newPlanName in WorkspacePlan)) {
    console.error(
      `[updateWorkspacePlan] "${newPlanName}" is not a valid WorkspacePlan enum value`
    );
    return;
  }

  const planEnumValue = newPlanName as WorkspacePlan;

  if (workspace.paymentFailedAt) {
    await prisma.workspace.update({
      where: { id: workspace.id },
      data:  { paymentFailedAt: null },
    });
  }

  if (workspace.plan === planEnumValue) return;

  const updatedWorkspace = await prisma.workspace.update({
    where: { id: workspace.id },
    data: {
      plan:            planEnumValue,
      paymentFailedAt: null,
    },
    select: {
      users: {
        where:   { role: "owner" },
        select:  { user: { select: { id: true, name: true, email: true } } },
        orderBy: { createdAt: "asc" },
        take:    1,
      },
    },
  });

  const owner = updatedWorkspace.users[0]?.user;
  if (!owner) return;

  await sendBatchEmail([
    {
      to:      owner.email!,
      subject: "Your workspace has been upgraded!",
      react:   UpgradeEmail({
        name:  owner.name!,
        plan:  newPlan.name,
        email: owner.email!,
      }),
    },
  ]);
}