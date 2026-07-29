import { withWorkspace } from "@/lib/auth";
import { getFunnelAnalytics } from "@/lib/analytics/get-funnel-analytics";
import { analyticsQuerySchema } from "@/lib/zod/schemas/analytics";
import * as z from "zod/v4";
import { getAnalytics } from "@/lib/analytics/get-analytics";

const funnelRequestSchema = z.object({
  steps: z.array(z.string().min(1)).min(1).max(8),
});

function parseStepsFromSearchParams(
  searchParams: Record<string, string>
): string[] {
  const steps = searchParams.steps;
  const stepsCsv = searchParams.stepsCsv;
  const raw = steps?.trim() ? steps : stepsCsv;

  if (!raw) return [];

  return raw
    .split(",")
    .map((step) => step.trim())
    .filter(Boolean)
    .slice(0, 8);
}

async function getTotalRevenueForPeriod({
  workspaceId,
  start,
  end,
  interval,
  currency,
  kpiType,
  kpiEventName,
}: {
  workspaceId: string;
  start?: Date;
  end?: Date;
  interval?: "24h" | "7d" | "30d" | "90d" | "1y" | "mtd" | "qtd" | "ytd" | "all";
  currency?: string;
  kpiType?: "revenue" | "goal";
  kpiEventName?: string;
}) {
  const rows = await getAnalytics({
    workspaceId,
    event: "composite",
    groupBy: "count",
    start,
    end,
    interval,
    currency,
    kpiType,
    kpiEventName,
  });

  return rows?.[0]?.revenue ?? 0;
}

export const GET = withWorkspace(
  async ({ searchParams, workspace }) => {
    const { steps } = funnelRequestSchema.parse({
      steps: parseStepsFromSearchParams(searchParams),
    });

    // Parse the same searchParams through analyticsQuerySchema to get
    // properly-typed start/end (Date) and interval (literal union),
    // matching what getAnalytics actually expects.
    const parsedAnalyticsParams = analyticsQuerySchema.parse(searchParams);

    const totalRevenue = await getTotalRevenueForPeriod({
      workspaceId: workspace.id,
      start: parsedAnalyticsParams.start,
      end: parsedAnalyticsParams.end,
      interval: parsedAnalyticsParams.interval,
      currency: workspace.currency,
      kpiType: workspace.kpiType,
      kpiEventName: workspace.kpiEventName ?? undefined,
    });

    const data = await getFunnelAnalytics({
      workspaceId: workspace.id,
      steps,
      totalRevenue,
    });

    return Response.json({ data });
  },
  { requiredPermission: "analytics.read" }
);

export const POST = withWorkspace(
  async ({ req, workspace }) => {
    const { steps } = funnelRequestSchema.parse(await req.json());

    const data = await getFunnelAnalytics({
      workspaceId: workspace.id,
      steps,
    });

    return Response.json({ data });
  },
  { requiredPermission: "analytics.read" }
);