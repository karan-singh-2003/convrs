"use client";

import { FunnelProps } from "@/lib/types";
import { FunnelChart } from "@repo/ui";
import { useContext, useMemo } from "react";
import { AnalyticsContext } from "./analytics-providers";
import { editQueryString } from "@/lib/analytics/utils";
import useSWR from "swr";
import { fetcher } from "@repo/utils";

export type FunnelData = {
  step: string;
  users: number;
};

export function AnalyticsFunnelChart({
  demo ,
  selectedFunnel,
}: {
  demo?: boolean;
  selectedFunnel?: FunnelProps | null;
}) {
  const { baseApiPath, queryString } = useContext(AnalyticsContext);

  const rawSteps = useMemo(() => {
    if (selectedFunnel?.steps?.length) {
      return selectedFunnel.steps
        .slice()
        .sort((a, b) => a.order - b.order)
        .map((step) => ({
          id: step.id,
          label: step.name,
          goal: step.value,
        }))
        .slice(0, 8);
    }

    return [
      { id: "clicks", label: "Clicks", goal: "clicks" },
      { id: "visitors", label: "Visitors", goal: "visitors" },
      { id: "signups", label: "Signups", goal: "signups" },
      { id: "activated", label: "Activated", goal: "activated" },
    ].slice(0, 8);
  }, [selectedFunnel]);

  const stepsCsv = useMemo(
    () => rawSteps.map((step) => step.goal).join(","),
    [rawSteps]
  );

  const currentQueryUrl = useMemo(() => {
    return `${baseApiPath}?${editQueryString(queryString, {
      event: "funnel",
      stepsCsv,
    })}`;
  }, [baseApiPath, queryString, stepsCsv]);

  const { data: funnelApiResponse } = useSWR<{ data: FunnelData[] }>(
    currentQueryUrl,
    fetcher,
    {
      keepPreviousData: true,
      revalidateOnFocus: false,
    }
  );

  console.log("funnelApiResponse:", funnelApiResponse);

  const usersByStep = useMemo(
    () =>
      new Map(
        (funnelApiResponse?.data ?? []).map(
          (row) => [row.step, row.users] as const
        )
      ),
    [funnelApiResponse?.data]
  );

  const COLORS = [
    "text-[#9D7CFF]",
    "text-[#7CAAFF]",
    "text-[#7CFFE0]",
    "text-[#7CF6FF]",
    "text-[#CF7CFF]",
    "text-[#E0FF7C]",
    "text-[#FF9A7C]",
    "text-[#FF7CAC]",
  ];

  const steps = useMemo(() => {
    return rawSteps.map((step, index) => ({
      id: step.id,
      label: step.label,
      goal: step.goal,
      value: demo
        ? ([130, 120, 100, 85, 70, 55, 40, 24][index] ?? 0)
        : (usersByStep.get(step.goal) ?? 0),
      colorClassName: COLORS[index],
    }));
  }, [demo, rawSteps, usersByStep]);

  return (
    <div className="h-full w-full">
      <FunnelChart steps={steps} defaultTooltipStepId="" />
    </div>
  );
}
