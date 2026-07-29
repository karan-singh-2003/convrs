// get-funnel-analytics.ts
import { tb } from "@/lib/tinybird";
import * as z from "zod/v4";

const funnelPipe = tb.buildPipe({
  pipe: "v1_funnel",
  parameters: z.object({ workspaceId: z.string().min(1), steps: z.string().optional() }),
  data: z.object({ step: z.string(), users: z.coerce.number().int().nonnegative() }),
});

const stepSourcesPipe = tb.buildPipe({
  pipe: "v1_funnel_step_sources",
  parameters: z.object({ workspaceId: z.string().min(1), steps: z.string().optional() }),
  data: z.object({ step: z.string(), referer: z.string(), visitors: z.coerce.number() }),
});

const stepCountriesPipe = tb.buildPipe({
  pipe: "v1_funnel_step_countries",
  parameters: z.object({ workspaceId: z.string().min(1), steps: z.string().optional() }),
  data: z.object({ step: z.string(), country: z.string(), visitors: z.coerce.number() }),
});

export async function getFunnelAnalytics({
  workspaceId,
  steps,
  totalRevenue, // total revenue for the period, passed in from the caller (see route below)
}: {
  workspaceId: string;
  steps: string[];
  totalRevenue?: number;
}) {
  const normalizedSteps = steps.map((s) => s.trim()).filter(Boolean).slice(0, 8);
  if (normalizedSteps.length === 0) return [];

  const stepsParam = normalizedSteps.join(",");

  const [funnelRes, sourcesRes, countriesRes] = await Promise.all([
    funnelPipe({ workspaceId, steps: stepsParam }),
    stepSourcesPipe({ workspaceId, steps: stepsParam }),
    stepCountriesPipe({ workspaceId, steps: stepsParam }),
  ]);

  const sourcesByStep = new Map<string, { referer: string; visitors: number }[]>();
  for (const row of sourcesRes.data) {
    const list = sourcesByStep.get(row.step) ?? [];
    list.push({ referer: row.referer, visitors: row.visitors });
    sourcesByStep.set(row.step, list);
  }

  const countriesByStep = new Map<string, { country: string; visitors: number }[]>();
  for (const row of countriesRes.data) {
    const list = countriesByStep.get(row.step) ?? [];
    list.push({ country: row.country, visitors: row.visitors });
    countriesByStep.set(row.step, list);
  }

  return funnelRes.data.map((row) => {
    const topSources = (sourcesByStep.get(row.step) ?? [])
      .sort((a, b) => b.visitors - a.visitors)
      .slice(0, 3)
      .map((s) => ({ ...s, pct: row.users > 0 ? Math.round((s.visitors / row.users) * 100) : 0 }));

    const topCountries = (countriesByStep.get(row.step) ?? [])
      .sort((a, b) => b.visitors - a.visitors)
      .slice(0, 3)
      .map((c) => ({ ...c, pct: row.users > 0 ? Math.round((c.visitors / row.users) * 100) : 0 }));

    return {
      step: row.step,
      users: row.users,
      // Simple attribution: total period revenue ÷ visitors reaching this step.
      // Flagged as an assumption — see note above if you want per-step revenue attribution instead.
      stepValue: totalRevenue && row.users > 0 ? totalRevenue / row.users : undefined,
      topSources,
      topCountries,
    };
  });
}