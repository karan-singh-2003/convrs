"use client";

import AnalyticsProvider, { AnalyticsContext } from "./analytics-providers";
import { AnalyticsToggle } from "./analytics-toggle";
import { ChartSection } from "./chart-section";
import { DeviceSection } from "./device-section";
import { LocationSection } from "./location-section";
import { LowerGrid } from "./goals-section";
import { PagesSection } from "./pages-section";
import { SourcesSection } from "./sources-section";
import { useContext } from "react";
import BotFilteringCard from "./bot-filtering-card";
import { DashboardSkeleton } from "./dashboard-skeleton";
import { useDashboardCards } from "@/lib/analytics/use-dashboard-cards";

export default function Analytics({ mode, workspaceId, workspaceName }) {
  return (
    <AnalyticsProvider
      workspaceId={mode === "public" ? workspaceId : undefined}
    >
      <AnalyticsContent mode={mode} workspaceId={workspaceId} workspaceName={workspaceName} />
    </AnalyticsProvider>
  );
}

function AnalyticsContent({
  mode,
  workspaceId,
  workspaceName
}: {
  mode: "private" | "public";
  workspaceId: string;
  workspaceName: string;
}) {
  const { selectedTab, totalEventsLoading } = useContext(AnalyticsContext);
  const { settings: dashboardCardSettings } = useDashboardCards(workspaceId);

  if (totalEventsLoading) {
    return <DashboardSkeleton />;
  }

  return (
    <>
      <div className="my-2 space-y-4">
        <div className="max-w-screen-lg mx-auto overflow-hidden rounded-md py-3 text-sm">
          <AnalyticsToggle mode={mode} workspaceName={workspaceName} />
        </div>

        <div className="space-y-[4rem]">
          <ChartSection mode={mode} workspaceId={workspaceId} />
          <StatsGrid />
        </div>

        {selectedTab !== "revenue" && (
          <div className="max-w-screen-lg mx-auto">
            <LowerGrid />
          </div>
        )}
        {dashboardCardSettings.botFiltering && (
          <div className="max-w-screen-lg mx-auto">
            <BotFilteringCard />
          </div>
        )}


      </div>
    </>
  );
}

function StatsGrid() {
  return (
    <div className="grid grid-cols-1 max-w-screen-lg mx-auto gap-5  md:grid-cols-2">
      <SourcesSection />
      <PagesSection />

      <LocationSection />
      <DeviceSection />
    </div>
  );
}
