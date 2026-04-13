import {  ToggleGroup, useRouterStuff } from "@repo/ui";
import { cn } from "@repo/utils";
import { useContext } from "react";
import { AnalyticsContext } from "./analytics-providers";

export function ChartViewSwitcher({ className }: { className?: string }) {
  const { queryParams } = useRouterStuff();

  const { view } = useContext(AnalyticsContext);

  return (
    <ToggleGroup
      className={cn(
        "flex w-fit shrink-0 items-center gap-1 border-neutral-100 bg-neutral-100",
        className,
      )}
      optionClassName="size-8 text-sm p-0 flex items-center justify-center"
      indicatorClassName="border border-neutral-200 bg-white"
      options={[
        {
          label: "A",
          value: "timeseries",
        },
        {
          label: "F",
          value: "funnel",
        },
      ]}
      selected={view}
      selectAction={(option) => {
        queryParams({
          set: { view: option },
        });
      }}
    />
  );
}