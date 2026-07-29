// app/api/[slug]/analytics/goals-timeseries/route.ts
import { analyticsQuerySchema } from "@/lib/zod/schemas/analytics";
import { getGoalsTimeseries } from "@/lib/analytics/get-goal-timeseries";
import { NextResponse } from "next/server";
import { getSearchParams } from "@repo/utils";
import { resolveWorkspaceForAnalytics } from "@/lib/api/analytics/resolve-workspace";

export const GET = async (req: Request) => {
  const searchParams = getSearchParams(req.url);
  const parsedParams = analyticsQuerySchema.parse(searchParams);

  const resolved = await resolveWorkspaceForAnalytics(searchParams);
  if (!resolved.ok) {
    return NextResponse.json({ error: resolved.error }, { status: resolved.status });
  }
  const workspace = resolved.workspace;

  const data = await getGoalsTimeseries({
    ...parsedParams,
    workspaceId: workspace.id,
  });

  return NextResponse.json({ data });
};