"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { getCoreRowModel, useReactTable } from "@tanstack/react-table";
import { useQuery } from "@tanstack/react-query";

import type { PartsListItem } from "@/server/parts/getParts";
import { getPartsListFilterDataForWorkspace } from "@/server/parts/listActions";
import { useListTableConfiguration } from "@/app/list-table-config";
import { ListPageToolbar } from "@/app/list-page-toolbar";
import { DialogBody, DialogFooter, DialogPrimaryButton, DialogSecondaryButton, DialogShell, closeDialog, openDialog } from "@/app/dialog-shell";
import { usePartsListQuery } from "@/app/use-parts-list-query";
import { PartsListFilters, type PartsListFiltersCopy } from "@/app/parts-list-filters";
import { buildPartsListColumnDefs, buildPartsListColumns, type PartsListColumnsCopy } from "@/app/parts-list-columns";
import { PartsListTable } from "@/app/parts-list-table";
import { formatFilteredPartsSummary } from "@/app/parts-list-sort-utils";
import type { ManufacturerSuggestion } from "@/app/manufacturer-autocomplete";

export type PartPickerCopy = PartsListFiltersCopy &
  Pick<
    PartsListColumnsCopy,
    | "noCategory"
    | "categories"
    | "manufacturer"
    | "catalogNumber"
    | "description"
    | "value"
    | "source"
    | "stock"
    | "reserved"
    | "allocated"
    | "available"
    | "balance"
    | "planned"
    | "onOrder"
    | "inProduction"
    | "avgNetCost"
    | "avgGrossCost"
    | "defaultLocation"
  > & {
    title: string;
    cancel: string;
    confirmSelection: string;
    partsSelected: string;
    alreadyAdded: string;
    filteredPartsSummary: string;
    configureList: string;
    clearFilters: string;
    visibleColumns: string;
    attributeColumns: string;
    emptyTitle: string;
    emptyBody: string;
    noMatchingPartsTitle: string;
    noMatchingPartsBody: string;
    loadingParts: string;
    loadingMoreParts: string;
    databaseUnavailable: string;
  };

type PartPickerListModalProps = {
  workspaceSlug: string;
  /** Determines the localStorage key: `oso:list-config:part-picker:<contextKey>` */
  contextKey: string;
  /** Parts that are already on the target PO/SL — shown with badge but still selectable. */
  alreadyAddedPartIds: ReadonlySet<string>;
  open: boolean;
  copy: PartPickerCopy;
  onClose: () => void;
  onConfirm: (selectedParts: PartsListItem[]) => void;
};

