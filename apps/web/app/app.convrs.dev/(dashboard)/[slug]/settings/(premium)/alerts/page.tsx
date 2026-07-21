"use client";

import useAlerts from "@/lib/swr/use-alerts";
import { AlertProps } from "@/lib/types";
import { PageWidthWrapper } from "@/ui/layout/page-width-wrapper";
import { useAddEditAlertModal } from "@/ui/modals/add-edit-alert-modal";
import SettingsChildrenLayout from "@/ui/workspaces/SettingsChildrentLayout";
import { Button, Popover, Table, useTable } from "@repo/ui";
import { formatDate } from "@repo/utils";
import { ColumnDef } from "@tanstack/react-table";
import { MoreHorizontal } from "lucide-react";
import { useMemo, useState } from "react";
import { useParams } from "next/navigation";

export default function AlersSettingsPage() {
  const { alerts, loading, mutate } = useAlerts();
  const [selectedAlert, setSelectedAlert] = useState<AlertProps | undefined>();

  const { setShowAddEditAlertModal, AddEditAlertModal } =
    useAddEditAlertModal({
      alert: selectedAlert,
      setSelectedAlert,
    });

  const columns = useMemo<ColumnDef<AlertProps>[]>(
    () => [
      {
        accessorKey: "name",
        header: () => (
          <span className="text-xs font-medium text-content-subtle">
            Name
          </span>
        ),
        cell: ({ row }) => (
          <span className="text-[13.5px] font-display font-medium text-content-default">
            {row.original.name}
          </span>
        ),
      },
      {
        accessorKey: "trigger",
        header: () => (
          <span className="text-xs font-medium text-content-subtle">
            Trigger
          </span>
        ),
        cell: ({ row }) => (
          <code className="rounded-md border border-border-subtle bg-bg-subtle px-2 py-1.5 font-mono text-[12px] text-content-default">
            {row.original.trigger}
          </code>
        ),
      },
      {
        accessorKey: "subject",
        header: () => (
          <span className="text-xs font-medium text-content-subtle">
            Subject
          </span>
        ),
        cell: ({ row }) => (
          <span className="line-clamp-1 text-sm font-display text-content-default">
            {row.original.subject}
          </span>
        ),
      },
      {
        accessorKey: "updatedAt",
        header: () => (
          <span className="text-xs font-medium text-content-subtle">
            Updated
          </span>
        ),
        cell: ({ row }) => (
          <span className="text-sm font-display text-content-default">
            {formatDate(row.original.updatedAt, {
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
        cell: ({ row }) => (
          <AlertRowMenu
            alert={row.original}
            onDeleted={() => mutate()}
            onEdit={(alert) => {
              setSelectedAlert(alert);
              setShowAddEditAlertModal(true);
            }}
          />
        ),
      },
    ],
    [mutate, setShowAddEditAlertModal]
  );

  const { table, ...tableProps } = useTable<AlertProps>({
    data: alerts,
    columns,
    loading,
    error: undefined,
    onRowClick: (row) => {
      setSelectedAlert(row.original);
      setShowAddEditAlertModal(true);
    },
  });

  return (
    <>
      <AddEditAlertModal />

      <PageWidthWrapper>
        <SettingsChildrenLayout
          title="Alerts"
          description="Get notified of important events and updates with customizable alerts."
          actions={
            <Button
              text="Add Alert"
              className="h-fit w-fit rounded-full border-border-subtle bg-bg-subtle px-3 py-1 text-[12.5px] font-display text-content-default transition-colors hover:bg-bg-emphasis"
              onClick={() => {
                setSelectedAlert(undefined);
                setShowAddEditAlertModal(true);
              }}
            />
          }
        >
          <Table table={table} {...tableProps} />

          <h1 className="p-2 font-display text-[13px] font-medium text-content-subtle">
            {alerts.length}/10 alerts used
          </h1>
        </SettingsChildrenLayout>
      </PageWidthWrapper>
    </>
  );
}

function AlertRowMenu({
  alert,
  onDeleted,
  onEdit,
}: {
  alert: AlertProps;
  onDeleted: () => void;
  onEdit: (alert: AlertProps) => void;
}) {
  const { slug } = useParams() as { slug?: string };
  const [isOpen, setIsOpen] = useState(false);

  const handleDelete = async () => {
    if (!slug) return;

    const res = await fetch(`/api/workspaces/${slug}/alerts/${alert.id}`, {
      method: "DELETE",
    });

    if (res.ok) {
      onDeleted();
    }

    setIsOpen(false);
  };

  return (
    <Popover
      openPopover={isOpen}
      setOpenPopover={setIsOpen}
      align="end"
      content={
        <div className="w-44 rounded-xl border border-border-subtle bg-bg-card p-1 shadow-lg">
          <Button
            className="w-full justify-start rounded-lg bg-transparent text-[13px] font-default text-content-default hover:bg-bg-subtle"
            onClick={() => {
              onEdit(alert);
              setIsOpen(false);
            }}
            text="Edit Alert"
          />

          <Button
            className="w-full justify-start rounded-lg bg-transparent text-[13px] font-default text-red-600 hover:bg-red-50"
            onClick={handleDelete}
            text="Delete Alert"
          />
        </div>
      }
    >
      <Button
        type="button"
        variant="outline"
        className="h-8 whitespace-nowrap rounded-lg border border-border-subtle bg-bg-card px-2 transition-colors hover:bg-bg-subtle disabled:border-transparent disabled:bg-transparent"
        icon={<MoreHorizontal className="h-4 w-4 shrink-0 text-content-subtle" />}
      />
    </Popover>
  );
}