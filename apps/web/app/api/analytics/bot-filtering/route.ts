import { NextResponse } from "next/server";
import { getSearchParams } from "@repo/utils";
import { getBotFilteringAnalytics } from "@/lib/analytics/get-bot-analytics";
import { botFilteringQuerySchema } from "@/lib/zod/schemas/bot-filtering";
import { resolveWorkspaceForAnalytics } from "@/lib/api/analytics/resolve-workspace";

export const GET = async (req: Request) => {
  const searchParams = getSearchParams(req.url);
  const parsedParams = botFilteringQuerySchema.parse(searchParams);

  const resolved = await resolveWorkspaceForAnalytics(searchParams);
  if (!resolved.ok) {
    return NextResponse.json({ error: resolved.error }, { status: resolved.status });
  }

  const data = await getBotFilteringAnalytics({
    workspaceId: resolved.workspace.id,
    domain: parsedParams.domain,
    category: parsedParams.category,
    groupBy: parsedParams.groupBy,
    interval: parsedParams.interval,
    start: parsedParams.start,
    end: parsedParams.end,
    timezone: parsedParams.timezone,
    granularity: parsedParams.granularity,
  });

  return NextResponse.json({ data });
};