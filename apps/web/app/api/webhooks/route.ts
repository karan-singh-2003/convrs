import { withWorkspace } from "@/lib/auth";
import { createWebhookSchema } from "@/lib/zod/schemas/webhook";
import { prisma } from "@repo/db";
import { NextResponse } from "next/server";
import { WebhookReceiver } from "@prisma/client";
import { waitUntil } from "@vercel/functions";
import { sendEmail } from "@repo/email";
import WebhookAddedEmail from "@repo/email/templates/webhook-added";

// /api/webhooks/route.ts
export const GET = withWorkspace(
  async ({ workspace }) => {
    console.log("Fetching webhooks for workspace", workspace.id);
    const webhooks = await prisma.webhook.findMany({
      where: {
        workspaceId: workspace.id,
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
      orderBy: {
        createdAt: "desc",
      },
    });
    return NextResponse.json(webhooks);
  },
  {
    requiredPermission: "webhooks.read",
  }
);

// /api/webhooks/route.ts - POST handler to create a new webhook
export const POST = withWorkspace(
  async ({ workspace, session, req }) => {
    const { name, url, secret, triggers } = createWebhookSchema.parse(
      await req.json()
    );

    // Validate the webhook
    const webHookUrlExists = await prisma.webhook.findFirst({
      where: {
        url,
        workspaceId: workspace.id,
      },
    });

    if (webHookUrlExists) {
      return NextResponse.json(
        { error: "A webhook with this URL already exists" },
        { status: 400 }
      );
    }

    const response = await prisma.$transaction(async (tx) => {
      const webhook = await prisma.webhook.create({
        data: {
          name,
          url,
          secret,
          triggers,
          receiver: WebhookReceiver.user,
          workspaceId: workspace.id,
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

      await prisma.workspace.update({
        where: {
          id: workspace.id,
        },
        data: {
          webhookEnabled: true,
        },
      });

      return webhook;
    });

    waitUntil(
      sendEmail({
        to: session.user.email,
        subject: "New Webhook Created",
        react: WebhookAddedEmail({
          email: session.user.email,
          workspace: {
            name: workspace.name,
            slug: workspace.slug,
          },
          webhook: {
            name,
          },
        }),
      })
    );
    return NextResponse.json(response);
  },
  {
    requiredPermission: "webhooks.write",
  }
);
