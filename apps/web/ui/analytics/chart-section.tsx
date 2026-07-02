"use client";

import { EventType } from "@/lib/analytics/types";
import useWorkspace from "@/lib/swr/use-workspace";
import useIntegrations from "@/lib/swr/use-integration";
import {
  BlurImage,
  buttonVariants,
  ToggleGroup,
  useRouterStuff,
} from "@repo/ui";
import { cn } from "@repo/utils";
import { Play } from "lucide-react";
import Link from "next/link";
import { useCallback, useContext, useEffect, useMemo, useState } from "react";
import { AnalyticsAreaChart } from "./analytics-area-chart";
import { AnalyticsFunnelChart } from "./analytics-funnel-chart";
import { AnalyticsContext } from "./analytics-providers";
import { AnalyticsTabs } from "./analytics-tabs";
import { ChartViewSwitcher } from "./chart-view-switcher";
import { useCreateFunnelModal } from "../modals/create-funnel-modal";
import useFunnels from "@/lib/swr/use-funnels";
import { useLiveVisitors } from "@/lib/analytics/use-live-visitors";

type ChartSectionProps = {
  mode: "private" | "public";
  workspaceId?: string;
};

type Tab = {
  id: "clicks" | "revenue";
  label: string;
  colorClassName: string;
  conversions: boolean;
};

export function ChartSection({ mode, workspaceId }: ChartSectionProps) {
  const {
    totalEvents,
    percentageChanges,
    requiresUpgrade,
    showConversions,
    selectedTab,
    saleUnit,
    view,
  } = useContext(AnalyticsContext);

  const { plan, projectToken, id } = useWorkspace();
  const { integrations } = useIntegrations();
  const hasRevenueProvider = integrations.length > 0;

  const { queryParams } = useRouterStuff();
  const { funnels } = useFunnels({
    workspaceId: mode === "public" ? (workspaceId ?? id) : undefined,
  });
  const [selectedFunnelId, setSelectedFunnelId] = useState<string | null>(null);
  const handleSelectFunnel = useCallback((funnel: { id: string }) => {
    setSelectedFunnelId(funnel.id);
  }, []);

  const selectedFunnel = useMemo(() => {
    if (selectedFunnelId) {
      return funnels.find((funnel) => funnel.id === selectedFunnelId) ?? null;
    }
    return funnels[0] ?? null;
  }, [funnels, selectedFunnelId]);

  const hasFunnels = funnels.length > 0;

  const {
    openCreateFunnelModal,
    openFunnelListModal,
    CreateFunnelEditorModal,
    FunnelListModal,
  } = useCreateFunnelModal({
    onSelectFunnel: handleSelectFunnel,
  });

  const { count: liveVisitorsCount } = useLiveVisitors(projectToken ?? null);

  const tabs = useMemo(
    () =>
      [
        {
          id: "clicks",
          label: "Clicks",
          colorClassName: "text-blue-500/50",
          conversions: false,
        },
        {
          id: "revenue",
          label: "Revenue",
          colorClassName: "text-teal-400/50",
          conversions: true,
        },
      ] as Tab[],
    [showConversions]
  );

  const tab = tabs.find(({ id }) => id === selectedTab) ?? tabs[0];

  const showPaywall =
    (tab.conversions || view === "funnel") &&
    (plan === "free" || plan === "pro");

  const canShowFunnelView = mode === "private" || hasFunnels;

  const safeView =
    view === "funnel" && !canShowFunnelView ? "timeseries" : view;

  useEffect(() => {
    if (view === "funnel" && !canShowFunnelView) {
      queryParams({ set: { view: "timeseries" } });
    }
  }, [canShowFunnelView, queryParams, view]);

  return (
    <>
      <CreateFunnelEditorModal />
      <FunnelListModal />
      <div>
        <div className="w-full bg-neutral-50 border-b">
          <div className="w-full relative  py-2">
            <div className="max-w-screen-lg mx-auto flex justify-center ">
              {safeView === "timeseries" ? (
                <AnalyticsTabs
                  showConversions={showConversions}
                  totalEvents={totalEvents}
                  percentageChanges={percentageChanges}
                  liveVisitorsCount={liveVisitorsCount}
                  tab={tab.id}
                  tabHref={(id) =>
                    queryParams({
                      set: { event: id },
                      getNewPath: true,
                    }) as string
                  }
                  saleUnit={saleUnit}
                  setSaleUnit={(option) =>
                    queryParams({
                      set: { saleUnit: option },
                    })
                  }
                  hasRevenueProvider={hasRevenueProvider}
                  requiresUpgrade={requiresUpgrade}
                  showPaywall={showPaywall}
                />
              ) : (
                <div className="md:min-h-[134px] min-h-[240px] bg-orange-50" />
              )}
            </div>

            <div className="absolute right-3 md:top-1 z-20 flex items-center gap-2 bg-white/80 backdrop-blur px-2 py-1 rounded-full shadow">
              {safeView === "funnel" && hasFunnels && (
                <button
                  className="bg-neutral-100 text-neutral-600 text-sm font-medium px-4 py-1.5 rounded-full hover:bg-neutral-200 transition"
                  onClick={() => openFunnelListModal()}
                >
                  {selectedFunnel?.name || "Choose funnel"}
                </button>
              )}

              {canShowFunnelView && (
                <ChartViewSwitcher showFunnel={canShowFunnelView} />
              )}
            </div>
          </div>
        </div>

        <div className="relative">
          <div className={cn("relative overflow-hidden sm:rounded-b-xl")}>
            {safeView === "timeseries" && (
              <div className="h-[444px] w-full sm:h-[464px]">
                <AnalyticsAreaChart resource={tab.id} demo={showPaywall} />
              </div>
            )}

            {safeView === "funnel" && (
              <div className="relative h-[444px] w-full sm:h-[464px]">
                <div
                  className={`h-full w-full transition-opacity ${
                    mode === "private" && funnels.length === 0
                      ? "opacity-20"
                      : "opacity-100"
                  }`}
                >
                  <AnalyticsFunnelChart
                    selectedFunnel={selectedFunnel}
                    demo={funnels.length === 0}
                  />
                </div>

                {mode === "private" && funnels.length === 0 && (
                  <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
                    <button
                      className="pointer-events-auto bg-black text-white text-sm font-medium font-poppins px-4 py-1.5 rounded-full hover:bg-gray-800 transition shadow-sm"
                      onClick={() => openCreateFunnelModal()}
                    >
                      Create funnel
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
