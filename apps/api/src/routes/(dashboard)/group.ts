import { withAnalyticsWorkspace } from "@/lib/auth/with-analytics-workspace";
import { getGroup } from "@/services/analytics/get-group";

export const GET = withAnalyticsWorkspace(async ({ req, workspace }) => {
  const { searchParams } = new URL(req.url);

  const start = searchParams.get("start")!;
  const end = searchParams.get("end")!;
  const groupBy = searchParams.get("groupBy") || "country";

  const data = await getGroup({
    workspaceId: workspace.id,
    start,
    end,
    groupBy,
  });

  return Response.json(data);
});