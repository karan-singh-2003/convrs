"use client";

import useFunnels from "@/lib/swr/use-funnels";
import useWorkspace from "@/lib/swr/use-workspace";
import { cn } from "@repo/utils";
import { ChevronDown } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { useCreateFunnelModal } from "../modals/create-funnel-modal";
import { AnalyticsFunnelChart } from "./analytics-funnel-chart";

// Funnel view for the Goals card's "Funnel" tab — same behaviour the old
// timeseries/funnel toggle in ChartSection had.
export function FunnelPanel({
  mode,
  workspaceId,
}: {
  mode: "private" | "public";
  workspaceId?: string;
}) {
  const { id } = useWorkspace();
  const { funnels, loading: funnelsLoading } = useFunnels({
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

  // Distinguish "still fetching" from "confirmed zero funnels" so the
  // empty-state CTA doesn't flash on every load.
  const hasFunnels = funnels.length > 0;
  const noFunnelsConfirmed = !funnelsLoading && !hasFunnels;

  const {
    openCreateFunnelModal,
    openFunnelListModal,
    CreateFunnelEditorModal,
    FunnelListModal,
  } = useCreateFunnelModal({
    onSelectFunnel: handleSelectFunnel,
  });

  return (
    <>
      <CreateFunnelEditorModal />
      <FunnelListModal />

      <div className="relative h-full w-full">
        {hasFunnels && (
          <button
            type="button"
            onClick={() => openFunnelListModal()}
            className="absolute right-0 top-0 z-20 flex max-w-[60%] items-center gap-1.5 rounded-full border border-border-subtle bg-bg-card px-3 py-1 text-[13px] font-medium text-content-default shadow-sm transition-colors hover:bg-bg-subtle dark:hover:bg-bg-emphasis"
          >
            <span className="truncate">{selectedFunnel?.name || "Choose funnel"}</span>
            <ChevronDown className="size-3.5 shrink-0 text-content-subtle" />
          </button>
        )}

        <div
          className={cn(
            "h-full w-full transition-opacity",
            noFunnelsConfirmed ? "opacity-20" : "opacity-100"
          )}
        >
          <AnalyticsFunnelChart
            selectedFunnel={selectedFunnel}
            // Demo only once we've *confirmed* there's no real funnel —
            // never while the request is still in flight.
            demo={noFunnelsConfirmed}
          />
        </div>

        {noFunnelsConfirmed && (
          <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
            {mode === "private" ? (
              <button
                type="button"
                className="pointer-events-auto rounded-full bg-black px-4 py-1.5 font-poppins text-sm font-medium text-white shadow-sm transition hover:bg-gray-800 dark:bg-white dark:text-black dark:hover:bg-neutral-200"
                onClick={() => openCreateFunnelModal()}
              >
                Create funnel
              </button>
            ) : (
              <p className="text-sm font-medium text-content-subtle">No funnels yet</p>
            )}
          </div>
        )}
      </div>
    </>
  );
}
