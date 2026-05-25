"use client";

import type { Dispatch, RefObject, SetStateAction } from "react";
import { useEffect, useLayoutEffect, useMemo, useState } from "react";
import type {
  ColumnOrderState,
  ColumnSizingState,
  SortingState,
  VisibilityState
} from "@tanstack/react-table";

import { DialogBody, DialogFooter, DialogShell } from "@/app/dialog-shell";

export type ListColumnId = string;

export type ListColumnDefinition = {
  id: ListColumnId;
  label: string;
  group?: "base" | "attribute";
  defaultVisible?: boolean;
  defaultWidth?: number;
  minWidth?: number;
  maxWidth?: number;
  sortable?: boolean;
};

type StoredListConfiguration = {
  columnVisibility: VisibilityState;
  columnOrder: ColumnOrderState;
  sorting: SortingState;
  columnSizing: ColumnSizingState;
};

type UseListTableConfigurationInput = {
  storageKey: string;
  columns: ListColumnDefinition[];
  fixedColumnIds?: ListColumnId[];
};

export type UseListTableConfigurationResult = {
  columnVisibility: VisibilityState;
  columnOrder: ColumnOrderState;
  sorting: SortingState;
  columnSizing: ColumnSizingState;
  configurableColumns: ListColumnDefinition[];
  setColumnVisible: (columnId: ListColumnId, isVisible: boolean) => void;
  moveColumn: (columnId: ListColumnId, direction: "up" | "down") => void;
  setColumnWidth: (columnId: ListColumnId, widthPx: number) => void;
  setColumnSorting: (columnId: ListColumnId, mode: "none" | "asc" | "desc") => void;
  resetConfiguration: () => void;
  setColumnOrder: Dispatch<SetStateAction<ColumnOrderState>>;
  setColumnVisibility: Dispatch<SetStateAction<VisibilityState>>;
  setSorting: Dispatch<SetStateAction<SortingState>>;
  setColumnSizing: Dispatch<SetStateAction<ColumnSizingState>>;
  isLoaded: boolean;
};

