import { verifyQstashSignature } from "@/lib/cron/verify-qstash";
import { WEBHOOK_TRIGGERS } from "@/lib/webhook/constant";
import {
  handleWebhookFailure,
  resetWebhookFailureCount,
} from "@/ui/webhook/failure";
import { webhookCallbackSchema } from "@/lib/zod/schemas/webhook";
import { prisma } from "@repo/db";
import { getSearchParams } from "@repo/utils";
import * as z from "zod/v4";

const searchParamsSchema = z.object({
  webhookId: z.string(),
  eventId: z.string(),
  event: z.enum(WEBHOOK_TRIGGERS),
  failed: z.literal("true").optional(),
});

// POST /api/webhooks/callback – listen to webhooks status from QStash
export const POST = async (req: Request) => {
  const rawBody = await req.text();
  await verifyQstashSignature({ req, rawBody });

  const { url, status, body, sourceBody, sourceMessageId } =
    webhookCallbackSchema.parse(JSON.parse(rawBody));

  const {
    webhookId,
    eventId,
    event,
    failed: deliveryFailed, // failed after all the retries
  } = searchParamsSchema.parse(getSearchParams(req.url));

  const webhook = await prisma.webhook.findUnique({
    where: {
      id: webhookId,
    },
  });

  if (!webhook) {
  
    return new Response("Webhook not found");
  }

  const isFailed = status >= 400 || status === -1;

  const request = Buffer.from(sourceBody, "base64").toString("utf-8");
  const response = Buffer.from(body, "base64").toString("utf-8");

  // Log webhook callback details in development
  if (process.env.NODE_ENV === "development") {
    console.log("Received webhook callback:");
  }

  await Promise.allSettled([
    // Store the webhook event in the database
    prisma.webhookEvent.create({
      data: {
        eventId,
        webhookId,
        messageId: sourceMessageId,
        event,
        url,
        httpStatus: status === -1 ? 503 : status,
        requestBody: request,
        responseBody: response,
        timestamp: new Date(),
      },
    }),

    // Handle the webhook delivery failure if it's the last retry
    ...(isFailed ? [handleWebhookFailure(webhookId)] : []),

    // Only reset if there were previous failures
    ...(webhook.consecutiveFailures > 0 && !isFailed
      ? [resetWebhookFailureCount(webhookId)]
      : []),
  ]);

  return new Response(`Webhook ${webhookId} processed`);
};
