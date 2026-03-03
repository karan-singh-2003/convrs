"use client";
import useWorkspace from "@/lib/swr/use-workspace";
import { fetcher, formatDate } from "@repo/utils";
import useSWR from "swr";
import { useAddEditTokenModal } from "@/ui/modals/add-edit-token-modal";
import { Button, Avatar, Popover, Table, useTable } from "@repo/ui";
import { TokenProps } from "@/lib/types";
import { MoreHorizontal } from "lucide-react";
import { useState, useMemo } from "react";
import { ColumnDef } from "@tanstack/react-table";
import SettingsChildrenLayout from "@/ui/workspaces/SettingsChildrentLayout";
import { PageWidthWrapper } from "@/ui/layout/page-width-wrapper";

export default function TokensPage() {
  const { id: workspaceId, role } = useWorkspace();
  const { setShowAddEditTokenModal, AddEditTokenModal } = useAddEditTokenModal(
    {}
  );
  const {
    data: tokens,
    isLoading,
    error,
  } = useSWR<TokenProps[]>(`/api/tokens?workspaceId=${workspaceId}`, fetcher);

  const columns = useMemo<ColumnDef<TokenProps>[]>(
    () => [
      {
        accessorKey: "name",
        header: () => (
          <span className="text-xs font-medium text-neutral-500">Name</span>
        ),
        cell: ({ row }) => {
          const token = row.original;
          return (
            <div className="flex items-center gap-3">
              <Avatar
                user={token.user}
                className="size-6 border-none duration-75 sm:size-8"
              />
              <div className="flex flex-col leading-tight">
                <span className="text-sm font-medium text-neutral-900">
                  {token.name}
                </span>
                <span className="text-xs text-neutral-500">
                  {token.user.name || "Unknown"}
                </span>
              </div>
            </div>
          );
        },
      },
      {
        accessorKey: "partialKey",
        header: () => (
          <span className="text-xs font-medium text-neutral-500">Key</span>
        ),
        cell: ({ row }) => (
          <code className="font-mono text-[12px] text-gray-600">
            {row.original.partialKey}
          </code>
        ),
      },
      {
        accessorKey: "scopes",
        header: () => (
          <span className="text-xs font-medium text-neutral-500">Scopes</span>
        ),
        cell: ({ row }) => {
          const scopes = row.original.scopes;
          return (
            <div className="flex flex-wrap gap-1">
              {scopes && scopes.length > 0 ? (
                scopes.map((scope) => (
                  <span
                    key={scope}
                    className="inline-flex items-center rounded-md bg-gray-50 px-2 py-1 text-xs font-medium text-gray-600 ring-1 ring-inset ring-gray-500/10"
                  >
                    {scope}
                  </span>
                ))
              ) : (
                <span className="text-[13px] text-muted-foreground">
                  No scopes
                </span>
              )}
            </div>
          );
        },
      },
      {
        accessorKey: "lastUsed",
        header: () => (
          <span className="text-xs font-medium text-neutral-500">
            Last Used
          </span>
        ),
        cell: ({ row }) => {
          const lastUsed = row.original.lastUsed;
          return (
            <span className="text-sm text-neutral-700">
              {lastUsed
                ? formatDate(lastUsed, {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })
                : "Never"}
            </span>
          );
        },
      },
      {
        accessorKey: "createdAt",
        header: () => (
          <span className="text-xs font-medium text-neutral-500">Created</span>
        ),
        cell: ({ row }) => (
          <span className="text-sm text-neutral-700">
            {formatDate(row.original.createdAt, {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </span>
        ),
      },
      {
        id: "actions",
        header: () => null,
        cell: ({ row }) => <TokenRowMenu token={row.original} />,
      },
    ],
    []
  );

  const { table, ...tableProps } = useTable<TokenProps>({
    data: tokens || [],
    columns,
    loading: isLoading,
    error: undefined,
  });

  return (
    <PageWidthWrapper size="md">
      <AddEditTokenModal />
      <SettingsChildrenLayout
        title="API Tokens"
        description="Manage API tokens for programmatic access to your workspace."
        // actions={
        //   <div className="flex items-center justify-between w-full">
        //     <div className="flex items-center gap-x-2">
        //       <Button
        //         variant="secondary"
        //         className="text-black/60  bg-[#f3f4f6] h-fit font-display rounded-full text-[12.5px] py-1"
        //         onClick={() => setShowAddEditTokenModal(true)}
        //       />
        //     </div>
        //   </div>
        // }
        className="my-4"
      >
        <Table table={table} {...tableProps} />
      </SettingsChildrenLayout>
    </PageWidthWrapper>
  );
}

function TokenRowMenu({ token }: { token: TokenProps }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Popover
      openPopover={isOpen}
      setOpenPopover={setIsOpen}
      content={
        <div className="w-fit">
          <Button
            className="w-full text-[13px] font-default justify-start text-white"
            onClick={() => {
              // TODO: Implement delete functionality
              setIsOpen(false);
            }}
            text="Delete Token"
          />
        </div>
      }
      align="end"
    >
      <Button
        type="button"
        className="h-8 whitespace-nowrap px-2 disabled:border-transparent disabled:bg-transparent"
        variant="outline"
        icon={<MoreHorizontal className="h-4 w-4 shrink-0" />}
      />
    </Popover>
  );
}
