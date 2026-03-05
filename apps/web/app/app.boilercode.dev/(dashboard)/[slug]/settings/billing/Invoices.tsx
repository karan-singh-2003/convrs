"use client";
import { ColumnDef } from "@tanstack/react-table";
import { Download } from "lucide-react";
import { useMemo } from "react";
import { Table, useTable } from "@repo/ui";
import useBilling, { BillingInvoice } from "@/lib/swr/use-billing";

type InvoiceStatus = "paid" | "open" | "draft" | "uncollectible" | "void";

type Invoice = {
  id: string;
  reference: string;
  amount: number;
  date: string;
  status: InvoiceStatus;
  invoicePdf: string | null;
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", {
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

function mapStripeInvoices(stripeInvoices: BillingInvoice[]): Invoice[] {
  return stripeInvoices.map((inv) => ({
    id: inv.id,
    reference: inv.number ?? inv.id,
    amount: inv.amountPaid,
    date: new Date(inv.created * 1000).toISOString(),
    status: (inv.status ?? "draft") as InvoiceStatus,
    invoicePdf: inv.invoicePdf,
  }));
}

export default function Invoices() {
  const { billing, loading, error } = useBilling();
  const invoices = useMemo(
    () => (billing?.invoices ? mapStripeInvoices(billing.invoices) : []),
    [billing?.invoices]
  );

  const columns = useMemo<ColumnDef<Invoice>[]>(
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
            {row.original.reference}
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
            {formatCurrency(row.original.amount)}
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
            {formatDate(row.original.date)}
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
                row.original.status
              )}`}
            >
              {row.original.status.charAt(0).toUpperCase() +
                row.original.status.slice(1)}
            </span>
            {row.original.invoicePdf && (
              <a
                href={row.original.invoicePdf}
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

  const { table, ...tableProps } = useTable<Invoice>({
    data: invoices,
    columns,
    loading,
    error: error ? "Failed to load invoices" : undefined,
  });

  return (
    <div>
      <Table table={table} {...tableProps} />
    </div>
  );
}
