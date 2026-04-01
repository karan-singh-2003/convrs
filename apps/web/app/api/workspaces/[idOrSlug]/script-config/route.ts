import { withWorkspace } from "@/lib/auth";
import { NextResponse } from "next/server";

// GET /api/workspaces/[idOrSlug]/script-config - get domain + project token for script snippet
export const GET = withWorkspace(
  async ({ workspace }) => {
    return NextResponse.json({
      domain: workspace.domain,
      projectToken: workspace.projectToken,
    });
  },
  {
    requiredPermission: "workspace:read",
  }
);
