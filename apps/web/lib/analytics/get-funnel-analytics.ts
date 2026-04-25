import { tb } from "@/lib/tinybird";
import * as z from "zod/v4";

const funnelPipe = tb.buildPipe({
  pipe: "v1_funnel",
  parameters: z.object({
    workspaceId: z.string().min(1),
    steps: z.string().optional(),
  }),
  data: z.object({
    step: z.string(),
    users: z.coerce.number().int().nonnegative(),
  }),
});

export async function getFunnelAnalytics({
  workspaceId,
  steps,
}: {
  workspaceId: string;
  steps: string[];
}) {
  const normalizedSteps = steps
    .map((step) => step.trim())
    .filter(Boolean)
    .slice(0, 8);

  if (normalizedSteps.length === 0) {
    return [];
  }

  const response = await funnelPipe({
    workspaceId,
    steps: normalizedSteps.join(","),
  });

  return response.data;
}