export function useListTableConfiguration({
  storageKey,
  columns,
  fixedColumnIds = []
}: UseListTableConfigurationInput): UseListTableConfigurationResult {
  const defaults = useMemo(() => {
    const defaultOrder = [
      ...columns.map((column) => column.id),
      ...fixedColumnIds
    ];
    const defaultVisibility = Object.fromEntries(
      columns.map((column) => [column.id, column.defaultVisible !== false])
    );
    const defaultSizing = Object.fromEntries(
      columns
        .filter((column) => typeof column.defaultWidth === "number")
        .map((column) => [column.id, column.defaultWidth as number])
    );

    return {
      columnOrder: defaultOrder,
      columnVisibility: defaultVisibility as VisibilityState,
      sorting: [] as SortingState,
      columnSizing: defaultSizing as ColumnSizingState
    };
  }, [columns, fixedColumnIds]);

  const columnById = useMemo(
    () => new Map(columns.map((column) => [column.id, column])),
    [columns]
  );

  function getStoredState() {
    if (typeof window === "undefined") {
      return defaults;
    }

    const rawValue = window.localStorage.getItem(storageKey);

    if (!rawValue) {
      return defaults;
    }

    try {
      const parsed = JSON.parse(rawValue) as Partial<StoredListConfiguration>;
      const allowedColumnIds = new Set(defaults.columnOrder);
      const fixedColumnIdSet = new Set(fixedColumnIds);
      const parsedOrder = (parsed.columnOrder ?? []).filter((columnId) =>
        allowedColumnIds.has(columnId)
      );
      const missingOrder = defaults.columnOrder.filter(
        (columnId) => !parsedOrder.includes(columnId)
      );
      const mergedOrderUnnormalized = [...parsedOrder, ...missingOrder];
      const mergedOrder = [
        ...mergedOrderUnnormalized.filter((columnId) => !fixedColumnIdSet.has(columnId)),
        ...fixedColumnIds.filter((columnId) => mergedOrderUnnormalized.includes(columnId))
      ];
      const mergedVisibility: VisibilityState = { ...defaults.columnVisibility };

      Object.entries(parsed.columnVisibility ?? {}).forEach(([columnId, isVisible]) => {
        if (allowedColumnIds.has(columnId)) {
          mergedVisibility[columnId] = isVisible;
        }
      });

      const mergedSizing: ColumnSizingState = { ...defaults.columnSizing };
      Object.entries(parsed.columnSizing ?? {}).forEach(([columnId, width]) => {
        if (allowedColumnIds.has(columnId) && typeof width === "number") {
          mergedSizing[columnId] = width;
        }
      });

      const mergedSorting = (parsed.sorting ?? []).filter((item) =>
        allowedColumnIds.has(item.id)
      );

      return {
        columnVisibility: mergedVisibility,
        columnOrder: mergedOrder,
        sorting: mergedSorting,
        columnSizing: mergedSizing
      };
    } catch {
      return defaults;
    }
  }

  const [isLoaded, setIsLoaded] = useState(false);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(
    defaults.columnVisibility
  );
  const [columnOrder, setColumnOrder] = useState<ColumnOrderState>(
    defaults.columnOrder
  );
  const [sorting, setSorting] = useState<SortingState>(defaults.sorting);
  const [columnSizing, setColumnSizing] = useState<ColumnSizingState>(
    defaults.columnSizing
  );

  useLayoutEffect(() => {
    const nextState = getStoredState();
    setColumnVisibility(nextState.columnVisibility);
    setColumnOrder(nextState.columnOrder);
    setSorting(nextState.sorting);
    setColumnSizing(nextState.columnSizing);
    setIsLoaded(true);
  }, [storageKey]);

  useEffect(() => {
    if (!isLoaded) {
      return;
    }

    if (typeof window === "undefined") {
      return;
    }

    const rawValue = window.localStorage.getItem(storageKey);
    if (rawValue) {
      return;
    }

    setColumnVisibility(defaults.columnVisibility);
    setColumnOrder(defaults.columnOrder);
    setSorting(defaults.sorting);
    setColumnSizing(defaults.columnSizing);
  }, [defaults, isLoaded, storageKey]);

  useEffect(() => {
    if (!isLoaded) {
      return;
    }

    if (typeof window === "undefined") {
      return;
    }

    const payload: StoredListConfiguration = {
      columnVisibility,
      columnOrder,
      sorting,
      columnSizing
    };

    window.localStorage.setItem(storageKey, JSON.stringify(payload));
  }, [columnOrder, columnSizing, columnVisibility, sorting, storageKey]);

  function setColumnVisible(columnId: ListColumnId, isVisible: boolean) {
    setColumnVisibility((currentState) => ({
      ...currentState,
      [columnId]: isVisible
    }));
  }

  function moveColumn(columnId: ListColumnId, direction: "up" | "down") {
    setColumnOrder((currentOrder) => {
      const index = currentOrder.indexOf(columnId);
      if (index < 0) {
        return currentOrder;
      }

      const nextIndex = direction === "up" ? index - 1 : index + 1;
      if (nextIndex < 0 || nextIndex >= currentOrder.length) {
        return currentOrder;
      }

      const nextOrder = [...currentOrder];
      const [item] = nextOrder.splice(index, 1);
      nextOrder.splice(nextIndex, 0, item);
      return nextOrder;
    });
  }

  function setColumnWidth(columnId: ListColumnId, widthPx: number) {
    if (!Number.isFinite(widthPx)) {
      return;
    }

    const columnDefinition = columnById.get(columnId);
    const minWidth = columnDefinition?.minWidth ?? 72;
    const maxWidth = columnDefinition?.maxWidth ?? 640;
    const nextWidth = Math.max(minWidth, Math.min(maxWidth, Math.round(widthPx)));

    setColumnSizing((currentState) => ({
      ...currentState,
      [columnId]: nextWidth
    }));
  }

  function setColumnSorting(columnId: ListColumnId, mode: "none" | "asc" | "desc") {
    if (mode === "none") {
      setSorting((currentSorting) =>
        currentSorting.filter((item) => item.id !== columnId)
      );
      return;
    }

    setSorting([{ id: columnId, desc: mode === "desc" }]);
  }

  function resetConfiguration() {
    setColumnVisibility(defaults.columnVisibility);
    setColumnOrder(defaults.columnOrder);
    setSorting(defaults.sorting);
    setColumnSizing(defaults.columnSizing);
  }

  const configurableColumns = useMemo(
    () => columns.filter((column) => !fixedColumnIds.includes(column.id)),
    [columns, fixedColumnIds]
  );

  return {
    columnVisibility,
    columnOrder,
    sorting,
    columnSizing,
    configurableColumns,
    setColumnVisible,
    moveColumn,
    setColumnWidth,
    setColumnSorting,
    resetConfiguration,
    setColumnOrder,
    setColumnVisibility,
    setSorting,
    setColumnSizing,
    isLoaded
  };
}

