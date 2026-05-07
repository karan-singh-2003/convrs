"use client";
import { ColumnDef } from "@tanstack/react-table";
import { Download } from "lucide-react";
import { useMemo } from "react";
import { Table, useTable } from "@repo/ui";
import useSWR from "swr";
import { fetcher } from "@repo/utils";
import useWorkspace from "@/lib/swr/use-workspace";

type InvoiceStatus = "paid" | "open" | "draft" | "uncollectible" | "void";

type StripeInvoice = {
  id: string;
  total: number;
  createdAt: number;
  status: InvoiceStatus | null;
  pdfUrl: string | null;
  description: string;
};

function formatDate(timestamp: number) {
  return new Date(timestamp * 1000).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatCurrency(amount: number) {
  return `$${(amount / 100).toFixed(2)}`;
}

function getInvoiceStatusStyles(status: InvoiceStatus) {
  switch (status) {
    case "paid":
      return "bg-[#ECFBEE] text-[#2AA830] ";
    case "open":
      return "bg-orange-50 text-orange-600 ";
    case "draft":
      return "bg-gray-50 text-gray-600 ";
    case "void":
    case "uncollectible":
      return "bg-red-50 text-red-600 ";
    default:
      return "bg-gray-50 text-gray-600 ";
  }
}

export default function Invoices() {
  const { slug } = useWorkspace();
  const {
    data: invoices,
    isLoading,
    error,
  } = useSWR<StripeInvoice[]>(
    `/api/workspaces/${slug}/billing/invoices`,
    fetcher,
    {
      suspense: true,
    }
  );

  const columns = useMemo<ColumnDef<StripeInvoice>[]>(
    () => [
      {
        accessorKey: "reference",
        header: () => (
          <span className="text-[13px] font-medium font-display text-neutral-500">
            Reference
          </span>
        ),
        cell: ({ row }) => (
          <span className="text-[14px] w-fit font-medium font-display text-gray-500">
            {row.original.id}
          </span>
        ),
      },
      {
        accessorKey: "amount",
        header: () => (
          <span className="text-[13px] font-medium font-display text-neutral-500">
            Total Amount
          </span>
        ),
        cell: ({ row }) => (
          <span className="text-[14px] w-fit font-medium font-display text-gray-500">
            {formatCurrency(row.original.total)}
          </span>
        ),
      },
      {
        accessorKey: "date",
        header: () => (
          <span className="text-[13px] font-medium font-display text-neutral-500">
            Date
          </span>
        ),
        cell: ({ row }) => (
          <span className="text-[14px] w-fit font-medium font-display text-gray-500">
            {formatDate(row.original.createdAt)}
          </span>
        ),
      },
      {
        id: "actions",
        header: () => null,
        cell: ({ row }) => (
          <div className="flex items-center justify-end mr-5 gap-x-1">
            <span
              className={`px-2.5 py-0.5 text-[14px]  font-display rounded-full ${getInvoiceStatusStyles(
                row.original.status || "draft"
              )}`}
            >
              {row.original.status
                ? row.original.status.charAt(0).toUpperCase() +
                  row.original.status.slice(1)
                : "Unknown"}
            </span>
            {row.original.pdfUrl && (
              <a
                href={row.original.pdfUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="p-1.5 rounded-md hover:bg-gray-100 transition text-gray-500 hover:text-gray-500"
              >
                <Download size={14} />
              </a>
            )}
          </div>
        ),
      },
    ],
    []
  );

  const { table, ...tableProps } = useTable<StripeInvoice>({
    data: invoices ?? [],
    columns,
    loading: isLoading,
    error: error ? "Failed to load invoices" : undefined,
  });

  return (
    <div>
      <Table table={table} {...tableProps} />
    </div>
  );
}