export function PartPickerListModal({
  workspaceSlug,
  contextKey,
  alreadyAddedPartIds,
  open,
  copy,
  onClose,
  onConfirm
}: PartPickerListModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [selectedPartIds, setSelectedPartIds] = useState<Set<string>>(new Set());
  const [selectedPartsMap, setSelectedPartsMap] = useState<Map<string, PartsListItem>>(new Map());

  useEffect(() => {
    if (open) {
      setSelectedPartIds(new Set());
      setSelectedPartsMap(new Map());
      openDialog(dialogRef.current);
    } else {
      closeDialog(dialogRef.current);
    }
  }, [open]);

  const filterDataQuery = useQuery({
    queryKey: ["parts-list-filter-data", workspaceSlug],
    queryFn: async () => {
      const result = await getPartsListFilterDataForWorkspace({ workspaceSlug });
      if (!result.ok) throw new Error(result.error);
      return result;
    }
  });

  const partCategories = filterDataQuery.data?.categories ?? [];
  const manufacturerOptions = useMemo(
    (): ManufacturerSuggestion[] =>
      (filterDataQuery.data?.manufacturerNames ?? []).map((name) => ({
        id: name,
        name
      })),
    [filterDataQuery.data]
  );

  const listColumns = useMemo(
    () =>
      buildPartsListColumnDefs({
        copy,
        workspaceAttributes: []
      }),
    [copy]
  );
  const fixedListColumnIds = useMemo(() => [] as string[], []);
  const {
    columnSizing,
    columnVisibility,
    configurableColumns,
    setColumnWidth,
    setColumnSorting,
    setColumnVisible,
    setColumnOrder,
    setColumnSizing,
    setColumnVisibility,
    setSorting,
    sorting,
    columnOrder: persistedColumnOrder,
    isLoaded: isListConfigurationLoaded
  } = useListTableConfiguration({
    storageKey: `oso:list-config:part-picker:${contextKey}`,
    columns: listColumns,
    fixedColumnIds: fixedListColumnIds
  });

  const {
    currentParts,
    partsCounts,
    hasActiveFilters,
    isLoading,
    isError,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    searchQuery,
    setSearchQuery,
    categoryFilterId,
    setCategoryFilterId,
    manufacturerFilter,
    setManufacturerFilter,
    clearFilters
  } = usePartsListQuery({ workspaceSlug, sorting, enabled: open });

  function handleToggle(partId: string) {
    const part = currentParts.find((p) => p.id === partId);
    setSelectedPartIds((current) => {
      const next = new Set(current);
      if (next.has(partId)) {
        next.delete(partId);
      } else {
        next.add(partId);
        if (part) {
          setSelectedPartsMap((m) => new Map(m).set(partId, part));
        }
      }
      return next;
    });
  }

  const columns = useMemo(
    () =>
      buildPartsListColumns({
        mode: "picker",
        copy,
        workspaceAttributes: [],
        selectedPartIds,
        alreadyAddedPartIds,
        onToggle: handleToggle
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [copy, selectedPartIds, alreadyAddedPartIds]
  );

  // "select" is not part of the persisted config (it's picker-only), so pin it first explicitly.
  const tableColumnOrder = useMemo(
    () => ["select", ...persistedColumnOrder.filter((id) => id !== "select")],
    [persistedColumnOrder]
  );

  // eslint-disable-next-line react-hooks/incompatible-library
  const pickerTable = useReactTable({
    data: currentParts,
    columns,
    state: {
      columnVisibility,
      columnOrder: tableColumnOrder,
      sorting,
      columnSizing
    },
    onColumnVisibilityChange: setColumnVisibility,
    onColumnOrderChange: setColumnOrder,
    onSortingChange: setSorting,
    onColumnSizingChange: setColumnSizing,
    columnResizeMode: "onChange",
    enableColumnResizing: true,
    manualSorting: true,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: undefined
  });

  const selectedCount = selectedPartIds.size;
  const selectedParts = useMemo(
    () =>
      Array.from(selectedPartIds)
        .map((id) => selectedPartsMap.get(id) ?? currentParts.find((p) => p.id === id))
        .filter((p): p is PartsListItem => p !== undefined),
    [selectedPartIds, selectedPartsMap, currentParts]
  );

  return (
    <DialogShell
      ref={dialogRef}
      closeLabel={copy.cancel}
      title={copy.title}
      titleId="part-picker-title"
      widthClassName="w-[min(90rem,calc(100vw-3rem))]"
      heightClassName="h-[min(calc(100vh-2rem),720px)]"
      onClose={onClose}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onCloseClick={() => onClose()}
    >
      <DialogBody className="flex min-h-0 flex-1 flex-col overflow-hidden p-0">
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elevated)]">
          <ListPageToolbar
            columnGroups={[]}
            clearFiltersLabel={copy.clearFilters}
            columnVisibility={columnVisibility}
            configurableColumns={configurableColumns}
            configureListLabel={copy.configureList}
            filteredCount={partsCounts.filteredCount}
            formatCount={(visible, total) =>
              formatFilteredPartsSummary(copy, { visible, total })
            }
            hasActiveFilters={hasActiveFilters}
            totalCount={partsCounts.totalCount}
            visibleColumnsLabel={copy.visibleColumns}
            setColumnVisible={setColumnVisible}
            onClearFilters={clearFilters}
            filterContent={
              <PartsListFilters
                copy={copy}
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                categoryFilterId={categoryFilterId}
                onCategoryChange={setCategoryFilterId}
                manufacturerFilter={manufacturerFilter}
                onManufacturerChange={setManufacturerFilter}
                partCategories={partCategories}
                manufacturerOptions={manufacturerOptions}
              />
            }
            primaryAction={null}
          />
          <PartsListTable
            table={pickerTable}
            columnDefs={listColumns}
            setColumnSorting={setColumnSorting}
            setColumnWidth={setColumnWidth}
            hasNextPage={hasNextPage}
            isFetchingNextPage={isFetchingNextPage}
            isInitialLoading={isLoading || !isListConfigurationLoaded}
            isError={isError}
            isEmpty={currentParts.length === 0}
            loadMore={fetchNextPage}
            loadingLabel={copy.loadingParts}
            loadingMoreLabel={copy.loadingMoreParts}
            emptyState={
              <div className="px-4 py-10">
                <p className="text-base font-medium text-[var(--color-text-primary)]">
                  {hasActiveFilters ? copy.noMatchingPartsTitle : copy.emptyTitle}
                </p>
                <p className="mt-2 max-w-xl text-sm leading-6 text-[var(--color-text-muted)]">
                  {hasActiveFilters ? copy.noMatchingPartsBody : copy.emptyBody}
                </p>
              </div>
            }
            errorState={
              <p className="p-6 text-sm text-[var(--color-text-muted)]">
                {copy.databaseUnavailable}
              </p>
            }
            testId="part-picker-viewport"
            setColumnOrder={setColumnOrder}
          />
        </div>
      </DialogBody>
      <DialogFooter className="items-center justify-between gap-3">
        <span className="text-sm text-[var(--color-text-secondary)]">
          {copy.partsSelected.replace("{count}", String(selectedCount))}
        </span>
        <div className="flex gap-3">
          <DialogSecondaryButton onClick={onClose}>
            {copy.cancel}
          </DialogSecondaryButton>
          <DialogPrimaryButton
            disabled={selectedCount === 0}
            type="button"
            onClick={() => onConfirm(selectedParts)}
          >
            {copy.confirmSelection.replace("{count}", String(selectedCount))}
          </DialogPrimaryButton>
        </div>
      </DialogFooter>
    </DialogShell>
  );
}
