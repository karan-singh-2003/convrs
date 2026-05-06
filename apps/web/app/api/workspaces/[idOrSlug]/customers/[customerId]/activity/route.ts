import { withWorkspace } from "@/lib/auth";
import { getCustomerActivity } from "@/lib/analytics/get-customer-activity";

export const GET = withWorkspace(
  async ({ params, workspace, session }) => {
    const { customerId } = params;

    if (!customerId) {
      return new Response(
        JSON.stringify({ error: "Missing customerId" }),
        { status: 400 }
      );
    }

    const activity = await getCustomerActivity({
      workspaceId: workspace.id,
      customerId,
    });

    return new Response(
      JSON.stringify({
        activity,
        workspaceId: workspace.id,
        userId: session.user.id,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  },
  { requiredPermission: "analytics.read" }
);