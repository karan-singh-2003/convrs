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
import { useEffect, useMemo } from "react";
import { Button } from "../button";

export function useTable<T>(
  props: UseTableProps<T>
): TableProps<T> & { table: TableType<T> } {
  const { data, columns, getRowId, pageSize } = props;

  const table = useReactTable({
    data,
    columns,
    initialState: {
      pagination: {
        pageIndex: 0,
        pageSize: pageSize ?? 5,
      },
    },
    getRowId,
    getPaginationRowModel: getPaginationRowModel(),
    getCoreRowModel: getCoreRowModel(),
  });

  useEffect(() => {
    if (typeof pageSize === "number" && Number.isFinite(pageSize)) {
      table.setPageSize(pageSize);
    }
  }, [pageSize, table]);

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

  const visibleColumns = table.getVisibleLeafColumns();
  const skeletonRowCount = table.getState().pagination.pageSize || 5;
  const showSkeleton = loading && !hasData;

  return (
    <div className={cn("relative rounded-none  ", className)}>
      {/* TABLE */}
      {hasData ? (
        <div className="overflow-x-auto  rounded-xl ">
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
                      className="px-5 py-3 text-left rounded-none text-[12.5px] font-display font-medium text-content-subtle border-b border-border-subtle"
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
              {rows.map((row, index) => {
                const isLastRow = index === rows.length - 1;

                return (
                  <tr
                    key={row.id}
                    onClick={onRowClick ? (e) => onRowClick(row, e) : undefined}
                    className={cn(
                      "group transition-colors",
                      hasMultipleRows &&
                        !isLastRow &&
                        "border-b border-border-subtle",
                      onRowClick && "cursor-pointer hover:bg-bg-subtle/60"
                    )}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td
                        key={cell.id}
                        className={cn(
                          "px-5 py-2.5 font-default text-content-default align-middle",
                          hasMultipleRows &&
                            !isLastRow &&
                            "border-b border-border-subtle"
                        )}
                      >
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext()
                        )}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : showSkeleton ? (
        <div className="overflow-x-auto rounded-xl">
          <table
            className="w-full border-separate border-spacing-0 text-sm"
            style={{ minWidth: tableWidth }}
          >
            <thead>
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <th
                      key={header.id}
                      className="px-5 py-3 text-left text-[12.5px] font-display font-medium text-content-subtle border-b border-border-subtle"
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
            <tbody>
              {Array.from({ length: skeletonRowCount }).map((_, rowIndex) => (
                <tr key={rowIndex}>
                  {visibleColumns.map((column, colIndex) => (
                    <td
                      key={column.id}
                      className={cn(
                        "px-5 py-3 align-middle",
                        rowIndex !== skeletonRowCount - 1 &&
                          "border-b border-border-subtle"
                      )}
                    >
                      <div
                        className="h-3.5 animate-pulse rounded bg-bg-emphasis"
                        style={{
                          width: `${colIndex === 0 ? 55 : 35 + ((colIndex * 17) % 40)}%`,
                        }}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        !loading && (
          <div className="flex flex-col bg-bg-card  items-center font-display justify-center py-16 text-center">
            {emptyState || (
              <>
                <p className="text-sm font-medium font-display text-content-default">
                  No data available
                </p>
                <p className="text-[13px] font-display font-medium text-content-subtle mt-1">
                  When data is available, it will appear here.
                </p>
              </>
            )}
          </div>
        )
      )}

      {table.getPageCount() > 1 && hasData && (
        <div className="flex items-center border-t border-border-subtle justify-between px-5 py-1 text-sm">
          <div></div>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              text="Previous"
              className="h-8 px-3 font-display rounded-full text-[12px] text-content-subtle"
              onClick={() => table.previousPage()}
              disabled={table.getState().pagination.pageIndex === 0}
            ></Button>
            <Button
              variant="secondary"
              text="Next"
              className="h-8 px-3 font-display rounded-full text-[12px] text-content-subtle"
              onClick={() => table.nextPage()}
              disabled={
                table.getState().pagination.pageIndex ===
                table.getPageCount() - 1
              }
            ></Button>
          </div>
        </div>
      )}

      {/* LOADING OVERLAY (only while refreshing existing data) */}
      <AnimatePresence>
        {loading && hasData && (
          <motion.div
            className="absolute inset-0 flex items-start justify-center bg-bg-card/60 pt-16 backdrop-blur-sm"
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
              className="flex items-center gap-3 rounded-full border border-border-subtle bg-bg-card px-4 py-2 shadow-sm"
            >
              {/* Spinner */}
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-border-default border-t-content-emphasis" />
              <span className="font-display text-[12.5px] text-content-subtle">
                Loading…
              </span>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
