import { NextResponse } from "next/server";
import { withWorkspace } from "@/lib/auth";
import { listWorkspaceCustomers } from "../../../../../lib/api/customers/query-customers";

// GET /api/workspaces/[idOrSlug]/customers - list workspace customers
export const GET = withWorkspace(
  async ({ workspace, searchParams }) => {
    const limitParam = Number(searchParams.limit ?? 100);
    const limit = Number.isFinite(limitParam) ? limitParam : 100;

    const customers = await listWorkspaceCustomers(workspace, limit);
    return NextResponse.json({ customers });
  },
  { requiredPermission: "workspace:read" }
);
