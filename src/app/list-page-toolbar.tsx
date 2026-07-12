"use client";

import type { ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Header, VisibilityState } from "@tanstack/react-table";
import { flexRender } from "@tanstack/react-table";

import type { ListColumnDefinition } from "@/app/list-table-config";

export function useColumnResizeCursor() {
  const [isResizingColumn, setIsResizingColumn] = useState(false);

  useEffect(() => {
    if (!isResizingColumn) {
      return undefined;
    }

    function handlePointerUp() {
      setIsResizingColumn(false);
    }

    window.addEventListener("mouseup", handlePointerUp);
    window.addEventListener("touchend", handlePointerUp);

    return () => {
      window.removeEventListener("mouseup", handlePointerUp);
      window.removeEventListener("touchend", handlePointerUp);
    };
  }, [isResizingColumn]);

  const containerClassName = isResizingColumn ? "cursor-col-resize select-none" : "";
  return { isResizingColumn, setIsResizingColumn, containerClassName };
}

export function useColumnDragReorder(setColumnOrder: (updater: (order: string[]) => string[]) => void) {
  const [draggedColumnId, setDraggedColumnId] = useState<string | null>(null);

  function moveColumnByDrag(targetColumnId: string) {
    if (!draggedColumnId || draggedColumnId === targetColumnId) return;
    setColumnOrder((currentOrder) => {
      const sourceIndex = currentOrder.indexOf(draggedColumnId);
      const targetIndex = currentOrder.indexOf(targetColumnId);
      if (sourceIndex < 0 || targetIndex < 0) return currentOrder;
      const nextOrder = [...currentOrder];
      const [sourceItem] = nextOrder.splice(sourceIndex, 1);
      nextOrder.splice(targetIndex, 0, sourceItem);
      return nextOrder;
    });
  }

  return {
    draggedColumnId,
    onDragEnd: () => setDraggedColumnId(null),
    onStartDrag: (id: string) => setDraggedColumnId(id),
    onDropOnto: (id: string) => moveColumnByDrag(id),
  };
}

export type ColumnGroup = {
  groupId: string;
  label: string;
};

type ListPageToolbarProps = {
  filterContent?: ReactNode;
  totalCount?: number;
  filteredCount?: number;
  formatCount?: (visible: number, total: number) => string;
  hasActiveFilters?: boolean;
  onClearFilters?: () => void;
  clearFiltersLabel?: string;
  configurableColumns: ListColumnDefinition[];
  columnVisibility: VisibilityState;
  setColumnVisible: (id: string, visible: boolean) => void;
  configureListLabel: string;
  visibleColumnsLabel: string;
  columnGroups?: ColumnGroup[];
  configureFiltersLabel?: string;
  onConfigureFilters?: () => void;
  primaryAction: ReactNode;
};

