import { stripe } from "@/lib/stripe";
import Stripe from "stripe";
import { checkoutSessionCompleted } from "../checkout-session-completed";
import { customerSubscriptionDeleted } from "../customer-subscription-deleted";
import { customerSubscriptionUpdated } from "../customer-subscription-updated";
import { NextResponse } from "next/server";
import { prisma } from "@repo/db";

const relevantEvents = new Set([
  "checkout.session.completed",
  "customer.subscription.deleted",
  "customer.subscription.updated",
  "customer.subscription.created",
  "invoice.payment_failed",
]);

export const POST = async (
  req: Request,
  { params }: { params: Promise<{ workspaceId: string }> }
) => {
  const { workspaceId } = await params;

  const integration = await prisma.stripeIntegration.findUnique({
    where: { workspaceId },
    select: { webhookSecret: true },
  });

  if (!integration?.webhookSecret) {
    return new Response("Webhook Error: Integration not found", {
      status: 404,
    });
  }

  const buf = await req.text();
  const signature = req.headers.get("stripe-signature") as string;
  let event: Stripe.Event;

  try {
    if (!signature) {
      return new Response("Webhook Error: Missing signature", { status: 400 });
    }

    event = stripe.webhooks.constructEvent(
      buf,
      signature,
      integration.webhookSecret
    );
  } catch {
    return new Response("Webhook Error: Invalid signature", { status: 400 });
  }

  if (!relevantEvents.has(event.type)) {
    return new Response("Event received", { status: 200 });
  }

  try {
    switch (event.type) {
      case "customer.subscription.deleted":
        return await customerSubscriptionDeleted(event);
      case "customer.subscription.created":
      case "customer.subscription.updated":
        return await customerSubscriptionUpdated(event);
      case "checkout.session.completed":
        return await checkoutSessionCompleted(event);
    }
  } catch {
    return new Response("Error processing event", { status: 500 });
  }

  return NextResponse.json({ received: true });
};
