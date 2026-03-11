"use server";
import { authActionClient, authUserActionClient } from "./safe-action";
import { WEBHOOK_TRIGGERS } from "../webhook/constant";
import * as z from "zod";
import { prisma } from "@repo/db";
import { sendWebhooks } from "@/ui/webhook/send-webhook";
import { samplePayLoad } from "@/ui/webhook/sample-events/payload";
const schema = z.object({
  webhookId: z.string(),
  triggers: z.array(z.enum(WEBHOOK_TRIGGERS)),
  workspaceId: z.string(),
});

export const sendTestWebhook = authActionClient
  .inputSchema(schema)
  .action(async ({ ctx, parsedInput }) => {
    const { webhookId, triggers } = parsedInput;
    const {workspace} = ctx;

    const webhook = await prisma.webhook.findFirst({
      where: {
        id: webhookId,
        workspaceId: workspace.id,
      },
      select: {
        id: true,
        url: true,
        secret: true,
      },
    });

    if (!webhook) {
      throw new Error("Webhook not found");
    }

    await Promise.all(
      triggers.map((trigger) =>
        sendWebhooks({
          webhooks: [webhook],
          trigger,
          data: samplePayLoad[trigger],
        })
      )
    );

    return {
      ok: true,
      message: `Test webhook${triggers.length > 1 ? "s" : ""} sent successfully`,
    };
  });
