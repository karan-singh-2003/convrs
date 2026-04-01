import { AnalyticsContext } from "./analytics-providers";
import AnalyticsProvider from "./analytics-providers";
import { AnalyticsToggle } from "./analytics-toggle";
import { ChartSection } from "./chart-section";
import { DeviceSection } from "./device-section";
import { LocationSection } from "./location-section";
import { PagesSection } from "./pages-section";
import { SourcesSection } from "./sources-section";

export default function Analytics() {
  return (
    <AnalyticsProvider>
      <AnalyticsContext.Consumer>
        {({ requiresUpgrade }) => {
          return (
            <div className="my-2  space-y-4">
              <div className="max-w-screen-lg mx-auto rounded-md py-3 text-sm ">
                <AnalyticsToggle/>
              </div>
              <div className="space-y-[6rem] ">
                <ChartSection />
                <StatsGrid />
              </div>
            </div>
          );
        }}
      </AnalyticsContext.Consumer>
    </AnalyticsProvider>
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
