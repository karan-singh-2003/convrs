import { withWorkspace } from "@/lib/auth";
import { dodo } from "@/lib/dodo";
import { NextResponse } from "next/server";
import { createCustomerPortalSession, appUrl } from "@/lib/billing/dodo-checkout";
import { requireBillingOwnerDodoCustomerId, BillingIdentityError } from "@/lib/billing/billing-identity";

// GET — the subscription owner's saved payment methods on Dodo (D9).
export const GET = withWorkspace(
  async ({ workspace, session }) => {
    let cid: string | null;
    try {
      cid = await requireBillingOwnerDodoCustomerId(workspace.id, session.user.id);
    } catch (err) {
      if (err instanceof BillingIdentityError) {
        return NextResponse.json({ error: err.message }, { status: err.status });
      }
      throw err;
    }
    if (!cid) return NextResponse.json([]);
    try {
      const res = (await dodo.customers.retrievePaymentMethods(cid)) as {
        items: Array<{
          payment_method_id: string;
          payment_method_type?: string | null;
          recurring_enabled?: boolean;
          card?: {
            card_holder_name?: string;
            card_network?: string;
            last4_digits?: string;
            expiry_month?: string;
            expiry_year?: string;
          };
        }>;
      };
      return NextResponse.json(
        (res.items ?? []).map((m) => ({
          id: m.payment_method_id,
          brand: m.card?.card_network ?? m.payment_method_type ?? "card",
          last4: m.card?.last4_digits ?? "????",
          expMonth: Number(m.card?.expiry_month ?? 0),
          expYear: Number(m.card?.expiry_year ?? 0),
          name: m.card?.card_holder_name ?? "",
          recurring: Boolean(m.recurring_enabled),
        })),
      );
    } catch (err) {
      console.error("[billing/payment-methods GET]", err);
      return NextResponse.json({ error: "Failed to fetch payment methods" }, { status: 500 });
    }
  },
  { requiredPermission: "billing:read" },
);

// POST — Dodo has no raw-card API (PCI); direct the user to the hosted portal.
export const POST = withWorkspace(
  async ({ workspace, session }) => {
    let cid: string | null;
    try {
      cid = await requireBillingOwnerDodoCustomerId(workspace.id, session.user.id);
    } catch (err) {
      if (err instanceof BillingIdentityError) {
        return NextResponse.json({ error: err.message }, { status: err.status });
      }
      throw err;
    }
    if (!cid) {
      return NextResponse.json({ error: "No billing account yet. Subscribe to a plan first." }, { status: 400 });
    }
    try {
      const { link } = await createCustomerPortalSession(cid, appUrl(`/${workspace.slug}/billing`));
      return NextResponse.json({ portalUrl: link, message: "Add or update payment methods in the billing portal." });
    } catch (err) {
      console.error("[billing/payment-methods POST]", err);
      return NextResponse.json({ error: "Failed to open the billing portal" }, { status: 500 });
    }
  },
  { requiredPermission: "billing:write" },
);

// DELETE — same: payment-method removal happens in the hosted portal.
export const DELETE = withWorkspace(
  async ({ workspace, session }) => {
    let cid: string | null;
    try {
      cid = await requireBillingOwnerDodoCustomerId(workspace.id, session.user.id);
    } catch (err) {
      if (err instanceof BillingIdentityError) {
        return NextResponse.json({ error: err.message }, { status: err.status });
      }
      throw err;
    }
    if (!cid) return NextResponse.json({ error: "No billing account found" }, { status: 400 });
    const { link } = await createCustomerPortalSession(cid, appUrl(`/${workspace.slug}/billing`));
    return NextResponse.json({ portalUrl: link, message: "Remove payment methods in the billing portal." });
  },
  { requiredPermission: "billing:write" },
);