export function ListPageToolbar({
  filterContent,
  totalCount,
  filteredCount,
  formatCount,
  hasActiveFilters,
  onClearFilters,
  clearFiltersLabel,
  configurableColumns,
  columnVisibility,
  setColumnVisible,
  configureListLabel,
  visibleColumnsLabel,
  columnGroups,
  configureFiltersLabel,
  onConfigureFilters,
  primaryAction
}: ListPageToolbarProps) {
  const [isColumnsMenuOpen, setIsColumnsMenuOpen] = useState(false);
  const columnsMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isColumnsMenuOpen) {
      return undefined;
    }

    function handlePointerDown(event: MouseEvent) {
      if (
        columnsMenuRef.current &&
        !columnsMenuRef.current.contains(event.target as Node)
      ) {
        setIsColumnsMenuOpen(false);
      }
    }

    window.addEventListener("mousedown", handlePointerDown);
    return () => window.removeEventListener("mousedown", handlePointerDown);
  }, [isColumnsMenuOpen]);

  const groupIds = useMemo(
    () => new Set(columnGroups?.map((g) => g.groupId) ?? []),
    [columnGroups]
  );

  const defaultColumns = useMemo(
    () => configurableColumns.filter((col) => !col.group || !groupIds.has(col.group)),
    [configurableColumns, groupIds]
  );

  const groupedColumns = useMemo(
    () =>
      (columnGroups ?? []).map((group) => ({
        group,
        columns: configurableColumns.filter((col) => col.group === group.groupId)
      })),
    [configurableColumns, columnGroups]
  );

  const hasCount = typeof totalCount === "number";
  const visibleCount = typeof filteredCount === "number" ? filteredCount : totalCount;
  const countText = hasCount
    ? formatCount
      ? formatCount(visibleCount ?? totalCount ?? 0, totalCount ?? 0)
      : visibleCount !== totalCount
        ? `${visibleCount} / ${totalCount}`
        : `${totalCount}`
    : null;

  const hasFilters = filterContent != null;

  return (
    <div
      className={`flex items-${hasFilters ? "end" : "center"} gap-3 border-b border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-4 py-3`}
    >
      {filterContent ? <div className="min-w-0 flex-1">{filterContent}</div> : null}
      <div className="ml-auto flex min-h-9 flex-shrink-0 items-center gap-3">
        {countText != null ? (
          <p className="min-w-28 text-sm text-[var(--color-text-muted)]">{countText}</p>
        ) : null}
        {clearFiltersLabel && onClearFilters ? (
          <button
            className="min-h-9 rounded-md border border-[var(--color-border-strong)] bg-[var(--color-bg-elevated)] px-3 py-1.5 text-sm font-medium text-[var(--color-text-secondary)] transition hover:border-[var(--color-border-hover)] hover:bg-[var(--color-bg-subtle)] focus:outline-none focus:ring-2 focus:ring-[var(--color-ring-strong)] focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-40"
            disabled={!hasActiveFilters}
            type="button"
            onClick={onClearFilters}
          >
            {clearFiltersLabel}
          </button>
        ) : null}
        {configureFiltersLabel && onConfigureFilters ? (
          <button
            className="min-h-9 rounded-md border border-[var(--color-border-strong)] bg-[var(--color-bg-elevated)] px-3 py-1.5 text-sm font-medium text-[var(--color-text-secondary)] transition hover:border-[var(--color-border-hover)] hover:bg-[var(--color-bg-subtle)] focus:outline-none focus:ring-2 focus:ring-[var(--color-ring-strong)] focus:ring-offset-2"
            type="button"
            onClick={onConfigureFilters}
          >
            {configureFiltersLabel}
          </button>
        ) : null}
        <div ref={columnsMenuRef} className="relative">
          <button
            className="min-h-9 rounded-md border border-[var(--color-border-strong)] bg-[var(--color-bg-elevated)] px-3 py-1.5 text-sm font-medium text-[var(--color-text-secondary)] transition hover:border-[var(--color-border-hover)] hover:bg-[var(--color-bg-subtle)] focus:outline-none focus:ring-2 focus:ring-[var(--color-ring-strong)] focus:ring-offset-2"
            type="button"
            onClick={() => setIsColumnsMenuOpen((current) => !current)}
          >
            {configureListLabel}
          </button>
          {isColumnsMenuOpen ? (
            <div
              aria-label={visibleColumnsLabel}
              className="absolute right-0 z-20 mt-2 min-w-64 rounded-md border border-[var(--color-border)] bg-[var(--color-bg-elevated)] p-2 shadow-lg"
              role="menu"
            >
              <p className="px-2 py-1 text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
                {visibleColumnsLabel}
              </p>
              <div className="grid gap-1">
                {defaultColumns.map((column) => (
                  <ColumnCheckbox
                    key={column.id}
                    column={column}
                    columnVisibility={columnVisibility}
                    setColumnVisible={setColumnVisible}
                  />
                ))}
              </div>
              {groupedColumns.map(({ group, columns }) =>
                columns.length > 0 ? (
                  <div key={group.groupId}>
                    <div className="my-2 border-t border-[var(--color-border)]" />
                    <p className="px-2 py-1 text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
                      {group.label}
                    </p>
                    <div className="grid max-h-56 gap-1 overflow-auto">
                      {columns.map((column) => (
                        <ColumnCheckbox
                          key={column.id}
                          column={column}
                          columnVisibility={columnVisibility}
                          setColumnVisible={setColumnVisible}
                        />
                      ))}
                    </div>
                  </div>
                ) : null
              )}
            </div>
          ) : null}
        </div>
        {primaryAction}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shared resizable / draggable table header cell
// ---------------------------------------------------------------------------

type ListTableHeaderCellProps = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  header: Header<any, any>;
  columnDefs: ListColumnDefinition[];
  isResizingColumn: boolean;
  setColumnSorting: (id: string, dir: "asc" | "desc" | "none") => void;
  setColumnWidth: (id: string, width: number) => void;
  setIsResizingColumn: (v: boolean) => void;
  /** Extra className appended to the <th> element (e.g. sticky positioning). */
  className?: string;
  // Drag-and-drop — omit to disable
  draggedColumnId?: string | null;
  onStartDrag?: (columnId: string) => void;
  onDropOnto?: (columnId: string) => void;
  onDragEnd?: () => void;
};

