import {
  getCoreRowModel,
  useReactTable,
  Table as TableType,
  getPaginationRowModel,
  flexRender,
} from "@tanstack/react-table";
import { TableProps, UseTableProps } from "./types";
import { AnimatePresence, motion } from "framer-motion";

import { cn } from "@repo/utils";
import { useMemo } from "react";
import { Button } from "../button";

export function useTable<T>(
  props: UseTableProps<T>
): TableProps<T> & { table: TableType<T> } {
  const { data, columns, getRowId } = props;

  const table = useReactTable({
    data,
    columns,
    initialState: {
      pagination: {
        pageIndex: 0,
        pageSize: 1,
      },
    },
    getRowId,
    getPaginationRowModel: getPaginationRowModel(),
    getCoreRowModel: getCoreRowModel(),
  });

  return {
    ...props,
    table,
  };
}

export function Table<T>({
  data,
  loading,
  error,
  emptyState,
  table,
  onRowClick,
  className,
}: TableProps<T>) {
  const hasData = !!data?.length && !error;

  const tableWidth = useMemo(() => {
    return table
      .getVisibleLeafColumns()
      .reduce((total, column) => total + (column.columnDef.size ?? 150), 0);
  }, [table]);
  const rows = table.getPaginationRowModel().rows;
  const hasMultipleRows = rows.length > 1;
  return (
    <div className={cn("relative rounded-none  ", className)}>
      {/* TABLE */}
      {hasData ? (
        <div className="overflow-x-auto ">
          <table
            className="w-full border-separate border-spacing-0 text-sm"
            style={{ minWidth: tableWidth }}
          >
            {/* HEADER */}
            <thead className="rounded-none">
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <th
                      key={header.id}
                      className="px-5 py-3 text-left rounded-none text-[12.5px] font-display font-medium text-[#ececed]/60 border-b border-border/40"
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>

            {/* BODY */}
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.id}
                  onClick={onRowClick ? (e) => onRowClick(row, e) : undefined}
                  className={cn(
                    "group transition-colors",
                    hasMultipleRows && "border-b border-border/40",
                    onRowClick && "cursor-pointer hover:bg-bg-surface/50"
                  )}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td
                      key={cell.id}
                      className={cn(
                        "px-5 py-2.5 font-default text-[#ececed]/80 align-middle",
                        hasMultipleRows && "border-b border-border/60"
                      )}
                    >
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        !loading && (
          <div className="flex flex-col items-center font-display justify-center py-16 text-center">
            {emptyState || (
              <>
                <p className="text-sm font-medium font-display text-neutral-700">
                  No data available
                </p>
                <p className="text-[13px] font-display font-medium text-neutral-500 mt-1">
                  When data is available, it will appear here.
                </p>
              </>
            )}
          </div>
        )
      )}

      {table.getPageCount() > 1 && hasData && (
        <div className="flex items-center justify-between px-5 py-1 text-sm">
          <div></div>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              className="h-8 px-3 text-[12px] text-neutral-700/80"
              onClick={() => table.previousPage()}
              disabled={table.getState().pagination.pageIndex === 0}
            >
              Previous
            </Button>
            <Button
              variant="secondary"
              className="h-8 px-3 text-[12px] text-neutral-700/80"
              onClick={() => table.nextPage()}
              disabled={
                table.getState().pagination.pageIndex ===
                table.getPageCount() - 1
              }
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {/* LOADING OVERLAY */}
      <AnimatePresence>
        {loading && (
          <motion.div
            className="absolute top-10 inset-0 flex items-center justify-center  backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <motion.div
              initial={{ scale: 0.96, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.96, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="flex items-center gap-3 rounded-full  px-4 py-2"
            >
              {/* Spinner */}
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-neutral-300 border-t-neutral-600" />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
