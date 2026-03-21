import { FunnelChart } from "@repo/ui";
import { useContext, useMemo } from "react";

export type totalEventsType = {
  clicks: number;
  leads: number;
  sales: number;
  saleAmount: number;
};

export function AnalyticsFunnelChart({ demo = false }: { demo?: boolean }) {
  const totalEvents: totalEventsType = {
    clicks: 130,
    leads: 100,
    sales: 24,
    saleAmount: 228_00,
  };
  const steps = useMemo(
    () => [
      {
        id: "clicks",
        label: "Clicks",
        value: demo ? 130 : (totalEvents?.clicks ?? 0),
        colorClassName: "text-blue-600",
      },
      {
        id: "leads",
        label: "Leads",
        value: demo ? 100 : (totalEvents?.leads ?? 0),
        colorClassName: "text-violet-600",
      },
      {
        id: "sales",
        label: "Sales",
        value: demo ? 24 : (totalEvents?.sales ?? 0),
        additionalValue: demo ? 228_00 : (totalEvents?.saleAmount ?? 0),
        colorClassName: "text-teal-400",
      },
    ],
    [demo, totalEvents]
  );

  return (
    <>
      {totalEvents || demo ? (
        <FunnelChart
          steps={steps}
          defaultTooltipStepId={demo ? "sales" : undefined}
        />
      ) : null}
    </>
  );
}
