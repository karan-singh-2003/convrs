import { withWorkspace } from "@/lib/auth";
import { analyticsQuerySchema } from "@/lib/zod/schemas/analytics";
import { getAnalytics } from "@/lib/analytics/get-analytics";

export const GET = withWorkspace(
  async ({ searchParams, workspace, session }) => {
    console.log(
      "Received analytics timeseries query with params:",
      searchParams.toString()
    );
    const parsedParams = analyticsQuerySchema.parse(searchParams);

    const data = await getAnalytics({
      ...parsedParams,
      workspaceId: workspace.id,
    });

    return new Response(
      JSON.stringify({
        data,
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
