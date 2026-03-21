import { withAnalyticsWorkspace } from "@/lib/auth/with-analytics-workspace";
import { getAnalyticsWithComparison } from "../../services/getAnalyticsComparison";

export const GET = withAnalyticsWorkspace(async ({ req, workspace }) => {
  const { searchParams } = new URL(req.url);

  const start = searchParams.get("start")!;
  const end = searchParams.get("end")!;

  const data = await getAnalyticsWithComparison({
    workspaceId: workspace.id,
    start,
    end,
  });

  return Response.json(data);
});
