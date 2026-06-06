"use client";

import type { ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { VisibilityState } from "@tanstack/react-table";

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
      className={`flex items-${hasFilters ? "end" : "center"} gap-3 border-b border-slate-200 bg-white px-4 py-3`}
    >
      {filterContent}
      <div className="ml-auto flex min-h-9 items-center gap-3">
        {countText != null ? (
          <p className="min-w-28 text-sm text-slate-500">{countText}</p>
        ) : null}
        {hasActiveFilters && onClearFilters ? (
          <button
            className="min-h-9 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2"
            type="button"
            onClick={onClearFilters}
          >
            {clearFiltersLabel}
          </button>
        ) : null}
        <div ref={columnsMenuRef} className="relative">
          <button
            className="min-h-9 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2"
            type="button"
            onClick={() => setIsColumnsMenuOpen((current) => !current)}
          >
            {configureListLabel}
          </button>
          {isColumnsMenuOpen ? (
            <div
              aria-label={visibleColumnsLabel}
              className="absolute right-0 z-20 mt-2 min-w-64 rounded-md border border-slate-200 bg-white p-2 shadow-lg"
              role="menu"
            >
              <p className="px-2 py-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
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
                    <div className="my-2 border-t border-slate-200" />
                    <p className="px-2 py-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
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
    <label className="inline-flex min-h-8 items-center gap-2 rounded px-2 text-sm text-slate-700 hover:bg-slate-50">
      <input
        checked={columnVisibility[column.id] !== false}
        type="checkbox"
        onChange={(event) => setColumnVisible(column.id, event.currentTarget.checked)}
      />
      <span>{column.label}</span>
    </label>
  );
}
