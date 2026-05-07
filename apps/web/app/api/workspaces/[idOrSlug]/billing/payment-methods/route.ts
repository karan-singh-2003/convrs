import { withWorkspace } from "@/lib/auth";
import { stripe } from "@/lib/stripe";
import { NextResponse } from "next/server";
import * as z from "zod/v4";


const addPaymentMethodSchema = z.object({
  cardNumber: z.string().min(13).max(19),
  expMonth: z.number().min(1).max(12),
  expYear: z.number().min(2024),
  cvc: z.string().min(3).max(4),
  fullName: z.string().min(1),
  email: z.string().email().optional(),
  address: z
    .object({
      line1: z.string().optional(),
      line2: z.string().optional(),
      city: z.string().optional(),
      state: z.string().optional(),
      postal_code: z.string().optional(),
      country: z.string().optional(),
    })
    .optional(),
});

// POST /api/workspaces/[idOrSlug]/billing/payment-methods – add a payment method
export const POST = withWorkspace(
  async ({ req, workspace }) => {
    if (!workspace.dodoCustomerId) {
      return NextResponse.json(
        {
          error: "No Dodo customer found. Please subscribe to a plan first.",
        },
        { status: 400 }
      );
    }

    const body = addPaymentMethodSchema.parse(await req.json());

    try {
      // Create a payment method via Stripe
      const paymentMethod = await stripe.paymentMethods.create({
        type: "card",
        card: {
          number: body.cardNumber,
          exp_month: body.expMonth,
          exp_year: body.expYear,
          cvc: body.cvc,
        },
        billing_details: {
          name: body.fullName,
          email: body.email,
          address: body.address,
        },
      });

      // Attach to customer
      await stripe.paymentMethods.attach(paymentMethod.id, {
        customer: workspace.dodoCustomerId,
      });

      // Set as default payment method
      await stripe.customers.update(workspace.dodoCustomerId, {
        invoice_settings: {
          default_payment_method: paymentMethod.id,
        },
      });

      return NextResponse.json({
        id: paymentMethod.id,
        brand: paymentMethod.card?.brand ?? "unknown",
        last4: paymentMethod.card?.last4 ?? "????",
        expMonth: paymentMethod.card?.exp_month ?? 0,
        expYear: paymentMethod.card?.exp_year ?? 0,
        name: body.fullName,
        isDefault: true,
      });
    } catch (err: any) {
      console.error("Error creating payment method:", err);
      return NextResponse.json(
        { error: err?.message ?? "Failed to add payment method" },
        { status: 400 }
      );
    }
  },
  {
    requiredPermission: "billing:write",
  }
);

// DELETE /api/workspaces/[idOrSlug]/billing/payment-methods – remove a payment method
export const DELETE = withWorkspace(
  async ({ req, workspace }) => {
    if (!workspace.dodoCustomerId) {
      return NextResponse.json(
        { error: "No Dodo customer found" },
        { status: 400 }
      );
    }

    const { paymentMethodId } = await req.json();

    try {
      await stripe.paymentMethods.detach(paymentMethodId);
      return NextResponse.json({ success: true });
    } catch (err: any) {
      console.error("Error removing payment method:", err);
      return NextResponse.json(
        { error: err?.message ?? "Failed to remove payment method" },
        { status: 400 }
      );
    }
  },
  {
    requiredPermission: "billing:write",
  }
);
