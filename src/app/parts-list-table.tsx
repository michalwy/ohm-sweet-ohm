"use client";

import { useState } from "react";
import { flexRender, type Table } from "@tanstack/react-table";

import type { PartsListItem } from "@/server/parts/getParts";
import type { ListColumnDefinition } from "@/app/list-table-config";
import { InfiniteListViewport } from "@/app/infinite-list";
import {
  ListTableHeaderCell,
  useColumnDragReorder,
  useColumnResizeCursor
} from "@/app/list-page-toolbar";

type PartsListTableProps = {
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
  // Row interactions
  onRowClick?: (part: PartsListItem) => void;
  /** Returns extra CSS classes for the row (e.g. "bg-slate-100" for selected rows). */
  getRowHighlightClass?: (part: PartsListItem) => string;
  // Column drag/reorder — omit to disable
  setColumnOrder?: (updater: (order: string[]) => string[]) => void;
};

export function PartsListTable({
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
}: PartsListTableProps) {
  const [hoveredRowId, setHoveredRowId] = useState<string | null>(null);
  const { isResizingColumn, setIsResizingColumn, containerClassName } =
    useColumnResizeCursor();
  const { draggedColumnId, onDragEnd, onStartDrag, onDropOnto } =
    useColumnDragReorder(setColumnOrder ?? (() => {}));

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
          <tbody className="bg-[var(--color-bg-elevated)]">
            {table.getRowModel().rows.map((row) => {
              const part = row.original;
              const highlightClass = getRowHighlightClass?.(part) ?? "";
              const isHovered = hoveredRowId === part.id;
              const rowClass = highlightClass || (isHovered ? "bg-[var(--color-bg-subtle)]" : "");

              return (
                <tr
                  key={row.id}
                  className={`border-b border-[var(--color-border)] ${rowClass}`}
                  role={onRowClick ? "button" : undefined}
                  tabIndex={onRowClick ? 0 : undefined}
                  onClick={onRowClick ? () => onRowClick(part) : undefined}
                  onMouseEnter={() => setHoveredRowId(part.id)}
                  onMouseLeave={() =>
                    setHoveredRowId((current) =>
                      current === part.id ? null : current
                    )
                  }
                  onKeyDown={
                    onRowClick
                      ? (event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            onRowClick(part);
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
                            : cell.column.id.startsWith("attribute:") ||
                                cell.column.id === "valueDisplayValue"
                              ? "text-center"
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
