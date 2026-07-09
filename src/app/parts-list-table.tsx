"use client";

import type { Table } from "@tanstack/react-table";

import type { PartsListItem } from "@/server/parts/getParts";
import type { ListColumnDefinition } from "@/app/list-table-config";
import { ListTable } from "@/app/list-table";

export type PartsListTableProps = {
  table: Table<PartsListItem>;
  columnDefs: ListColumnDefinition[];
  setColumnSorting: (id: string, dir: "asc" | "desc" | "none") => void;
  setColumnWidth: (id: string, width: number) => void;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  isInitialLoading: boolean;
  isError: boolean;
  isEmpty: boolean;
  loadMore: () => void;
  loadingLabel: string;
  loadingMoreLabel: string;
  emptyState: React.ReactNode;
  errorState?: React.ReactNode;
  testId?: string;
  onRowClick?: (part: PartsListItem) => void;
  /** Returns extra CSS classes for the row (e.g. "bg-slate-100" for selected rows). */
  getRowHighlightClass?: (part: PartsListItem) => string;
  setColumnOrder?: (updater: (order: string[]) => string[]) => void;
};

export function PartsListTable(props: PartsListTableProps) {
  const { onRowClick, getRowHighlightClass, ...rest } = props;
  return (
    <ListTable<PartsListItem>
      {...rest}
      onRowClick={onRowClick}
      getRowHighlightClass={getRowHighlightClass}
    />
  );
}
