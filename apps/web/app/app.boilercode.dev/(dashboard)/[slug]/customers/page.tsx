"use client";

import { ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo } from "react";
import { useTable, Table } from "@repo/ui";
import useCustomers, { type CustomerItem } from "@/lib/swr/use-customers";

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
  const { customers, loading: isLoading } = useCustomers({ limit: 200 });

  const columns = useMemo<ColumnDef<CustomerListItem>[]>(
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
                src={
                  user.avatar ||
                  `https://api.dicebear.com/9.x/glass/svg?seed=${encodeURIComponent(
                    user.name || user.email || user.id
                  )}`
                }
                alt={user.name || user.email || "Customer avatar"}
                className="h-7 w-7 rounded-full"
              />

              {/* Name */}
              <div className="flex flex-col leading-tight">
                <Link
                  href={`/${slug}/customers/details?customerId=${encodeURIComponent(
                    user.id
                  )}`}
                  className="text-sm font-medium font-display text-neutral-500 hover:text-neutral-700"
                >
                  {user.name || "Unnamed customer"}
                </Link>
                {user.email ? (
                  <span className="text-xs text-neutral-400">{user.email}</span>
                ) : null}
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
            <span className="text-sm font-display font-medium text-neutral-500">
              {row.original.country || "-"}
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
            {formatAmount(row.original.saleAmount)}
          </span>
        ),
      },
      {
        accessorKey: "sales",
        header: () => (
          <span className="text-[13px] font-medium font-display text-neutral-500">
            Sales
          </span>
        ),
        cell: ({ row }) => (
          <span className="text-sm font-display font-medium text-neutral-500">
            {row.original.sales}
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
        cell: ({ row }) => (
          <span className="text-sm font-display font-medium text-neutral-500">
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
  });

  return (
    <div className="space-y-6 max-w-screen-lg mx-auto px-3 sm:px-0">
      <div className="hidden md:block bg-[#fafafa] border-none rounded-2xl overflow-x-auto">
        <Table
          table={table}
          {...tableProps}
          className="bg-[#FBFBFB] border-none rounded-2xl min-w-[760px]"
        />
      </div>

      <div className="md:hidden space-y-3">
        {isLoading ? (
          <div className="rounded-2xl bg-[#fafafa] p-4 text-sm text-neutral-400">
            Loading customers...
          </div>
        ) : customers.length === 0 ? (
          <div className="rounded-2xl bg-[#fafafa] p-4 text-sm text-neutral-400">
            No customers yet.
          </div>
        ) : (
          customers.map((customer) => (
            <Link
              key={customer.id}
              href={`/${slug}/customers/details?customerId=${encodeURIComponent(
                customer.id
              )}`}
              className="block rounded-2xl bg-[#fafafa] p-4"
            >
              <div className="flex items-center gap-3">
                <img
                  src={
                    customer.avatar ||
                    `https://api.dicebear.com/9.x/glass/svg?seed=${encodeURIComponent(
                      customer.name || customer.email || customer.id
                    )}`
                  }
                  alt={customer.name || customer.email || "Customer avatar"}
                  className="h-9 w-9 rounded-full"
                />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium font-display text-neutral-600">
                    {customer.name || "Unnamed customer"}
                  </p>
                  <p className="truncate text-xs text-neutral-400">
                    {customer.email || "No email"}
                  </p>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-xl bg-white p-2">
                  <p className="text-neutral-400">LTV</p>
                  <p className="font-medium text-neutral-600">
                    {formatAmount(customer.saleAmount)}
                  </p>
                </div>
                <div className="rounded-xl bg-white p-2">
                  <p className="text-neutral-400">Sales</p>
                  <p className="font-medium text-neutral-600">
                    {customer.sales}
                  </p>
                </div>
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
