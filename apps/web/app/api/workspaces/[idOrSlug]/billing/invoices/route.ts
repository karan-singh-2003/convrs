import { NextResponse } from "next/server";
import { withWorkspace } from "@/lib/auth";
import { dodo } from "@/lib/dodo";
import { requireBillingOwnerDodoCustomerId, BillingIdentityError } from "@/lib/billing/billing-identity";

// GET /api/workspaces/[idOrSlug]/billing/invoices — the subscription owner's
// Dodo payment / invoice history (keyed on User.dodoCustomerId; D9).
export const GET = withWorkspace(
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
    if (!dodoCustomerId) return NextResponse.json([]);

    try {
      const out: Array<{
        id: string;
        total: number;
        currency: string;
        createdAt: string;
        status: string | null;
        pdfUrl: string | null;
      }> = [];
      for await (const p of dodo.payments.list({ customer_id: dodoCustomerId, page_size: 100 } as never)) {
        const pay = p as {
          payment_id: string;
          total_amount: number;
          currency: string;
          created_at: string;
          status?: string | null;
          invoice_url?: string | null;
        };
        out.push({
          id: pay.payment_id,
          total: pay.total_amount,
          currency: pay.currency,
          createdAt: pay.created_at,
          status: pay.status ?? null,
          pdfUrl: pay.invoice_url ?? null,
        });
        if (out.length >= 100) break;
      }
      return NextResponse.json(out);
    } catch (error) {
      console.error("[billing/invoices]", error);
      return NextResponse.json({ error: "Failed to fetch invoices" }, { status: 500 });
    }
  },
  { requiredPermission: "billing:read" },
);
