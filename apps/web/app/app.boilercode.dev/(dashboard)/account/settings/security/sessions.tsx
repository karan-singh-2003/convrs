"use client";

import { useSessions } from "@/lib/swr/use-sessions";
import { Button, Table, useTable } from "@repo/ui";
import { ColumnDef } from "@tanstack/react-table";
import { useMemo, useState } from "react";
import { toast } from "sonner";

type Session = {
  id: string;
  deviceType: string | null;
  deviceName: string | null;
  lastActive: string;
  location: string | null;
  ipAddress: string | null;
  isCurrent: boolean;
};

function DeviceIcon({ deviceType }: { deviceType: string | null }) {
  switch (deviceType) {
    case "desktop":
      return (
        <svg viewBox="0 0 20 20" className="size-5">
          <path d="M4.5 4.125A2.125 2.125 0 0 0 2.375 6.25v8.25H.5v.75a1 1 0 0 0 1 1h17a1 1 0 0 0 1-1v-.75h-1.875V6.25A2.125 2.125 0 0 0 15.5 4.125zM16.375 14.5H3.625V6.25c0-.483.392-.875.875-.875h11c.483 0 .875.392.875.875z" />
        </svg>
      );

    default:
      return (
        <svg viewBox="0 0 20 20" className="size-5">
          <path d="M7.309 6.71c.22-.88 1.251-1.68 2.656-1.68 1.635 0 2.708 1.036 2.708 2.047 0 .603-.368 1.203-1.048 1.617l-.014.008-1.242.849-.003.002c-.805.556-1.31 1.45-1.31 2.417a.625.625 0 0 0 1.25 0c0-.522.275-1.046.769-1.388l1.215-.83c.944-.58 1.633-1.536 1.633-2.675 0-1.945-1.905-3.297-3.958-3.297-1.812 0-3.474 1.044-3.869 2.625a.625.625 0 1 0 1.213.303m3.435 8.351a1 1 0 1 1-2 0 1 1 0 0 1 2 0" />
        </svg>
      );
  }
}

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function Sessions() {
  const [page, setPage] = useState(1);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  const { sessions, total, totalPages, loading, mutate } = useSessions(page);

  async function revokeSession(sessionId: string) {
    setRevokingId(sessionId);

    try {
      const response = await fetch("/api/account/sessions", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to revoke session");
      }

      toast.success("Session logged out successfully");
      mutate();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to revoke session"
      );
    } finally {
      setRevokingId(null);
    }
  }

  const columns = useMemo<ColumnDef<Session>[]>(
    () => [
      {
        accessorKey: "deviceName",
        header: () => (
          <span className="text-[13px] font-medium text-neutral-500">
            Device
          </span>
        ),
        cell: ({ row }) => {
          const session = row.original;

          return (
            <div className="flex items-center gap-3">
              <DeviceIcon deviceType={session.deviceType} />

              <span className="text-sm text-neutral-700">
                {session.deviceName || "Unknown Device"}
              </span>

              {session.isCurrent && (
                <span className="rounded-full bg-amber-100 px-2 py-[1px] text-[10.5px] font-medium text-amber-700">
                  This Device
                </span>
              )}
            </div>
          );
        },
      },
      {
        accessorKey: "lastActive",
        header: () => (
          <span className="text-[13px] font-medium text-neutral-500">
            Last Active
          </span>
        ),
        cell: ({ row }) => (
          <span className="text-sm text-neutral-600">
            {formatDate(row.original.lastActive)}
          </span>
        ),
      },
      {
        accessorKey: "location",
        header: () => (
          <span className="text-[13px] font-medium text-neutral-500">
            Location
          </span>
        ),
        cell: ({ row }) => {
          const session = row.original;

          return (
            <span className="text-sm text-neutral-600">
              {session.location || session.ipAddress || "Unknown"}
            </span>
          );
        },
      },
      {
        id: "actions",
        header: () => null,
        cell: ({ row }) => {
          const session = row.original;

          return (
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => revokeSession(session.id)}
                disabled={revokingId === session.id || session.isCurrent}
                className="text-sm text-neutral-500 hover:text-neutral-800 disabled:opacity-50 transition-colors"
              >
                {session.isCurrent ? "..." : "Log out"}
              </button>
            </div>
          );
        },
      },
    ],
    [revokingId]
  );

  const { table, ...tableProps } = useTable<Session>({
    data: sessions || [],
    columns,
    loading,
    error: undefined,
  });

  return <Table table={table} {...tableProps} />;
}