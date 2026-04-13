import { NextResponse } from "next/server";
import { withWorkspace } from "@/lib/auth";
import { getWorkspaceCustomerById } from "../../../../../../lib/api/customers/query-customers";

// GET /api/workspaces/[idOrSlug]/customers/[customerId] - get customer details
export const GET = withWorkspace(
  async ({ workspace, params }) => {
    const customerId = params.customerId;

    if (!customerId) {
      return NextResponse.json(
        { error: "Customer ID is required" },
        { status: 400 }
      );
    }

    const customer = await getWorkspaceCustomerById(workspace, customerId);

    if (!customer) {
      return NextResponse.json(
        { error: "Customer not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ customer });
  },
  { requiredPermission: "workspace:read" }
);
