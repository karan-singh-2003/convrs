import { NextResponse } from "next/server";
import { withWorkspace } from "@/lib/auth";
import { detachWorkspace, BillingError } from "@/lib/billing/subscription-service";

// POST /api/workspaces/[idOrSlug]/billing/detach — remove this workspace from
// its subscription (data preserved — I-16). A now-empty Standard subscription
// is auto-scheduled for cancellation (D5).
export const POST = withWorkspace(
  async ({ workspace, session }) => {
    try {
      const result = await detachWorkspace({
        actorUserId: session.user.id,
        workspaceId: workspace.id,
      });
      return NextResponse.json({ success: true, ...result });
    } catch (err) {
      if (err instanceof BillingError) {
        return NextResponse.json({ error: err.message, code: err.code }, { status: err.httpStatus });
      }
      console.error("[billing/detach]", err);
      return NextResponse.json({ error: "Failed to detach subscription" }, { status: 500 });
    }
  },
  { requiredPermission: "billing:write" },
);
