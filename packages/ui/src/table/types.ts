import {
  ColumnDef,
  PaginationState,
  Row,
  Table as TableType,
} from "@tanstack/react-table";
import { Dispatch, PropsWithChildren, ReactNode, SetStateAction } from "react";
import { MouseEvent } from "react";

type BaseTableProps<T> = {
  data: T[];
  columns: ColumnDef<T>[];
  loading?: boolean;
  error?: string;
  emptyState?: ReactNode;
  className?: string;
  getRowId?: (row: T) => string
  onRowClick?: (row: Row<T>, e: MouseEvent) => void;
};

export type UseTableProps<T> = BaseTableProps<T> & {
  pagination?: PaginationState;
  onPaginationChange?: Dispatch<SetStateAction<PaginationState>>;
};

export type TableProps<T> = BaseTableProps<T> &
  PropsWithChildren<{ table: TableType<T> }> & {
    pagination?: PaginationState;
  };
