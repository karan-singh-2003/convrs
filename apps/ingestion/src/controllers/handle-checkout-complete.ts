// // ------------------------------------------------------------------
// // checkout.session.completed
// // One-time payments and new subscriptions

// import { Stripe } from "stripe";
// import { randomUUID } from "crypto";
// import { recordEvent } from "@repo/analytics";
// import { prisma } from "@repo/db";
// // ------------------------------------------------------------------
// export async function handleCheckoutCompleted(
//   session: Stripe.Checkout.Session,
//   workspaceId: string,
//   stripeEventId: string
// ) {
//   const amount = session.amount_total ?? 0;
//   const currency = session.currency ?? "inr";
//   const visitorId = session.metadata?.datafast_visitor_id;
//   const sessionId = session.metadata?.datafast_session_id;

//   if (!visitorId) {
//     console.warn("[stripe/webhook] No visitor_id in metadata — skipping");
//     return;
//   }

//   // find userid
//   const workspaceOwner = await prisma.workspaceUsers.findFirst({
//     where: { workspaceId: workspaceId, role: "owner" },
//     select: { user: { select: { id: true } } },
//   });

//   await recordEvent({
//     req: new Request("http://internal/stripe-webhook"),
//     payload: {
//       workspace_id: workspaceId,
//       website_id: workspaceId,
//       visitor_id: visitorId,
//       session_id: sessionId!,
//       user_id: workspaceOwner?.user.id || "",
//       type: "payment",
//       url: "",
//       event_name: "checkout_completed",
//       revenue: {
//         amount: amount / 100,
//         currency: currency.toUpperCase(),
//         provider: "stripe",
//       },
//       props: {
//         stripe_event_id: stripeEventId,
//         stripe_session_id: session.id,
//         payment_intent_id: session.payment_intent,
//         customer_email: session.customer_details?.email ?? null,
//       },
//     },
//     logger: console as any,
//   });
// }
// apps/ingestion/src/controllers/stripe/handle-checkout-complete.ts


import { Stripe } from "stripe";
import { prisma } from "@repo/db";
import { processPayment } from "@repo/analytics";

export async function handleCheckoutCompleted(
  session: Stripe.Checkout.Session,
  workspaceId: string,
  stripeEventId: string
) {
  const amount = session.amount_total ?? 0;
  const currency = session.currency ?? "usd";
  const visitorId = session.metadata?.convrs_visitor_id;
  const sessionId = session.metadata?.convrs_session_id;
  const customerEmail = session.customer_details?.email ?? null;

  if (!visitorId) {
    console.warn(
      `[stripe/webhook] No visitor_id in metadata for session ${session.id} — storing payment without attribution`
    );
    // We still store the payment — no data loss.
    // visitorId will just be undefined → attribution will fail → revenue = 0 in Tinybird.
  }

  // Resolve the workspace's projectToken (websiteId) for Tinybird
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { projectToken: true },
  });

  if (!workspace?.projectToken) {
    console.error(`[stripe/webhook] No projectToken for workspace ${workspaceId}`);
    return;
  }

  const workspaceOwner = await prisma.workspaceUsers.findFirst({
    where: { workspaceId, role: "owner" },
    select: { user: { select: { id: true } } },
  });

  await processPayment({
    workspaceId,
    userId: workspaceOwner?.user?.id ?? "",
    websiteId: workspace.projectToken,
    stripeSessionId: session.id,
    stripeEventId,
    stripePaymentIntent:
      typeof session.payment_intent === "string"
        ? session.payment_intent
        : null,
    amount,
    currency,
    customerEmail,
    visitorId,
    sessionId,
  });
}