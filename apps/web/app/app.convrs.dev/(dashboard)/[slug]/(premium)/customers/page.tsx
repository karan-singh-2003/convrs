"use client";

import { ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo } from "react";
import { useTable, Table } from "@repo/ui";
import useCustomers, { type CustomerItem } from "@/lib/swr/use-customers";
import { COUNTRIES } from "@repo/utils";
import { is } from "date-fns/locale";

type CustomerListItem = CustomerItem;

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

const formatAmount = (value: number) =>
  currencyFormatter.format((value || 0) / 100);

const formatDate = (value: string | null) => {
  if (!value) return "-";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "-" : dateFormatter.format(parsed);
};

export default function CustomersPage() {
  const params = useParams();
  const slug = params.slug as string;
  const router = useRouter();

  const { customers = [], loading: isLoading } = useCustomers({ limit: 200 });

  const columns = useMemo<ColumnDef<CustomerListItem>[]>(
    () => [
      {
        accessorKey: "customer",
        header: () => (
          <span className="font-display text-[13px] font-medium text-content-subtle">
            Customer
          </span>
        ),
        cell: ({ row }) => {
          const user = row.original;

          return (
            <div className="flex items-center gap-3">
              <img
                src={
                  user.avatar ||
                  `https://api.dicebear.com/9.x/glass/svg?seed=${encodeURIComponent(
                    user.name || user.email || user.id
                  )}`
                }
                alt={user.name || user.email || "Customer avatar"}
                className="h-7 w-7 rounded-full"
              />

              <div className="flex flex-col leading-tight">
                <Link
                  href={`/${slug}/customers/details?customerId=${encodeURIComponent(
                    user.id
                  )}`}
                  className="font-display text-sm font-medium text-content-emphasis transition-colors hover:text-content-default"
                >
                  {user.name || "Unnamed customer"}
                </Link>

                {user.email && (
                  <span className="text-xs text-content-subtle">
                    {user.email}
                  </span>
                )}
              </div>
            </div>
          );
        },
      },
      {
        accessorKey: "country",
        header: () => (
          <span className="font-display text-[13px] font-medium text-content-subtle">
            Country
          </span>
        ),
        cell: ({ row }) => {
          const country = row.original.country;

          const countryCode =
            Object.entries(COUNTRIES)
              .find(([, name]) => name === country)?.[0]
              ?.toLowerCase() || "unknown";

          return (
            <div className="flex items-center gap-2">
              <img
                src={`https://flagcdn.com/w20/${countryCode}.png`}
                alt={countryCode}
                width={20}
              />

              <span className="font-display text-sm font-medium text-content-default">
                {country || "-"}
              </span>
            </div>
          );
        },
      },
      {
        accessorKey: "ltv",
        header: () => (
          <span className="font-display text-[13px] font-medium text-content-subtle">
            LTV
          </span>
        ),
        cell: ({ row }) => (
          <span className="font-display text-sm font-medium text-content-default">
            {formatAmount(row.original.saleAmount)}
          </span>
        ),
      },
      {
        accessorKey: "sales",
        header: () => (
          <span className="font-display text-[13px] font-medium text-content-subtle">
            Sales
          </span>
        ),
        cell: ({ row }) => (
          <span className="font-display text-sm font-medium text-content-default">
            {row.original.sales}
          </span>
        ),
      },
      {
        accessorKey: "time",
        header: () => (
          <span className="font-display text-[13px] font-medium text-content-subtle">
            Time
          </span>
        ),
        cell: ({ row }) => (
          <span className="font-display text-sm font-medium text-content-default">
            {formatDate(row.original.createdAt)}
          </span>
        ),
      },
    ],
    [slug]
  );
  const { table, ...tableProps } = useTable<CustomerListItem>({
    data: customers,
    columns,
    loading: isLoading,
    error: undefined,
    onRowClick: (row) => {
      const customer = row.original;
      router.push(
        `/${slug}/customers/details?customerId=${encodeURIComponent(
          customer.id
        )}`
      );
    },
  });

  useEffect(() => {
    table.setPageSize(Math.max(customers.length, 5));
  }, [customers.length, table]);

  return (
    <div className="space-y-6 max-w-screen-lg mx-auto  sm:px-0">
      {isLoading && (
        <div className="w-full h-[300px] bg-bg-card animate-pulse rounded-2xl" />
      )}
      <div className=" bg-bg-card rounded-2xl overflow-x-auto">
        <Table
          table={table}
          {...tableProps}
          className="bg-bg-card rounded-2xl min-w-[760px]"
        />
      </div>
    </div>
  );
}
