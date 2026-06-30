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
  revenue: number
};



export default function DashboardPageClient() {
  const { workspaces, loading, error } = UseWorkspaces();
  console.log("workspaces", workspaces)
  const { setShowCreateWorkspaceModal, CreateWorkspaceModal } =
    useCreateWorkspaceModal();
  const { data, isLoading, error: dashboardError } = useSWR<TDashboardResponseData>(
    "/api/dashboard",
    fetcher,
    {
      revalidateOnFocus: false,
      shouldRetryOnError: false,
    }
  );
  console.log("data for last 24 hours", data)
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
                  className="min-h-[220px] animate-pulse rounded-md border bg-neutral-100 sm:min-h-[240px] lg:min-h-[260px]"
                />
              ))}
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="rounded-md border bg-red-50 p-4 text-sm font-medium font-display text-red-600 sm:text-[15px]">
              Failed to load workspaces.
            </div>
          )}

          {/* Empty */}
          {!loading && !error && workspaces?.length === 0 && (
            <div className="flex min-h-[220px] items-center justify-center rounded-md border bg-neutral-50 text-sm font-medium font-display text-neutral-500 sm:min-h-[240px] lg:min-h-[260px] sm:text-[15px]">
              No workspaces yet.
            </div>
          )}

          {/* last 24 hours visitors */}
          {data && (
            < div className="bg-primary-100/60 border-primary-100/70 px-4 py-3 text-sm font-medium font-display text-neutral-500 rounded-md border-l-4 sm:text-[14.5px]">
              You got {data?.visitors} {data?.revenue > 0 && `and earned ${data?.revenue}`} in last 24 hours
            </div>
          )}
          {/* Workspaces */}
          {!loading && !error && workspaces && workspaces.length > 0 && (

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {workspaces.map((workspace) => (
              <Link
                key={workspace.id}
                href={`/${workspace.slug}`}
                className="group flex min-h-[220px] flex-col justify-between overflow-hidden rounded-md border border-neutral-200 bg-white shadow-sm transition-all hover:border-neutral-300 sm:min-h-[240px] lg:min-h-[260px]"
              >
                {/* Header */}
                <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-2 sm:py-2.5">
                  <h2 className="truncate font-default text-sm font-medium text-neutral-600 sm:text-[14.5px]">
                    {workspace.name}
                  </h2>

                  <span
                    className={cn(
                      "inline-flex font-poppins items-center rounded-full px-2.5 py-1 text-xs font-medium capitalize",
                      workspace.subscriptionStatus === "active" &&
                      "bg-emerald-50 text-emerald-700  ring-emerald-200",
                      workspace.subscriptionStatus === "trialing" &&
                      "bg-amber-50 text-amber-700  ring-amber-200",
                      workspace.subscriptionStatus === "inactive" &&
                      "bg-neutral-100 text-neutral-600  ring-neutral-200",
                      workspace.subscriptionStatus === "past_due" &&
                      "bg-red-50 text-red-700  ring-red-200",
                      workspace.subscriptionStatus === "canceling" &&
                      "bg-orange-50 text-orange-700  ring-orange-200",
                      workspace.subscriptionStatus === "canceled" &&
                      "bg-neutral-100 text-neutral-500 ring-neutral-200",
                      workspace.subscriptionStatus === "expired" &&
                      "bg-red-50 text-red-700  ring-red-200"
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
              className="flex min-h-[220px] items-center justify-center gap-2 rounded-md border bg-neutral-50 px-4 text-sm font-medium font-display text-neutral-500 transition-colors hover:bg-neutral-100 sm:min-h-[240px] lg:min-h-[260px] sm:text-[15px]"
            >
              <Plus size={14} /> Add Project
            </button>
          </div>
        )}
      </div>
    </PageWidthWrapper >
    </>
  );
}
