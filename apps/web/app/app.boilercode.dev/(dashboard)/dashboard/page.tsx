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
        <div className="py-4 space-y-4">
          {/* Loading */}
          {loading && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {Array.from({ length: 2 }).map((_, i) => (
                <div
                  key={i}
                  className="h-[260px] animate-pulse rounded-md border bg-neutral-100"
                />
              ))}
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="rounded-md border font-display font-medium bg-red-50 p-4 text-sm text-red-600">
              Failed to load workspaces.
            </div>
          )}

          {/* Empty */}
          {!loading && !error && workspaces?.length === 0 && (
            <div className="flex h-[260px] font-medium font-display items-center justify-center rounded-md border bg-neutral-50 text-sm text-neutral-500">
              No workspaces yet.
            </div>
          )}

          {/* Workspaces */}
          {!loading && !error && workspaces && workspaces.length > 0 && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {workspaces.map((workspace) => (
                <Link
                  key={workspace.id}
                  href={`/${workspace.slug}`}
                  className="group flex h-[260px] flex-col justify-between rounded-md border border-neutral-200 bg-white  shadow-sm transition-all hover:border-neutral-300"
                >
                  {/* Header */}
                  <div className="flex items-center  border-b border-neutral-200 py-2 justify-between">
                    <h2 className="truncate px-4  font-default text-sm md:text-[14.5px] font-medium text-neutral-600">
                      {workspace.name}
                    </h2>
                  </div>

                  {/* Graph */}
                  <DashboardGraph workspaceId={workspace.id} />
                </Link>
              ))}
              <div
                onClick={() => {
                  setShowCreateWorkspaceModal(true);
                }}
                className="flex h-[260px] font-medium font-display items-center justify-center gap-2 rounded-md border bg-neutral-50 text-sm text-neutral-500"
              >
                <Plus size={14} /> Add Project
              </div>
            </div>
          )}
        </div>
      </PageWidthWrapper>
    </>
  );
}
