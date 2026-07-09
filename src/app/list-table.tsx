"use client";

import { useCallback, useRef, useState } from "react";
import { flexRender, type Table } from "@tanstack/react-table";

import type { ListColumnDefinition } from "@/app/list-table-config";
import { InfiniteListViewport } from "@/app/infinite-list";
import {
  ListTableHeaderCell,
  useColumnDragReorder,
  useColumnResizeCursor
} from "@/app/list-page-toolbar";

export type ListTableProps<TData> = {
  table: Table<TData>;
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
  onRowClick?: (row: TData) => void;
  /** Returns extra CSS classes for the row (e.g. "bg-[var(--color-bg-muted)]" for selected rows). */
  getRowHighlightClass?: (row: TData) => string;
  /** Pass to enable column drag-reorder. */
  setColumnOrder?: (updater: (order: string[]) => string[]) => void;
};

export function ListTable<TData extends { id: string }>({
  table,
  columnDefs,
  setColumnSorting,
  setColumnWidth,
  hasNextPage,
  isFetchingNextPage,
  isInitialLoading,
  isError,
  isEmpty,
  loadMore,
  loadingLabel,
  loadingMoreLabel,
  emptyState,
  errorState,
  testId,
  onRowClick,
  getRowHighlightClass,
  setColumnOrder
}: ListTableProps<TData>) {
  const [hoveredRowId, setHoveredRowId] = useState<string | null>(null);
  const [activeRowIndex, setActiveRowIndex] = useState<number | null>(null);
  const rowRefsMap = useRef<Map<string, HTMLTableRowElement>>(new Map());
  const { isResizingColumn, setIsResizingColumn, containerClassName } =
    useColumnResizeCursor();
  const { draggedColumnId, onDragEnd, onStartDrag, onDropOnto } =
    useColumnDragReorder(setColumnOrder ?? (() => {}));

  const handleTbodyKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (!onRowClick) return;
      const rows = table.getRowModel().rows;
      if (rows.length === 0) return;

      const key = event.key;
      if (!["ArrowUp", "ArrowDown", "Home", "End"].includes(key)) return;

      event.preventDefault();

      const current = activeRowIndex ?? 0;
      let nextIndex: number;

      if (key === "ArrowDown") {
        nextIndex = Math.min(current + 1, rows.length - 1);
        if (nextIndex === rows.length - 1 && hasNextPage && !isFetchingNextPage) {
          loadMore();
        }
      } else if (key === "ArrowUp") {
        nextIndex = Math.max(current - 1, 0);
      } else if (key === "Home") {
        nextIndex = 0;
      } else {
        nextIndex = rows.length - 1;
        if (hasNextPage && !isFetchingNextPage) {
          loadMore();
        }
      }

      const targetRow = rows[nextIndex];
      if (targetRow) {
        setActiveRowIndex(nextIndex);
        rowRefsMap.current.get(targetRow.original.id)?.focus();
      }
    },
    [activeRowIndex, table, onRowClick, hasNextPage, isFetchingNextPage, loadMore]
  );

  return (
    <div className={["flex min-h-0 flex-1 flex-col", containerClassName].filter(Boolean).join(" ")}>
      <InfiniteListViewport
        emptyState={emptyState}
        errorState={errorState}
        hasNextPage={hasNextPage}
        isEmpty={isEmpty}
        isError={isError}
        isInitialLoading={isInitialLoading}
        isFetchingNextPage={isFetchingNextPage}
        loadingLabel={loadingLabel}
        loadingMoreLabel={loadingMoreLabel}
        loadMore={loadMore}
        testId={testId}
      >
        <table
          className="table-fixed border-separate border-spacing-0 text-left text-sm"
          style={{ width: table.getTotalSize() }}
        >
          <colgroup>
            {table.getVisibleLeafColumns().map((column) => (
              <col key={column.id} style={{ width: column.getSize() }} />
            ))}
          </colgroup>
          <thead className="sticky top-0 z-10 bg-[var(--color-bg-subtle)]">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <ListTableHeaderCell
                    key={header.id}
                    columnDefs={columnDefs}
                    className={
                      header.column.id === "actions"
                        ? "sticky right-0 z-20 bg-[var(--color-bg-subtle)]"
                        : undefined
                    }
                    draggedColumnId={draggedColumnId}
                    header={header}
                    isResizingColumn={isResizingColumn}
                    setColumnSorting={setColumnSorting}
                    setColumnWidth={setColumnWidth}
                    setIsResizingColumn={setIsResizingColumn}
                    onDragEnd={setColumnOrder ? onDragEnd : undefined}
                    onDropOnto={setColumnOrder ? onDropOnto : undefined}
                    onStartDrag={setColumnOrder ? onStartDrag : undefined}
                  />
                ))}
              </tr>
            ))}
          </thead>
          <tbody className="bg-[var(--color-bg-elevated)]" onKeyDown={handleTbodyKeyDown}>
            {table.getRowModel().rows.map((row, rowIndex) => {
              const rowData = row.original;
              const highlightClass = getRowHighlightClass?.(rowData) ?? "";
              const isHovered = hoveredRowId === rowData.id;
              const isKeyboardActive = activeRowIndex === rowIndex;
              const rowClass = highlightClass || (isHovered ? "bg-[var(--color-bg-subtle)]" : "");

              return (
                <tr
                  key={row.id}
                  ref={(el) => {
                    if (el) rowRefsMap.current.set(rowData.id, el);
                    else rowRefsMap.current.delete(rowData.id);
                  }}
                  className={`group border-b border-[var(--color-border)] ${rowClass} ${onRowClick ? "cursor-pointer" : ""} ${isKeyboardActive ? "outline outline-2 outline-offset-[-2px] outline-[var(--color-accent)]" : ""}`}
                  role={onRowClick ? "button" : undefined}
                  tabIndex={onRowClick ? 0 : undefined}
                  onClick={onRowClick ? () => onRowClick(rowData) : undefined}
                  onFocus={
                    onRowClick
                      ? () => setActiveRowIndex(rowIndex)
                      : undefined
                  }
                  onMouseEnter={() => setHoveredRowId(rowData.id)}
                  onMouseLeave={() =>
                    setHoveredRowId((current) =>
                      current === rowData.id ? null : current
                    )
                  }
                  onKeyDown={
                    onRowClick
                      ? (event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            onRowClick(rowData);
                          }
                        }
                      : undefined
                  }
                >
                  {row.getVisibleCells().map((cell) => {
                    const isActionsCell = cell.column.id === "actions";
                    const actionsBackground = isActionsCell
                      ? highlightClass || (isHovered ? "bg-[var(--color-bg-subtle)]" : "bg-[var(--color-bg-elevated)]")
                      : "";

                    return (
                      <td
                        key={cell.id}
                        className={`overflow-hidden border-b border-[var(--color-border)] px-2 py-2 text-[var(--color-text-secondary)] ${
                          isActionsCell
                            ? `sticky right-0 z-10 px-1 py-1.5 ${actionsBackground}`
                            : ""
                        }`}
                        style={{ width: cell.column.getSize() }}
                      >
                        <div className="overflow-hidden text-ellipsis">
                          {flexRender(
                            cell.column.columnDef.cell,
                            cell.getContext()
                          )}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </InfiniteListViewport>
    </div>
  );
}
