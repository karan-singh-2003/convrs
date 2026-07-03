// apps/ingestion/src/controllers/lemonsqueezy/webhook.ts
import { Request, Response } from "express";
import crypto from "crypto";
import { prisma } from "@repo/db";
import { handlePaymentEvent } from "../shared/handle-payment.js";

export const lemonsqueezyWebhookController = async (req: Request, res: Response) => {
  const workspaceId = req.params.workspaceId as string;
  if (!workspaceId) return res.status(400).json({ error: "Missing workspaceId" });

  const sig = req.headers["x-signature"] as string | undefined;
  if (!sig) return res.status(400).json({ error: "Missing X-Signature" });

  const integration = await prisma.integration.findUnique({
    where: { workspaceId_provider: { workspaceId, provider: "lemonsqueezy" } },
  });
  if (!integration?.webhookSecret) return res.status(404).json({ error: "Integration not found" });

  const rawBody: Buffer = req.body;
  const expected = crypto.createHmac("sha256", integration.webhookSecret).update(rawBody).digest("hex");

  const a = Buffer.from(sig, "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    console.error("[lemonsqueezy/webhook] signature verification failed");
    return res.status(400).json({ error: "Invalid signature" });
  }

  const payload = JSON.parse(rawBody.toString());
  const eventName = payload.meta?.event_name;

  try {
    if (eventName === "order_created") {
      const order = payload.data.attributes;
      const customData = payload.meta?.custom_data ?? {};
      await handlePaymentEvent({
        workspaceId,
        provider: "lemonsqueezy",
        externalSessionId: payload.data.id,
        externalEventId: `${payload.data.id}:${eventName}`,
        externalPaymentId: payload.data.id,
        amount: order.total ?? 0, // already in cents
        currency: (order.currency ?? "usd").toLowerCase(),
        customerEmail: order.user_email ?? null,
        visitorId: customData.convrs_visitor_id ?? null,
        sessionId: customData.convrs_session_id ?? null,
      });
    } else {
      console.log("[lemonsqueezy/webhook] Unhandled event:", eventName);
    }
  } catch (err) {
    console.error("[lemonsqueezy/webhook] processing error:", err);
  }

  return res.status(200).json({ received: true });
};