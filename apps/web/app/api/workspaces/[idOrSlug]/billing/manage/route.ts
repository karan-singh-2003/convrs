import { withWorkspace } from "@/lib/auth";
import { NextResponse } from "next/server";
import { createCustomerPortalSession, appUrl } from "@/lib/billing/dodo-checkout";
import { requireBillingOwnerDodoCustomerId, BillingIdentityError } from "@/lib/billing/billing-identity";

// POST /api/workspaces/[idOrSlug]/billing/manage — hosted Dodo customer-portal
// session (billing history, payment methods, cancel). Keyed on the
// SUBSCRIPTION OWNER's Dodo customer (D9) — which spans every subscription
// that owner has, so only the owner may open it (see billing-identity.ts).
export const POST = withWorkspace(
  async ({ workspace, session }) => {
    let dodoCustomerId: string | null;
    try {
      dodoCustomerId = await requireBillingOwnerDodoCustomerId(workspace.id, session.user.id);
    } catch (err) {
      if (err instanceof BillingIdentityError) {
        return NextResponse.json({ error: err.message }, { status: err.status });
      }
      throw err;
    }

    if (!dodoCustomerId) {
      return NextResponse.json(
        { error: "No billing account yet. Subscribe to a plan first." },
        { status: 400 },
      );
    }

    try {
      const { link } = await createCustomerPortalSession(
        dodoCustomerId,
        appUrl(`/${workspace.slug}/billing`),
      );
      return NextResponse.json({ url: link });
    } catch (error) {
      console.error("[billing/manage]", error);
      return NextResponse.json({ error: "Failed to create billing portal session" }, { status: 500 });
    }
  },
  { requiredPermission: "billing:write", skipEntitlementCheck: true },
);
