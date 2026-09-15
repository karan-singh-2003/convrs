import { prisma } from "@repo/db";
import { waitUntil } from "@vercel/functions";
import { WorkspaceProps } from "@/lib/types";
import { storage } from "@/lib/storage";
import { APP_DOMAIN_WITH_NGROK, R2_URL } from "@repo/utils";
import { qstash } from "@/lib/cron";
import { releaseSubscriptionSeat } from "@/lib/billing/subscription-service";

export async function deleteWorkspace(
  workspace: Pick<WorkspaceProps, "id" | "slug" | "logo"> & { subscriptionId?: string | null },
) {
  // Detach from its subscription first, then free the seat (D5: an empty
  // Standard subscription auto-schedules cancellation). The Dodo customer is
  // NOT cancelled here — it belongs to the User and may back other workspaces.
  const ws = await prisma.workspace.findUnique({
    where: { id: workspace.id },
    select: { subscriptionId: true },
  });
  if (ws?.subscriptionId) {
    const subscriptionId = ws.subscriptionId;
    await prisma.workspace.update({ where: { id: workspace.id }, data: { subscriptionId: null } });
    await releaseSubscriptionSeat(subscriptionId).catch((e) =>
      console.error("[deleteWorkspace] releaseSubscriptionSeat failed", subscriptionId, e),
    );
  }

  await Promise.all([
    prisma.workspaceUsers.deleteMany({ where: { workspaceId: workspace.id } }),
    prisma.user.updateMany({
      where: { defaultWorkspaceId: workspace.id },
      data: { defaultWorkspaceId: null },
    }),
  ]);

  waitUntil(
    Promise.allSettled([
      prisma.restrictedToken.deleteMany({ where: { workspaceId: workspace.id } }),

      workspace.logo &&
        workspace.logo.startsWith(`${R2_URL}/logos/${workspace.id}`) &&
        storage.delete({ key: workspace.logo.replace(`${R2_URL}/`, "") }),

      qstash.publishJSON({
        url: `${APP_DOMAIN_WITH_NGROK}/api/cron/workspaces/delete`,
        body: { workspaceId: workspace.id },
      }),
    ]),
  );
}
