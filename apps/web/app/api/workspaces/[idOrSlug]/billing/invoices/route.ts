import { NextResponse } from "next/server";
import { withWorkspace } from "@/lib/auth";
import { stripe } from "@/lib/stripe";

export const GET = withWorkspace(
  async ({ workspace }) => {
    if (!workspace.dodoCustomerId) {
      return NextResponse.json([]);
    }
    try {
      const invoices = await stripe.invoices.list({
        customer: workspace.dodoCustomerId,
        limit: 100,
      });
      return NextResponse.json(
        invoices.data.map((inv) => ({
          id: inv.id,
          total: inv.amount_paid,
          createdAt: inv.created,
          status: inv.status,
          pdfUrl: inv.invoice_pdf,
          description: "Boilercode subscription",
        }))
      );
    } catch (error) {
      return NextResponse.json(
        { error: "Failed to fetch invoices" },
        { status: 500 }
      );
    }
  },
  {
    requiredPermission: "billing:read",
  }
);
