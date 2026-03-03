import { sendEmail } from "@repo/email";
import WebhookDisabled from "@repo/email/templates/webhook-disabled";
import WebhookFailed from "@repo/email/templates/webhook-failed";
import { prisma } from "@repo/db";
import { Webhook } from "@repo/db/client";
// import { webhookCache } from "./cache";
import {
  WEBHOOK_FAILURE_DISABLE_THRESHOLD,
  WEBHOOK_FAILURE_NOTIFY_THRESHOLDS,
} from "@/lib/webhook/constant";
// import { toggleWebhooksForWorkspace } from "./update-webhook";

export const handleWebhookFailure = async (webhookId: string) => {
  const webhook = await prisma.webhook.update({
    where: {
      id: webhookId,
    },
    data: {
      consecutiveFailures: { increment: 1 },
      lastFailedAt: new Date(),
    },
    select: {
      id: true,
      url: true,
      secret: true,
      triggers: true,
      disabledAt: true,
      consecutiveFailures: true,
      lastFailedAt: true,
      workspaceId: true,
    },
  });

  if (webhook.disabledAt) {
    return;
  }

  if (
    WEBHOOK_FAILURE_NOTIFY_THRESHOLDS.includes(
      webhook.consecutiveFailures as any
    )
  ) {
    await notifyWebhookFailure(webhook);
    return;
  }

  if (webhook.consecutiveFailures >= WEBHOOK_FAILURE_DISABLE_THRESHOLD) {
    // Disable the webhook
    const updatedWebhook = await prisma.webhook.update({
      where: { id: webhookId },
      data: {
        disabledAt: new Date(),
      },
    });

    await Promise.allSettled([
      // Notify the user
      notifyWebhookDisabled(updatedWebhook),

      // Update the webhook cache
      //   webhookCache.set(updatedWebhook),

      // Update the project webhookEnabled flag
      // toggleWebhooksForWorkspace({
      //     workspaceId: webhook.workspaceId,
      // }),
    ]);
  }
};

export const resetWebhookFailureCount = async (webhookId: string) => {
  await prisma.webhook.update({
    where: { id: webhookId },
    data: {
      consecutiveFailures: 0,
      lastFailedAt: null,
    },
  });
};

// Send email to workspace owners when the webhook is failing to deliver
const notifyWebhookFailure = async (
  webhook: Pick<Webhook, "id" | "url" | "workspaceId" | "consecutiveFailures">
) => {
  const workspaceOwners = await prisma.workspaceUsers.findFirst({
    where: { workspaceId: webhook.workspaceId, role: "owner" },
    select: {
      workspace: {
        select: {
          name: true,
          slug: true,
        },
      },
      user: {
        select: {
          email: true,
        },
      },
    },
  });

  if (!workspaceOwners) {
    return;
  }

  const email = workspaceOwners.user.email!;
  const workspace = workspaceOwners.workspace;

  sendEmail({
    subject: "Webhook is failing to deliver",
    to: email,
    react: WebhookFailed({
      email,
      workspace: {
        name: workspace.name,
        slug: workspace.slug,
      },
      webhook: {
        id: webhook.id,
        url: webhook.url,
        consecutiveFailures: webhook.consecutiveFailures,
        disableThreshold: WEBHOOK_FAILURE_DISABLE_THRESHOLD,
      },
    }),
  });
};

// Send email to the workspace owners when the webhook has been disabled
const notifyWebhookDisabled = async (
  webhook: Pick<Webhook, "id" | "url" | "workspaceId" | "disabledAt">
) => {
  const workspaceOwners = await prisma.workspaceUsers.findFirst({
    where: { workspaceId: webhook.workspaceId, role: "owner" },
    select: {
      workspace: {
        select: {
          name: true,
          slug: true,
        },
      },
      user: {
        select: {
          email: true,
        },
      },
    },
  });

  if (!workspaceOwners) {
    return;
  }

  const email = workspaceOwners.user.email!;
  const workspace = workspaceOwners.workspace;

  sendEmail({
    subject: "Webhook has been disabled",
    to: email,
    react: WebhookDisabled({
      email,
      workspace: {
        name: workspace.name,
        slug: workspace.slug,
      },
      webhook: {
        id: webhook.id,
        url: webhook.url,
        disableThreshold: WEBHOOK_FAILURE_DISABLE_THRESHOLD,
      },
    }),
  });
};
