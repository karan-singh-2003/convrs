import { withWorkspace } from "@/lib/auth";
import { getFunnelAnalytics } from "@/lib/analytics/get-funnel-analytics";
import * as z from "zod/v4";

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

export const GET = withWorkspace(
  async ({ searchParams, workspace }) => {
    const { steps } = funnelRequestSchema.parse({
      steps: parseStepsFromSearchParams(searchParams),
    });

    const data = await getFunnelAnalytics({
      workspaceId: workspace.id,
      steps,
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
