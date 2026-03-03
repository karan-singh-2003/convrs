import { withWorkspace } from "@/lib/auth";
import { updateWebhookSchema } from "@/lib/zod/schemas/webhook";
import { prisma } from "@repo/db";
import { NextResponse } from "next/server";

export const GET = withWorkspace(
  async ({ workspace, params }) => {
    const { webhookId } = params;

    const webhook = await prisma.webhook.findUniqueOrThrow({
      where: {
        id: webhookId,
        workspaceId: workspace.id,
      },
      select: {
        id: true,
        name: true,
        url: true,
        secret: true,
        triggers: true,
        disabledAt: true,
      },
    });

    return NextResponse.json(webhook);
  },
  {
    requiredPermission: "webhooks.read",
  }
);

export const PATCH = withWorkspace(
  async ({ workspace, params, req, session }) => {
    const { webhookId } = params;
    const { name, url, secret, triggers } = updateWebhookSchema.parse(
      await req.json()
    );

    const existingWebhook = await prisma.webhook.findUniqueOrThrow({
      where: {
        id: webhookId,
        workspaceId: workspace.id,
      },
    });

    // Check if URL is being changed and if it already exists
    if (url && url !== existingWebhook.url) {
      const webhookUrlExists = await prisma.webhook.findFirst({
        where: {
          workspaceId: workspace.id,
          url,
          id: {
            not: webhookId,
          },
        },
      });

      if (webhookUrlExists) {
        return NextResponse.json(
          { error: "A webhook with this URL already exists" },
          { status: 400 }
        );
      }
    }

    const webhook = await prisma.webhook.update({
      where: {
        id: webhookId,
        workspaceId: workspace.id,
      },
      data: {
        name,
        url,
        secret,
        triggers,
        disabledAt: null,
      },
      select: {
        id: true,
        name: true,
        url: true,
        secret: true,
        triggers: true,
        disabledAt: true,
        links: true,
        receiver: true,
      },
    });

    return NextResponse.json(webhook);
  },
  {
    requiredPermission: "webhooks.write",
  }
);

// DELETE /api/webhooks/[webhookId] - delete a specific webhook
export const DELETE = withWorkspace(
  async ({ workspace, params }) => {
    const { webhookId } = params;

    await prisma.webhook.findUniqueOrThrow({
      where: {
        id: webhookId,
        workspaceId: workspace.id,
      },
    });

    await prisma.webhook.delete({
      where: {
        id: webhookId,
        workspaceId: workspace.id,
      },
    });

    return NextResponse.json({
      id: webhookId,
    });
  },
  {
    requiredPermission: "webhooks.write",
  }
);
