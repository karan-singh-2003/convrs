import { AnalyticsContext, AnalyticsProvider } from "./analytics-providers";
import { AnalyticsToggle } from "./analytics-toggle";
import { ChartSection } from "./chart-section";
import DeviceSection from "./device-section";
import LocationSection from "./location-section";
import PagesSection from "./pages-section";
import SourcesSection from "./sources-section";

export default function Analytics() {
  return (
    <AnalyticsProvider>
      <AnalyticsContext.Consumer>
        {({ requiresUpgrade }) => {
          return (
            <div className="my-7 mx-auto grid gap-5">
              <ChartSection />
              <StatsGrid />
            </div>
          );
        }}
      </AnalyticsContext.Consumer>
    </AnalyticsProvider>
  );
}

function StatsGrid() {
  return (
    <div className="grid grid-cols-1  gap-5  md:grid-cols-2">
      <PagesSection />
      <SourcesSection />
      <LocationSection />
      <DeviceSection />
    </div>
  );
}
