"use client";

import UseWorkspaces from "@/lib/swr/use-workspaces";
import { PageWidthWrapper } from "@/ui/layout/page-width-wrapper";
import DashboardGraph from "./graph";
import Link from "next/link";
import { Plus } from "lucide-react";
import { useCreateWorkspaceModal } from "@/ui/modals/create-workspace-modal";
import { cn } from "@repo/utils";
import useSWR from "swr";
import { fetcher } from "@repo/utils";

type TDashboardResponseData = {
  visitors: number;
  revenue: number;
};

export default function DashboardPageClient() {
  const { workspaces, loading, error } = UseWorkspaces();

  const { setShowCreateWorkspaceModal, CreateWorkspaceModal } =
    useCreateWorkspaceModal();

  const {
    data,
    isLoading,
    error: dashboardError,
  } = useSWR<TDashboardResponseData>("/api/dashboard", fetcher, {
    revalidateOnFocus: false,
    shouldRetryOnError: false,
  });

  return (
    <>
      <CreateWorkspaceModal />

      <PageWidthWrapper size="lg">
        <div className="space-y-4 px-3 py-4 sm:px-4 lg:px-0">
          {/* Loading */}
          {loading && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 2 }).map((_, i) => (
                <div
                  key={i}
                  className="min-h-[220px] animate-pulse rounded-xl border border-border-subtle bg-bg-emphasis shadow-sm sm:min-h-[240px] lg:min-h-[260px]"
                />
              ))}
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="rounded-xl border border-border-subtle bg-red-50 p-4 font-display text-sm font-medium text-red-700 sm:text-[15px]">
              Failed to load workspaces.
            </div>
          )}

          {/* Empty */}
          {!loading && !error && workspaces?.length === 0 && (
            <div className="flex min-h-[220px] items-center justify-center rounded-xl border border-border-subtle bg-bg-subtle font-display text-sm font-medium text-content-subtle sm:min-h-[240px] sm:text-[15px] lg:min-h-[260px]">
              No workspaces yet.
            </div>
          )}

          {/* Last 24 hours visitors */}
          {data && (
            <div className="rounded-xl border-l-4 border-border-subtle bg-bg-subtle px-4 py-3 font-display text-sm font-medium text-content-subtle sm:text-[14.5px]">
              You got {data.visitors}{" "}
              {data.revenue > 0 && `and earned ${data.revenue}`} in last 24
              hours
            </div>
          )}

          {/* Workspaces */}
          {!loading && !error && workspaces && workspaces.length > 0 && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {workspaces.map((workspace) => (
                <Link
                  key={workspace.id}
                  href={`/${workspace.slug}`}
                  className="group flex min-h-[220px] flex-col justify-between overflow-hidden rounded-xl border border-border-subtle bg-bg-card shadow-sm transition-all hover:border-border-default hover:shadow-md sm:min-h-[240px] lg:min-h-[260px]"
                >
                  {/* Header */}
                  <div className="flex items-center justify-between border-b border-border-subtle px-4 py-2 sm:py-2.5">
                    <h2 className="truncate font-default text-sm font-medium text-content-default sm:text-[14.5px]">
                      {workspace.name}
                    </h2>

                    <span
                      className={cn(
                        "inline-flex items-center rounded-full px-2.5 py-1 font-poppins text-xs font-medium capitalize ring-1 ring-inset",

                        workspace.subscriptionStatus === "active" &&
                        "bg-emerald-500/12 text-emerald-600 ring-emerald-500/20 dark:text-emerald-400",

                        workspace.subscriptionStatus === "trialing" &&
                        "bg-amber-500/12 text-amber-600 ring-amber-500/20 dark:text-amber-400",

                        workspace.subscriptionStatus === "inactive" &&
                        "bg-bg-subtle text-content-default ring-border-subtle",

                        workspace.subscriptionStatus === "past_due" &&
                        "bg-red-500/12 text-red-600 ring-red-500/20 dark:text-red-400",

                        workspace.subscriptionStatus === "canceling" &&
                        "bg-orange-500/12 text-orange-600 ring-orange-500/20 dark:text-orange-400",

                        workspace.subscriptionStatus === "canceled" &&
                        "bg-bg-subtle text-content-subtle ring-border-subtle",

                        workspace.subscriptionStatus === "expired" &&
                        "bg-red-500/12 text-red-600 ring-red-500/20 dark:text-red-400"
                      )}
                    >
                      {workspace.subscriptionStatus.replace("_", " ")}
                    </span>
                  </div>

                  {/* Graph */}
                  <DashboardGraph workspaceId={workspace.id} />
                </Link>
              ))}

              <button
                onClick={() => {
                  setShowCreateWorkspaceModal(true);
                }}
                className="flex min-h-[220px] items-center justify-center gap-2 rounded-xl border border-border-subtle bg-bg-card px-4 font-display text-sm font-medium text-content-subtle shadow-sm transition-all hover:bg-bg-emphasis hover:shadow-md sm:min-h-[240px] sm:text-[15px] lg:min-h-[260px]"
              >
                <Plus size={14} />
                Add Project
              </button>
            </div>
          )}
        </div>
      </PageWidthWrapper>
    </>
  );
}