"use client";

import UseWorkspaces from "@/lib/swr/use-workspaces";
import { PageWidthWrapper } from "@/ui/layout/page-width-wrapper";
import DashboardGraph from "./graph";
import Link from "next/link";
import { Plus } from "lucide-react";
import { useCreateWorkspaceModal } from "@/ui/modals/create-workspace-modal";

export default function DashboardPage() {
  const { workspaces, loading, error } = UseWorkspaces();
  const { setShowCreateWorkspaceModal, CreateWorkspaceModal } =
    useCreateWorkspaceModal();
  return (
    <>
      <CreateWorkspaceModal />
      <PageWidthWrapper size="md">
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
      </PageWidthWrapper>
    </>
  );
}
