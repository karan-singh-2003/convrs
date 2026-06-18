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

  const { setShowAddEditAlertModal, AddEditAlertModal } = useAddEditAlertModal({
    alert: selectedAlert,
    setSelectedAlert,
  });

  const columns = useMemo<ColumnDef<AlertProps>[]>(
    () => [
      {
        accessorKey: "name",
        header: () => (
          <span className="text-xs font-medium text-neutral-500">Name</span>
        ),
        cell: ({ row }) => (
          <span className="text-[13.5px] font-display font-medium text-neutral-600">
            {row.original.name}
          </span>
        ),
      },
      {
        accessorKey: "trigger",
        header: () => (
          <span className="text-xs font-medium text-neutral-500">Trigger</span>
        ),
        cell: ({ row }) => (
          <code className="font-mono bg-neutral-200/60 px-2 py-1.5 rounded-sm text-[12px] text-gray-600">
            {row.original.trigger}
          </code>
        ),
      },
      {
        accessorKey: "subject",
        header: () => (
          <span className="text-xs font-medium text-neutral-500">Subject</span>
        ),
        cell: ({ row }) => (
          <span className="text-sm font-display text-neutral-600 line-clamp-1">
            {row.original.subject}
          </span>
        ),
      },
      {
        accessorKey: "updatedAt",
        header: () => (
          <span className="text-xs font-medium text-neutral-500">Updated</span>
        ),
        cell: ({ row }) => (
          <span className="text-sm font-display text-neutral-600">
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
          description="Get Notified of important events and updates with our customizable alert system."
          actions={
            <Button
              text="Add Alert"
              className="text-black/60 w-fit  bg-[#f3f4f6] h-fit font-display rounded-full text-[12.5px] py-1"
              onClick={() => {
                setSelectedAlert(undefined);
                setShowAddEditAlertModal(true);
              }}
            />
          }
        >
          <Table table={table} {...tableProps} />
          <h1 className="font-display p-2 font-medium text-[13px] text-neutral-500">
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
      content={
        <div className="w-fit">
          <Button
            className="w-full text-[13px] font-default justify-start"
            onClick={() => {
              onEdit(alert);
              setIsOpen(false);
            }}
            text="Edit Alert"
          />
          <Button
            className="w-full text-[13px] font-default justify-start text-white"
            onClick={handleDelete}
            text="Delete Alert"
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
