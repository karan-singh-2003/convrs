import { prisma } from "@repo/db";
import { waitUntil } from "@vercel/functions";
import { WorkspaceProps } from "@/lib/types";
import { storage } from "@/lib/storage";
import { APP_DOMAIN_WITH_NGROK, R2_URL } from "@repo/utils";
import { cancelSubscription } from "../../stripe/cancel-subscription";
import { qstash } from "@/lib/cron";

export async function deleteWorkspace(
  workspace: Pick<WorkspaceProps, "id" | "slug" | "logo" | "dodoCustomerId">
) {
  await Promise.all([
    // Remove the users
    prisma.workspaceUsers.deleteMany({
      where: {
        workspaceId: workspace.id,
      },
    }),

    // Remove the default workspace
    prisma.user.updateMany({
      where: {
        defaultWorkspaceId: workspace.id,
      },
      data: {
        defaultWorkspaceId: null,
      },
    }),
  ]);

  waitUntil(
    Promise.allSettled([
      // Remove the API keys
      prisma.restrictedToken.deleteMany({
        where: {
          workspaceId: workspace.id,
        },
      }),

      // Cancel the workspace's subscription if it exists
      workspace.dodoCustomerId && cancelSubscription(workspace.dodoCustomerId),

      // Delete workspace logo if it's a custom logo stored in R2
      workspace.logo &&
        workspace.logo.startsWith(`${R2_URL}/logos/${workspace.id}`) &&
        storage.delete({ key: workspace.logo.replace(`${R2_URL}/`, "") }),

      // Queue the workspace for deletion
      qstash.publishJSON({
        url: `${APP_DOMAIN_WITH_NGROK}/api/cron/workspaces/delete`,
        body: {
          workspaceId: workspace.id,
        },
      }),
    ])
  );
}
