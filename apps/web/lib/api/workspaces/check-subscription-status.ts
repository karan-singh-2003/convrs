import { prisma } from "@repo/db";
import { isEntitled } from "@/lib/billing/entitlement";

/**
 * Does this workspace currently have dashboard access?
 *
 * Reads the denormalized billing cache on `Workspace` (written by the webhook
 * fan-out / attach / detach — I-8). `past_due` grace (D6) is added in Deploy 5.
 */
export async function hasWorkspaceAccess(workspaceId: string): Promise<boolean> {
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: {
      subscriptionStatus: true,
      freeTrialEndDate: true,
      paymentFailedAt: true,
    },
  });

  if (!workspace) return false;
  return isEntitled(workspace);
}
