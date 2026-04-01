"use client";

import { ColumnDef } from "@tanstack/react-table";
import { useMemo } from "react";
import { useTable, Table } from "@repo/ui";

const customers = [
  {
    id: "1",
    name: "Gorgeous Wolf",
    email: "john.doe@example.com",
    country: "France",
    code: "FR",
    ltv: "$1000",
    time: "2024-06-01T12:00:00Z",
  },
  {
    id: "2",
    name: "Clever Fox",
    email: "janesmith@example.com",
    code: "US",
    country: "USA",
    ltv: "$500",
    time: "2024-06-01T12:00:00Z",
  },
];

export default function CustomersPage() {
  const isLoading = false;

  const columns = useMemo<ColumnDef<any>[]>(
    () => [
      {
        accessorKey: "customer",
        header: () => (
          <span className="text-[13px] font-medium font-display text-neutral-500">
            Customer
          </span>
        ),
        cell: ({ row }) => {
          const user = row.original;

          return (
            <div className="flex items-center gap-3">
              {/* Avatar */}
              <img
                src={`https://api.dicebear.com/9.x/glass/svg?seed=${encodeURIComponent(
                  user.name
                )}`}
                alt={user.name}
                className="h-7 w-7 rounded-full"
              />

              {/* Name */}
              <div className="flex flex-col leading-tight">
                <span className="text-sm font-medium font-display text-neutral-500">
                  {user.name}
                </span>
              </div>
            </div>
          );
        },
      },
      {
        accessorKey: "country",
        header: () => (
          <span className="text-[13px] font-medium font-display text-neutral-500">
            Country
          </span>
        ),
        cell: ({ row }) => (
          <div className="flex items-center gap-x-2">
            <img
              alt={row.original.code}
              src={`https://hatscripts.github.io/circle-flags/flags/${row.original.code.toLowerCase()}.svg`}
              className="size-4 shrink-0"
            />
            <span className="text-sm font-display font-medium text-neutral-500">
              {row.original.country}
            </span>
          </div>
        ),
      },
      {
        accessorKey: "ltv",
        header: () => (
          <span className="text-[13px] font-medium font-display text-neutral-500">
            LTV
          </span>
        ),
        cell: ({ row }) => (
          <span className="text-sm font-display font-medium text-neutral-500">
            {row.original.ltv}
          </span>
        ),
      },
      {
        accessorKey: "time",
        header: () => (
          <span className="text-[13px] font-medium font-display text-neutral-500">
            Time
          </span>
        ),
        cell: ({ row }) => {
          const formattedTime = new Date(row.original.time).toLocaleDateString(
            "en-GB",
            {
              day: "numeric",
              month: "short",
              year: "numeric",
            }
          );

          return (
            <span className="text-sm font-display font-medium text-neutral-500">
              {formattedTime}
            </span>
          );
        },
      },
    ],
    []
  );

  const { table, ...tableProps } = useTable<any>({
    data: customers,
    columns,
    loading: isLoading,
    error: undefined,
  });

  return (
    <div className="space-y-6 max-w-screen-lg mx-auto">
      <div className="bg-[#fafafa] border-none rounded-2xl">
        <Table
          table={table}
          {...tableProps}
          className="bg-[#FBFBFB] border-none rounded-2xl"
        />
      </div>
    </div>
  );
}
