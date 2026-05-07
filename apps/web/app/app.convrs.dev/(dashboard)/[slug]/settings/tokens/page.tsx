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
import { RESOURCE_SCOPES, Scope } from "@/lib/api/tokens/scopes";
import { useTokenCreatedModal } from "@/ui/modals/token-created-modal";
export default function TokensPage() {
  const { id: workspaceId, role } = useWorkspace();

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
              <div className="flex flex-col leading-tight">
                <span className="text-[13.5px] font-display font-medium text-neutral-600">
                  {token.name}
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
          <code className="font-mono bg-neutral-200/60 px-2 py-1.5 rounded-sm text-[12px] text-gray-600">
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
                    className="text-[13px] font-display text-neutral-600 text-muted-foreground"
                  >
                    {scope}
                  </span>
                ))
              ) : (
                <span className="text-[13px] font-display text-neutral-600">
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
            <span className="text-sm font-display text-neutral-600">
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
          <span className="text-sm font-display text-neutral-600">
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
  const [selectedToken, setSelectedToken] = useState<TokenProps | undefined>();
  const [createdToken, setCreatedToken] = useState<string | undefined>();

  const onTokenCreated = (token: string) => {
    setCreatedToken(token);
    setShowTokenCreatedModal(true);
  };
  const { setShowAddEditTokenModal, AddEditTokenModal } = useAddEditTokenModal({
    ...(selectedToken && {
      token: {
        id: selectedToken.id,
        name: selectedToken.name,
        scopes: mapScopesToResource(selectedToken.scopes || []),
        isMachine: false,
      },
    }),
    ...(!selectedToken && { onTokenCreated }),
    setSelectedToken,
  });
  const { setShowTokenCreatedModal, TokenCreatedModal } = useTokenCreatedModal({
    token: createdToken || "",
  });

  const { table, ...tableProps } = useTable<TokenProps>({
    data: tokens || [],
    columns,
    loading: isLoading,
    error: undefined,
    onRowClick: (row) => {
      setSelectedToken(row.original);
      setShowAddEditTokenModal(true);
    },
  });

  return (
    <PageWidthWrapper size="lg">
      <AddEditTokenModal />
      <TokenCreatedModal />
      <SettingsChildrenLayout
        title="API Tokens"
        description="Manage API tokens for programmatic access to your workspace."
        actions={
          <Button
            text="Add Token"
            className="text-black/60  bg-[#f3f4f6] h-fit font-display rounded-full text-[12.5px] py-1"
            onClick={() => setShowAddEditTokenModal(true)}
          />
        }
        className="px-3 lg:px-8"
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

const mapScopesToResource = (scopes: string[]): { [key: string]: Scope } => {
  return scopes.reduce(
    (acc, scope) => {
      const resourceScope = RESOURCE_SCOPES.find((rs) =>
        rs.scope.includes(scope as Scope)
      );
      if (resourceScope?.resource) {
        acc[resourceScope.resource] = scope as Scope;
      } else {
        // Global preset scopes (apis.all, apis.read) have no resource key —
        // store them under "api" to match the modal's preset convention.
        acc["api"] = scope as Scope;
      }
      return acc;
    },
    {} as { [key: string]: Scope }
  );
};
