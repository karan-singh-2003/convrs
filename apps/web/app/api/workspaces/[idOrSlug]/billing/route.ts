import { withWorkspace } from "@/lib/auth";
import { stripe } from "@/lib/stripe";
import { getPlanDetails } from "@repo/utils";
import { NextResponse } from "next/server";
import * as z from "zod/v4";

const updateBillingSchema = z.object({
  email: z.string().email().optional(),
  company: z.string().optional(),
  address1: z.string().optional(),
  address2: z.string().optional(),
  country: z.string().optional(),
  city: z.string().optional(),
  postalCode: z.string().optional(),
  state: z.string().optional(),
  gst: z.string().optional(),
});

// GET /api/workspaces/[idOrSlug]/billing – get billing info for a workspace
export const GET = withWorkspace(
  async ({ workspace }) => {
    const plan = workspace.plan ?? "free";
    const { plan: planDetails } = getPlanDetails({ plan });

    // Calculate billing cycle dates
    const now = new Date();
    const cycleDay = workspace.billingCycleStart;
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    let cycleStart: Date;
    let cycleEnd: Date;

    if (now.getDate() >= cycleDay) {
      cycleStart = new Date(currentYear, currentMonth, cycleDay);
      cycleEnd = new Date(currentYear, currentMonth + 1, cycleDay - 1);
    } else {
      cycleStart = new Date(currentYear, currentMonth - 1, cycleDay);
      cycleEnd = new Date(currentYear, currentMonth, cycleDay - 1);
    }

    // Fetch invoices from Stripe
    let invoices: {
      id: string;
      number: string | null;
      amountDue: number;
      amountPaid: number;
      status: string | null;
      created: number;
      hostedInvoiceUrl: string | null;
      invoicePdf: string | null;
    }[] = [];

    let subscription: {
      id: string;
      status: string;
      currentPeriodStart: number;
      currentPeriodEnd: number;
      cancelAtPeriodEnd: boolean;
      interval: string;
    } | null = null;

    let customer: {
      email: string | null;
      name: string | null;
      address: {
        line1: string | null;
        line2: string | null;
        city: string | null;
        state: string | null;
        postal_code: string | null;
        country: string | null;
      } | null;
    } | null = null;

    let paymentMethods: {
      id: string;
      brand: string;
      last4: string;
      expMonth: number;
      expYear: number;
      name: string | null;
      isDefault: boolean;
    }[] = [];

    if (workspace.stripeId) {
      try {
        // Fetch customer details
        const stripeCustomer = await stripe.customers.retrieve(
          workspace.stripeId
        );
        if (!("deleted" in stripeCustomer && stripeCustomer.deleted)) {
          customer = {
            email: stripeCustomer.email,
            name: stripeCustomer.name ?? null,
            address: stripeCustomer.address
              ? {
                  line1: stripeCustomer.address.line1,
                  line2: stripeCustomer.address.line2,
                  city: stripeCustomer.address.city,
                  state: stripeCustomer.address.state,
                  postal_code: stripeCustomer.address.postal_code,
                  country: stripeCustomer.address.country,
                }
              : null,
          };

          // Fetch payment methods
          const pms = await stripe.paymentMethods.list({
            customer: workspace.stripeId,
            type: "card",
          });

          const defaultPmId =
            stripeCustomer.invoice_settings?.default_payment_method;

          paymentMethods = pms.data.map((pm) => ({
            id: pm.id,
            brand: pm.card?.brand ?? "unknown",
            last4: pm.card?.last4 ?? "????",
            expMonth: pm.card?.exp_month ?? 0,
            expYear: pm.card?.exp_year ?? 0,
            name: pm.billing_details?.name ?? null,
            isDefault: pm.id === defaultPmId,
          }));
        }

        // Fetch invoices
        const stripeInvoices = await stripe.invoices.list({
          customer: workspace.stripeId,
          limit: 20,
        });

        invoices = stripeInvoices.data.map((inv) => ({
          id: inv.id,
          number: inv.number,
          amountDue: inv.amount_due,
          amountPaid: inv.amount_paid,
          status: inv.status as string | null,
          created: inv.created,
          hostedInvoiceUrl: inv.hosted_invoice_url ?? null,
          invoicePdf: inv.invoice_pdf ?? null,
        }));

        // Fetch active subscription
        const subs = await stripe.subscriptions.list({
          customer: workspace.stripeId,
          status: "active",
          limit: 1,
        });

        if (subs.data.length > 0) {
          const sub = subs.data[0];
          const firstItem = sub.items.data[0];
          const periodStart =
            (sub as any).current_period_start ?? Math.floor(Date.now() / 1000);
          const periodEnd =
            (sub as any).current_period_end ?? Math.floor(Date.now() / 1000);
          subscription = {
            id: sub.id,
            status: sub.status,
            currentPeriodStart: periodStart,
            currentPeriodEnd: periodEnd,
            cancelAtPeriodEnd: sub.cancel_at_period_end,
            interval: firstItem?.price?.recurring?.interval ?? "month",
          };
        }
      } catch (err) {
        console.error("Error fetching Stripe billing data:", err);
      }
    }

    return NextResponse.json({
      plan,
      planName: planDetails?.name ?? "Free",
      price: planDetails?.price?.monthly ?? 0,
      yearlyPrice: planDetails?.price?.yearly ?? 0,
      billingCycleStart: cycleStart.toISOString(),
      billingCycleEnd: cycleEnd.toISOString(),
      subscription,
      invoices,
      paymentFailedAt: workspace.paymentFailedAt,
      customer,
      paymentMethods,
    });
  },
  {
    requiredPermission: "billing:read",
  }
);

// PATCH /api/workspaces/[idOrSlug]/billing – update customer billing details
export const PATCH = withWorkspace(
  async ({ req, workspace }) => {
    if (!workspace.stripeId) {
      return NextResponse.json(
        { error: "No Stripe customer found for this workspace" },
        { status: 400 }
      );
    }

    const body = updateBillingSchema.parse(await req.json());

    await stripe.customers.update(workspace.stripeId, {
      ...(body.email && { email: body.email }),
      ...(body.company && { name: body.company }),
      address: {
        line1: body.address1 ?? "",
        line2: body.address2 ?? "",
        city: body.city ?? "",
        state: body.state ?? "",
        postal_code: body.postalCode ?? "",
        country: body.country ?? "",
      },
    });

    return NextResponse.json({ success: true });
  },
  {
    requiredPermission: "billing:write",
  }
);