type ListConfigurationDialogCopy = {
  close: string;
  saveChanges: string;
  configureListTitle: string;
  configureListBody: string;
  visibleColumns: string;
  moveUp: string;
  moveDown: string;
  columnWidthPx: string;
  sortingLabel: string;
  clearSorting: string;
  resetListConfiguration: string;
};

type ListConfigurationDialogProps = {
  copy: ListConfigurationDialogCopy;
  dialogRef: RefObject<HTMLDialogElement | null>;
  columns: ListColumnDefinition[];
  visibleColumns: VisibilityState;
  sorting: SortingState;
  sizing: ColumnSizingState;
  onColumnVisibleChange: (columnId: ListColumnId, isVisible: boolean) => void;
  onMoveColumn: (columnId: ListColumnId, direction: "up" | "down") => void;
  onWidthChange: (columnId: ListColumnId, widthPx: number) => void;
  onSortingChange: (columnId: ListColumnId, mode: "none" | "asc" | "desc") => void;
  onReset: () => void;
};

export function ListConfigurationDialog({
  copy,
  dialogRef,
  columns,
  visibleColumns,
  sorting,
  sizing,
  onColumnVisibleChange,
  onMoveColumn,
  onWidthChange,
  onSortingChange,
  onReset
}: ListConfigurationDialogProps) {
  return (
    <DialogShell
      ref={dialogRef}
      closeLabel={copy.close}
      description={copy.configureListBody}
      title={copy.configureListTitle}
      titleId="list-config-dialog-title"
      widthClassName="w-[min(48rem,calc(100vw-3rem))]"
    >
      <DialogBody>
        <div className="grid gap-3">
          <p className="text-sm font-medium text-slate-700">{copy.visibleColumns}</p>
          {columns.map((column) => {
            const sortState = sorting.find((item) => item.id === column.id);
            const widthValue = Math.round(
              Number(sizing[column.id] ?? column.defaultWidth ?? 160)
            );

            return (
              <div
                key={column.id}
                className="grid grid-cols-[minmax(0,1fr)_auto_auto_auto_auto] items-center gap-2 rounded-md border border-slate-200 bg-white p-2"
              >
                <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                  <input
                    checked={visibleColumns[column.id] !== false}
                    type="checkbox"
                    onChange={(event) =>
                      onColumnVisibleChange(column.id, event.currentTarget.checked)
                    }
                  />
                  <span>{column.label}</span>
                </label>
                <button
                  className="min-h-8 rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700"
                  type="button"
                  onClick={() => onMoveColumn(column.id, "up")}
                >
                  {copy.moveUp}
                </button>
                <button
                  className="min-h-8 rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700"
                  type="button"
                  onClick={() => onMoveColumn(column.id, "down")}
                >
                  {copy.moveDown}
                </button>
                <label className="inline-flex items-center gap-2 text-xs text-slate-600">
                  <span>{copy.columnWidthPx}</span>
                  <input
                    className="w-20 rounded border border-slate-300 px-2 py-1 text-xs text-slate-900"
                    max={column.maxWidth ?? 640}
                    min={column.minWidth ?? 80}
                    type="number"
                    value={widthValue}
                    onChange={(event) =>
                      onWidthChange(column.id, Number(event.currentTarget.value))
                    }
                  />
                </label>
                {column.sortable ? (
                  <label className="inline-flex items-center gap-2 text-xs text-slate-600">
                    <span>{copy.sortingLabel}</span>
                    <select
                      className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-900"
                      value={
                        sortState ? (sortState.desc ? "desc" : "asc") : "none"
                      }
                      onChange={(event) =>
                        onSortingChange(
                          column.id,
                          event.currentTarget.value as "none" | "asc" | "desc"
                        )
                      }
                    >
                      <option value="none">{copy.clearSorting}</option>
                      <option value="asc">Asc</option>
                      <option value="desc">Desc</option>
                    </select>
                  </label>
                ) : (
                  <span />
                )}
              </div>
            );
          })}
        </div>
      </DialogBody>
      <DialogFooter className="items-center justify-between">
        <button
          className="min-h-9 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700"
          type="button"
          onClick={onReset}
        >
          {copy.resetListConfiguration}
        </button>
        <button
          className="min-h-9 rounded-md border border-slate-900 bg-slate-900 px-3 py-1.5 text-sm font-medium text-white"
          type="button"
          onClick={() => dialogRef.current?.close()}
        >
          {copy.saveChanges}
        </button>
      </DialogFooter>
    </DialogShell>
  );
}
