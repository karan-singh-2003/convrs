import { stripe } from "@/lib/stripe";
import Stripe from "stripe";
import { checkoutSessionCompleted } from "./checkout-session-completed";
import { customerSubscriptionDeleted } from "./customer-subscription-deleted";
import { customerSubscriptionUpdated } from "./customer-subscription-updated";
import { NextResponse } from "next/server";

const relevantEvents = new Set([
  "checkout.session.completed",
  "customer.subscription.deleted",
  "customer.subscription.updated",
  "customer.subscription.created",
  "invoice.payment_failed",
]);
export const POST = async (req: Request) => {
  const buf = await req.text();
  const signature = req.headers.get("stripe-signature") as string;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET as string;
  let event: Stripe.Event;
  try {
    if (!signature || !webhookSecret) {
      console.log("Missing Stripe signature or webhook secret");
      return new Response(
        "Webhook Error: Missing signature or webhook secret",
        { status: 400 }
      );
    }
    event = stripe.webhooks.constructEvent(buf, signature, webhookSecret);
  } catch (err) {
    console.log("Error verifying Stripe webhook signature:", err);
    return new Response("Webhook Error: Invalid signature", { status: 400 });
  }

  if (!relevantEvents.has(event.type)) {
    console.log(`Received irrelevant Stripe event: ${event.type}`);
    return new Response("Event received", { status: 200 });
  }

  try {
    switch (event.type) {
      case "customer.subscription.deleted":
        return await customerSubscriptionDeleted(event);
      case "customer.subscription.updated":
        return await customerSubscriptionUpdated(event);
      case "checkout.session.completed":
        return await checkoutSessionCompleted(event);
    }
  } catch (err) {
    console.log("Error processing Stripe webhook event:", err);
    return new Response("Error processing event", { status: 500 });
  }

  return NextResponse.json({ received: true });
};
