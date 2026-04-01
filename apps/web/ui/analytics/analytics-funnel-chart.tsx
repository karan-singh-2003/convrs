"use client";

import { FunnelChart } from "@repo/ui";
import { useMemo } from "react";

export function AnalyticsFunnelChart({ demo = true }) {
  const totalEvents = {
    clicks: 0,
    leads: 0,
    sales: 0,
    saleAmount: 0,
  };

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

  const rawSteps = [
    { id: "clicks", label: "Clicks" },
    { id: "visitors", label: "Visitors" },
    { id: "signups", label: "Signups" },
    { id: "activated", label: "Activated" },
    // { id: "engaged", label: "Engaged" },
    // { id: "trial", label: "Trial" },
    // { id: "leads", label: "Leads" },
    // { id: "sales", label: "Sales" },
  ].slice(0, 8);

  const steps = useMemo(() => {
    return rawSteps.map((step, index) => ({
      id: step.id,
      label: step.label,
      value: demo
        ? ([130, 120, 100, 85, 70, 55, 40, 24][index] ?? 0)
        : (totalEvents?.[step.id] ?? 0),
      additionalValue:
        step.id === "sales"
          ? demo
            ? 22800
            : (totalEvents?.saleAmount ?? 0)
          : undefined,
      colorClassName: COLORS[index],
    }));
  }, [demo]);

  return (
    <div className="h-[400px] w-full">
      <FunnelChart steps={steps} defaultTooltipStepId="" />
    </div>
  );
}
