import { withWorkspace } from "@/lib/auth";
import { stripe } from "@/lib/stripe";
import { prisma } from "@repo/db";
import { NextResponse } from "next/server";

// POST /api/workspaces/[idOrSlug]/billing/select-free
// Selects the free plan for a workspace during onboarding,
// creates a Stripe customer and a $0 invoice.
export const POST = withWorkspace(
  async ({ workspace, session }) => {
    // Create or reuse Stripe customer
    let stripeCustomerId = workspace.stripeId;

    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        email: session.user.email,
        metadata: {
          workspaceId: workspace.id,
          dubCustomerId: session.user.id,
        },
      });
      stripeCustomerId = customer.id;
    }

    // Create a $0 invoice for the free plan
    await stripe.invoiceItems.create({
      customer: stripeCustomerId,
      amount: 0,
      currency: "usd",
      description: "Free Plan – $0/mo",
    });

    const invoice = await stripe.invoices.create({
      customer: stripeCustomerId,
      auto_advance: true,
      collection_method: "charge_automatically",
      metadata: {
        workspaceId: workspace.id,
        plan: "free",
      },
    });

    // Finalize and pay the $0 invoice
    await stripe.invoices.finalizeInvoice(invoice.id);

    // Update workspace
    await prisma.workspace.update({
      where: { id: workspace.id },
      data: {
        stripeId: stripeCustomerId,
        plan: "free",
        billingCycleStart: new Date().getDate(),
        userLimit: 1,
      },
    });

    return NextResponse.json({
      success: true,
      plan: "free",
      invoiceId: invoice.id,
    });
  },
  {
    requiredPermission:"billing:read",
  }
);
