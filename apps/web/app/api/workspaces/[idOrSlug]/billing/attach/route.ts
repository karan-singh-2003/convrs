import { NextResponse } from "next/server";
import { z } from "zod";
import { withWorkspace } from "@/lib/auth";
import { attachWorkspaceSchema } from "@/lib/zod/schemas/subscriptions";
import { attachWorkspace, BillingError } from "@/lib/billing/subscription-service";

// POST /api/workspaces/[idOrSlug]/billing/attach — cover this workspace with an
// existing subscription the caller owns (Scenario 5: no Dodo call, no payment).
export const POST = withWorkspace(
  async ({ req, workspace, session }) => {
    let body: z.infer<typeof attachWorkspaceSchema>;
    try {
      body = attachWorkspaceSchema.parse(await req.json());
    } catch {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    try {
      await attachWorkspace({
        actorUserId: session.user.id,
        workspaceId: workspace.id,
        subscriptionId: body.subscriptionId,
      });
      return NextResponse.json({ success: true });
    } catch (err) {
      if (err instanceof BillingError) {
        return NextResponse.json({ error: err.message, code: err.code }, { status: err.httpStatus });
      }
      console.error("[billing/attach]", err);
      return NextResponse.json({ error: "Failed to attach subscription" }, { status: 500 });
    }
  },
  { requiredPermission: "billing:write" },
);
