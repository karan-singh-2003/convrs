import { AnalyticsTabs } from "./analytics-tabs";
import { AnalyticsContext } from "./analytics-providers";
import { useContext } from "react";

export function ChartSection() {
  const tabs = [
    { id: "people", label: "People" },
    { id: "revenue", label: "Revenue" },
    { id: "views", label: "Views" },
    { id: "cr", label: "Conversion " },
    { id: "bounced", label: "Bounced " },
    { id: "duration", label: "Duration" },
  ];

  const { totalEvents } = useContext(AnalyticsContext);
  console.log("ChartSection - totalEvents:", totalEvents);
 
  return (
    <div className="border border-neutral-200 rounded-lg  bg-white sm:rounded-xl overflow-hidden group ">
      <div className=" border-b border-neutral-200 ">
        <AnalyticsTabs
          tab="people"
          totalEvents={totalEvents}
          requiresUpgrade={false}
        />
      </div>
      <div className="p-4">
        {/* <AnalyticsAreaChart /> */}

        {/* <div className="h-[444px] w-full sm:h-[464px]">
          <AnalyticsFunnelChart />
        </div> */}
      </div>
    </div>
  );
}