export function ListTableHeaderCell({
  header,
  columnDefs,
  isResizingColumn,
  setColumnSorting,
  setColumnWidth,
  setIsResizingColumn,
  className,
  draggedColumnId,
  onStartDrag,
  onDropOnto,
  onDragEnd
}: ListTableHeaderCellProps) {
  const columnId = header.column.id;
  const isActionsColumn = columnId === "actions";
  const colDef = columnDefs.find((c) => c.id === columnId);
  const align = colDef?.align ?? "left";

  const dragEnabled = !isActionsColumn && onStartDrag != null;
  const dropEnabled = !isActionsColumn && onDropOnto != null;

  const alignClass =
    align === "right" ? "text-right" : align === "center" ? "text-center" : "text-left";
  const flexJustify =
    align === "right" ? "justify-end" : align === "center" ? "justify-center" : "";

  return (
    <th
      key={header.id}
      draggable={dragEnabled && !isResizingColumn}
      className={`relative border-b border-[var(--color-border)] px-2 py-2.5 text-xs font-semibold text-[var(--color-text-secondary)] ${alignClass}${className ? ` ${className}` : ""}`}
      style={{ width: header.getSize() }}
      onDragStart={(e) => {
        if (!dragEnabled) return;
        if (isResizingColumn) { e.preventDefault(); return; }
        onStartDrag(columnId);
      }}
      onDragOver={(e) => {
        if (dropEnabled && draggedColumnId != null) e.preventDefault();
      }}
      onDrop={() => {
        if (dropEnabled) onDropOnto(columnId);
        onDragEnd?.();
      }}
      onDragEnd={() => onDragEnd?.()}
    >
      {!isActionsColumn && !header.isPlaceholder ? (
        <div className={`flex items-center gap-1 overflow-hidden ${flexJustify}`}>
          {colDef?.sortable ? (
            <button
              className="flex items-center gap-1 overflow-hidden text-left hover:text-[var(--color-text-primary)]"
              type="button"
              onClick={() => {
                const current = header.column.getIsSorted();
                if (!current) {
                  setColumnSorting(columnId, "asc");
                } else if (current === "asc") {
                  setColumnSorting(columnId, "desc");
                } else {
                  setColumnSorting(columnId, "none");
                }
              }}
            >
              <span>{flexRender(header.column.columnDef.header, header.getContext())}</span>
              {header.column.getIsSorted() ? (
                <span className="text-xs text-[var(--color-text-placeholder)]">
                  {header.column.getIsSorted() === "asc" ? "▲" : "▼"}
                </span>
              ) : null}
            </button>
          ) : (
            <span>{flexRender(header.column.columnDef.header, header.getContext())}</span>
          )}
        </div>
      ) : null}
      {header.column.getCanResize() ? (
        <div
          className={`absolute right-0 top-0 h-full w-3 cursor-col-resize select-none ${
            header.column.getIsResizing() ? "bg-[var(--color-bg-strong)]" : "bg-transparent"
          }`}
          onDoubleClick={() =>
            setColumnWidth(columnId, Number(colDef?.defaultWidth ?? 160))
          }
          onMouseDown={(e) => {
            e.stopPropagation();
            setIsResizingColumn(true);
            header.getResizeHandler()(e);
          }}
          onTouchStart={(e) => {
            e.stopPropagation();
            setIsResizingColumn(true);
            header.getResizeHandler()(e);
          }}
        >
          <div className="ml-auto h-full w-px bg-[var(--color-border-strong)]" />
        </div>
      ) : null}
    </th>
  );
}

function ColumnCheckbox({
  column,
  columnVisibility,
  setColumnVisible
}: {
  column: ListColumnDefinition;
  columnVisibility: VisibilityState;
  setColumnVisible: (id: string, visible: boolean) => void;
}) {
  return (
    <label className="inline-flex min-h-8 items-center gap-2 rounded px-2 text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-subtle)]">
      <input
        checked={columnVisibility[column.id] !== false}
        type="checkbox"
        onChange={(event) => setColumnVisible(column.id, event.currentTarget.checked)}
      />
      <span>{column.label}</span>
    </label>
  );
}
