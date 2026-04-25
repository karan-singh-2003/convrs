import AnalyticsProvider, { AnalyticsContext } from "./analytics-providers";
import { AnalyticsToggle } from "./analytics-toggle";
import { ChartSection } from "./chart-section";
import { DeviceSection } from "./device-section";
import { LocationSection } from "./location-section";
import { LowerGrid } from "./goals-section";
import { PagesSection } from "./pages-section";
import { SourcesSection } from "./sources-section";
import { useContext } from "react";

export default function Analytics({ mode, workspaceId }) {
  return (
    <AnalyticsProvider
      workspaceId={mode === "public" ? workspaceId : undefined}
    >
      <AnalyticsContent mode={mode} />
    </AnalyticsProvider>
  );
}

function AnalyticsContent({ mode }: { mode: "private" | "public" }) {
  const { selectedTab    } = useContext(AnalyticsContext);

  return (
    <>
      <div className="my-2 space-y-4">
        <div className="max-w-screen-lg mx-auto rounded-md py-3 text-sm">
          <AnalyticsToggle />
        </div>

        <div className="space-y-[6rem]">
          <ChartSection mode={mode} />
          <StatsGrid />
        </div>

        {/*  Hide for revenue */}
        {selectedTab !== "revenue" && (
          <div className="max-w-screen-lg mx-auto">
            <LowerGrid />
          </div>
        )}
      </div>
    </>
  );
}

function StatsGrid() {
  return (
    <div className="grid grid-cols-1 max-w-screen-lg mx-auto gap-5  md:grid-cols-2">
      <PagesSection />
      <SourcesSection />
      <LocationSection />
      <DeviceSection />
    </div>
  );
}
