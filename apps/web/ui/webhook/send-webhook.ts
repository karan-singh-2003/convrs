import { Webhook } from "@repo/db/client";
import { WebhookTrigger } from "@/lib/types";
import { webhookPayloadSchema } from "./schemas";
import { APP_DOMAIN_WITH_NGROK, nanoid } from "@repo/utils";
import { createWebhookSignature } from "./signature";
import { qstash } from "@/lib/cron";

export const sendWebhooks = async ({
  webhooks,
  trigger,
  data,
}: {
  webhooks: Pick<Webhook, "id" | "url" | "secret">[];
  trigger: WebhookTrigger;
  data: any;
}) => {
  if (webhooks.length === 0) return;

  const payload = prepareWebhookPayload(trigger, data);

  return await Promise.all(
    webhooks.map((webhook) => publishWebhookEventToQstash({ webhook, payload }))
  );
};

export const publishWebhookEventToQstash = async ({
  webhook,
  payload,
}: {
  webhook: Pick<Webhook, "id" | "url" | "secret">;
  payload: any;
}) => {
  const searchParams = {
    webhookId: webhook.id,
    eventId: payload.id,
    eventL: payload.event,
  };

  const callbackUrl = buildCallbackUrl(
    `${APP_DOMAIN_WITH_NGROK}/api/webhooks/callback`,
    searchParams
  );
  const failureCallbackUrl = buildCallbackUrl(
    `${APP_DOMAIN_WITH_NGROK}/api/webhooks/callback`,
    { ...searchParams, failed: "true" }
  );

  const finalPayload = payload;

  const signature = await createWebhookSignature(webhook.secret, finalPayload);

  const response = await qstash.publishJSON({
    url: webhook.url,
    body: finalPayload,
    headers: {
      "Dub-Signature": signature,
      "Upstash-Hide-Headers": "true",
    },
    callback: callbackUrl.href,
    failureCallback: failureCallbackUrl.href,
    ...(process.env.NODE_ENV === "test" && { delay: 5 }),
  });

  if (!response.messageId) {
    console.error("Failed to publish webhook event to QStash", response);
  }

  if (process.env.NODE_ENV === "development") {
    console.debug("Published webhook event to QStash", {
      ...response,
      payload: finalPayload,
    });
  }

  return {
    ...response,
    webhookEventId: payload.id,
  };
};

export const webhookEventIdPrefix = "evt_";
export const prepareWebhookPayload = (trigger: WebhookTrigger, data: any) => {
  return webhookPayloadSchema.parse({
    id: `${webhookEventIdPrefix}/${nanoid(25)}`,
    event: trigger,
    data,
    createdAt: new Date().toISOString(),
  });
};

function buildCallbackUrl(
  baseURL: string,
  searchParams: Record<string, string>
) {
  const url = new URL(baseURL);
  Object.entries(searchParams).forEach(([key, value]) => {
    url.searchParams.append(key, value);
  });
  return url;
}
