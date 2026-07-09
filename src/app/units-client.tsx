"use client";

import { useMemo, useRef, useState } from "react";
import {
  createColumnHelper,
  getCoreRowModel,
  useReactTable
} from "@tanstack/react-table";
import {
  keepPreviousData,
  useInfiniteQuery,
  useMutation,
  useQueryClient
} from "@tanstack/react-query";

import {
  createUnitForWorkspace,
  deleteUnitForWorkspace,
  getUnitsPageForWorkspace,
  updateUnitForWorkspace
} from "@/server/units/unitActions";
import type { UnitListItem } from "@/server/units/unitMutations";
import type { ListPage } from "@/server/pagination";
import {
  useListTableConfiguration,
  type ListColumnDefinition
} from "@/app/list-table-config";
import { ListPageToolbar } from "@/app/list-page-toolbar";
import { ListTable } from "@/app/list-table";
import {
  getNextToastId,
  ToastNotice,
  type ToastMessage
} from "@/app/toast-notice";
import {
  DeleteConfirmationDialog,
  DialogActions,
  DialogBody,
  DialogShell,
  ErrorBubble,
  LabelWithError,
  closeDialog,
  getFieldInputClassName,
  openDialog
} from "@/app/dialog-shell";

type Copy = {
  addUnit: string;
  edit: string;
  delete: string;
  close: string;
  cancelDelete: string;
  confirmDelete: string;
  deleteConfirmationBody: string;
  createUnit: string;
  saveChanges: string;
  newUnitTitle: string;
  editUnitTitle: string;
  name: string;
  symbol: string;
  allowsFraction: string;
  yes: string;
  no: string;
  actions: string;
  duplicateUnitName: string;
  unitInUse: string;
  unitNotFound: string;
  permissionDenied: string;
  databaseUnavailable: string;
  noUnits: string;
  createdToast: string;
  updatedToast: string;
  deletedToast: string;
  invalidInput: string;
  configureList: string;
  visibleColumns: string;
  listCountSummary: string;
  loadingUnits: string;
  loadingMore: string;
  loadError: string;
};

type UnitsClientProps = {
  canWriteUnits: boolean;
  copy: Copy;
  initialPage: ListPage<UnitListItem>;
  isDatabaseAvailable: boolean;
  workspaceSlug: string;
};

type UnitDialogMode = "create" | "edit";
type UnitFormField = "name" | "symbol" | "submit" | "delete";
type UnitFormErrors = Partial<Record<UnitFormField, string>>;

const columnHelper = createColumnHelper<UnitListItem>();

export function UnitsClient({
  canWriteUnits,
  copy,
  initialPage,
  isDatabaseAvailable,
  workspaceSlug
}: UnitsClientProps) {
  const queryClient = useQueryClient();
  const unitDialogRef = useRef<HTMLDialogElement>(null);
  const nextToastIdRef = useRef(0);
  const [unitDialogMode, setUnitDialogMode] = useState<UnitDialogMode | null>(
    null
  );
  const [editingUnit, setEditingUnit] = useState<UnitListItem | null>(null);
  const [unitPendingDelete, setUnitPendingDelete] = useState<UnitListItem | null>(
    null
  );
  const [unitFieldErrors, setUnitFieldErrors] = useState<UnitFormErrors>({});
  const [dialogFormKey, setDialogFormKey] = useState(0);
  const [toastMessages, setToastMessages] = useState<ToastMessage[]>([]);

  // --- Column configuration ---

  const unitColumns = useMemo<ListColumnDefinition[]>(
    () => [
      { id: "name", label: copy.name, group: "base", defaultWidth: 240, minWidth: 120, sortable: true },
      { id: "symbol", label: copy.symbol, group: "base", defaultWidth: 160, minWidth: 80, sortable: true },
      { id: "allowsFraction", label: copy.allowsFraction, group: "base", defaultWidth: 220, minWidth: 120, sortable: true }
    ],
    [copy]
  );
  const fixedColumnIds = useMemo(() => ["actions"], []);

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
    isLoaded: isConfigLoaded
  } = useListTableConfiguration({
    storageKey: `oso:list-config:units:${workspaceSlug}`,
    columns: unitColumns,
    fixedColumnIds
  });

  // --- Data ---

  const activeSorting = sorting[0] ?? null;
  const sortDir = activeSorting?.desc ? "desc" : "asc";
  const sortBy = (activeSorting?.id ??
    "name") as "name" | "symbol" | "allowsFraction";

  const unitsQuery = useInfiniteQuery({
    queryKey: ["units-list", workspaceSlug, { sorting }] as const,
    enabled: isDatabaseAvailable,
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam }) => {
      const result = await getUnitsPageForWorkspace({
        workspaceSlug,
        cursor: pageParam,
        sortBy,
        sortDir
      });

      if (!result.ok) {
        throw new Error(result.error);
      }

      return result.data;
    },
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    placeholderData: keepPreviousData,
    initialData:
      sorting.length === 0
        ? { pages: [initialPage], pageParams: [null] }
        : undefined
  });

  const units = useMemo(
    () => unitsQuery.data?.pages.flatMap((page) => page.items) ?? [],
    [unitsQuery.data]
  );
  const unitsById = useMemo(
    () => new Map(units.map((unit) => [unit.id, unit])),
    [units]
  );

  function reloadUnits() {
    void queryClient.invalidateQueries({
      queryKey: ["units-list", workspaceSlug]
    });
  }

  const createUnitMutation = useMutation({
    mutationFn: createUnitForWorkspace,
    onSuccess: async (result) => {
      if (!result.ok) {
        setUnitFieldErrors(getUnitFormErrors(copy, result.error));
        return;
      }

      reloadUnits();
      addToast(getUnitSuccessMessage(copy.createdToast, result.data.name));
      closeUnitDialog();
    },
    onError: () =>
      setUnitFieldErrors({
        submit: copy.invalidInput
      })
  });

  const updateUnitMutation = useMutation({
    mutationFn: updateUnitForWorkspace,
    onSuccess: async (result) => {
      if (!result.ok) {
        setUnitFieldErrors(getUnitFormErrors(copy, result.error));
        return;
      }

      reloadUnits();
      addToast(getUnitSuccessMessage(copy.updatedToast, result.data.name));
      closeUnitDialog();
    },
    onError: () =>
      setUnitFieldErrors({
        submit: copy.invalidInput
      })
  });

  const deleteUnitMutation = useMutation({
    mutationFn: deleteUnitForWorkspace,
    onSuccess: async (result, variables) => {
      if (!result.ok) {
        setUnitFieldErrors(getUnitFormErrors(copy, result.error));
        return;
      }

      const deletedUnitName =
        unitsById.get(variables.unitId)?.name ?? editingUnit?.name ?? "";
      reloadUnits();
      addToast(getUnitSuccessMessage(copy.deletedToast, deletedUnitName));
      closeUnitDialog();
    },
    onError: () =>
      setUnitFieldErrors({
        delete: copy.invalidInput
      })
  });

  function openCreateDialog() {
    setEditingUnit(null);
    setUnitDialogMode("create");
    setUnitFieldErrors({});
    setDialogFormKey((currentKey) => currentKey + 1);
    window.requestAnimationFrame(() => openDialog(unitDialogRef.current));
  }

  function openEditDialog(unit: UnitListItem) {
    setEditingUnit(unit);
    setUnitDialogMode("edit");
    setUnitFieldErrors({});
    setDialogFormKey((currentKey) => currentKey + 1);
    window.requestAnimationFrame(() => openDialog(unitDialogRef.current));
  }

  function closeUnitDialog() {
    closeDialog(unitDialogRef.current);
    setUnitDialogMode(null);
    setEditingUnit(null);
    setUnitPendingDelete(null);
    setUnitFieldErrors({});
  }

  function handleCreateSubmit(formData: FormData) {
    const fieldErrors = validateUnitForm(copy, formData);
    setUnitFieldErrors(fieldErrors);

    if (hasFieldErrors(fieldErrors)) {
      return;
    }

    createUnitMutation.mutate({
      workspaceSlug,
      name: getFormString(formData, "name"),
      symbol: getFormString(formData, "symbol"),
      allowsFraction: getFormString(formData, "allowsFraction") === "true"
    });
  }

  function handleUpdateSubmit(formData: FormData) {
    if (!editingUnit) {
      return;
    }

    const fieldErrors = validateUnitForm(copy, formData);
    setUnitFieldErrors(fieldErrors);

    if (hasFieldErrors(fieldErrors)) {
      return;
    }

    updateUnitMutation.mutate({
      workspaceSlug,
      unitId: editingUnit.id,
      name: getFormString(formData, "name"),
      symbol: getFormString(formData, "symbol"),
      allowsFraction: getFormString(formData, "allowsFraction") === "true"
    });
  }

  function handleDeleteUnit(unit: UnitListItem) {
    setUnitFieldErrors({});
    setUnitPendingDelete(unit);
  }

  function confirmDeleteUnit() {
    if (!unitPendingDelete) {
      return;
    }

    setUnitFieldErrors({});
    deleteUnitMutation.mutate({
      workspaceSlug,
      unitId: unitPendingDelete.id
    });
  }

  function addToast(message: string) {
    setToastMessages((currentMessages) => [
      ...currentMessages,
      {
        id: getNextToastId(nextToastIdRef),
        message
      }
    ]);
  }

  function dismissToastMessage(toastId: number) {
    setToastMessages((currentMessages) =>
      currentMessages.filter((toast) => toast.id !== toastId)
    );
  }

  // --- TanStack Table ---

  const columns = useMemo(
    () => [
      columnHelper.accessor("name", {
        header: copy.name,
        size: 240,
        minSize: 120,
        cell: ({ getValue }) => (
          <span className="font-medium text-[var(--color-text-primary)]">{getValue()}</span>
        )
      }),
      columnHelper.accessor("symbol", {
        header: copy.symbol,
        size: 160,
        minSize: 80,
        cell: ({ getValue }) => (
          <span className="font-mono text-[var(--color-text-secondary)]">{getValue()}</span>
        )
      }),
      columnHelper.accessor("allowsFraction", {
        header: copy.allowsFraction,
        size: 220,
        minSize: 120,
        cell: ({ getValue }) => (
          <span className="text-[var(--color-text-secondary)]">
            {getValue() ? copy.yes : copy.no}
          </span>
        )
      }),
      columnHelper.display({
        id: "actions",
        header: "",
        size: 104,
        minSize: 104,
        maxSize: 104,
        enableResizing: false,
        cell: ({ row }) => (
          <div className="flex justify-end gap-2">
            <button
              className="min-h-8 rounded-md border border-[var(--color-border-strong)] bg-[var(--color-bg-elevated)] px-2.5 py-1 text-sm font-medium text-[var(--color-text-secondary)] transition hover:border-[var(--color-border-hover)] hover:bg-[var(--color-bg-subtle)] focus:outline-none focus:ring-2 focus:ring-[var(--color-ring-strong)] focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-[var(--color-bg-subtle)] disabled:text-[var(--color-text-placeholder)]"
              aria-label={copy.edit}
              disabled={!canWriteUnits || !isDatabaseAvailable}
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                openEditDialog(row.original);
              }}
            >
              <svg
                aria-hidden="true"
                className="h-4 w-4"
                viewBox="0 0 20 20"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M13.9 3.3a1.5 1.5 0 0 1 2.1 0l.7.7a1.5 1.5 0 0 1 0 2.1l-8.4 8.4-3.3.8.8-3.3 8.4-8.4Z"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
            <button
              className="min-h-8 rounded-md border border-[var(--color-error-border)] bg-[var(--color-bg-elevated)] px-2.5 py-1 text-sm font-medium text-[var(--color-error)] transition hover:bg-[var(--color-error-soft)] focus:outline-none focus:ring-2 focus:ring-[var(--color-error-border)] focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-[var(--color-bg-subtle)] disabled:text-[var(--color-text-placeholder)]"
              aria-label={copy.delete}
              disabled={
                !canWriteUnits ||
                !isDatabaseAvailable ||
                deleteUnitMutation.isPending
              }
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                handleDeleteUnit(row.original);
              }}
            >
              <svg
                aria-hidden="true"
                className="h-4 w-4"
                viewBox="0 0 20 20"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M5.5 6h9m-7.5 0V4.75A1.75 1.75 0 0 1 8.75 3h2.5A1.75 1.75 0 0 1 13 4.75V6m-6.5 0 .6 9.1A1.75 1.75 0 0 0 8.84 16.75h2.32a1.75 1.75 0 0 0 1.74-1.65L13.5 6M8.75 8.5v5m2.5-5v5"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </div>
        )
      })
    ],
    [canWriteUnits, copy, isDatabaseAvailable, deleteUnitMutation.isPending]
  );

  const tableColumnOrder = useMemo(() => persistedColumnOrder, [persistedColumnOrder]);

  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: units,
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
    getCoreRowModel: getCoreRowModel()
  });

  return (
    <>
      <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elevated)] shadow-sm">
        <ListPageToolbar
          columnVisibility={columnVisibility}
          configurableColumns={configurableColumns}
          configureListLabel={copy.configureList}
          filteredCount={unitsQuery.data?.pages[0]?.filteredCount}
          formatCount={(visible, total) =>
            copy.listCountSummary
              .replace("{visible}", String(visible))
              .replace("{total}", String(total))
          }
          totalCount={unitsQuery.data?.pages[0]?.totalCount}
          visibleColumnsLabel={copy.visibleColumns}
          setColumnVisible={setColumnVisible}
          primaryAction={
            <button
              className="inline-flex min-h-9 items-center rounded-md bg-[var(--color-accent)] px-4 text-sm font-semibold text-white transition hover:brightness-95 focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
              type="button"
              disabled={!canWriteUnits || !isDatabaseAvailable}
              onClick={openCreateDialog}
            >
              {copy.addUnit}
            </button>
          }
        />

        <ListTable
          table={table}
          columnDefs={unitColumns}
          setColumnSorting={setColumnSorting}
          setColumnWidth={setColumnWidth}
          hasNextPage={Boolean(unitsQuery.hasNextPage)}
          isEmpty={units.length === 0}
          isError={unitsQuery.isError}
          isFetchingNextPage={unitsQuery.isFetchingNextPage}
          isInitialLoading={!isConfigLoaded || unitsQuery.isLoading}
          loadMore={() => { void unitsQuery.fetchNextPage(); }}
          loadingLabel={copy.loadingUnits}
          loadingMoreLabel={copy.loadingMore}
          emptyState={<p className="px-4 py-10 text-sm text-[var(--color-text-muted)]">{copy.noUnits}</p>}
          errorState={<p className="px-4 py-10 text-sm text-[var(--color-text-muted)]">{copy.loadError}</p>}
          testId="units-list-viewport"
          setColumnOrder={setColumnOrder}
        />
      </section>
      {unitFieldErrors.delete ? (
        <div className="mt-3">
          <ErrorBubble align="start">{unitFieldErrors.delete}</ErrorBubble>
        </div>
      ) : null}

      <DialogShell
        ref={unitDialogRef}
        closeLabel={copy.close}
        title={unitDialogMode === "create" ? copy.newUnitTitle : copy.editUnitTitle}
        titleId="unit-dialog-title"
        widthClassName="w-[min(32rem,calc(100vw-3rem))]"
        onClose={closeUnitDialog}
      >
        {unitDialogMode ? (
          <form
            key={dialogFormKey}
            action={
              unitDialogMode === "create"
                ? handleCreateSubmit
                : handleUpdateSubmit
            }
            className="flex min-h-0 flex-1 flex-col overflow-hidden"
          >
            <DialogBody className="grid gap-4">
              <label className="grid gap-2 text-sm font-medium text-[var(--color-text-secondary)]">
                <LabelWithError error={unitFieldErrors.name} htmlFor="unit-name">
                  {copy.name}
                </LabelWithError>
                <input
                  id="unit-name"
                  name="name"
                  defaultValue={editingUnit?.name ?? ""}
                  className={getFieldInputClassName(
                    "min-h-10 rounded-md border border-[var(--color-border-strong)] bg-[var(--color-bg-elevated)] px-3 py-1.5 text-sm text-[var(--color-text-primary)] outline-none transition hover:border-[var(--color-border-hover)] focus:border-[var(--color-border-hover)] focus:ring-2 focus:ring-[var(--color-ring)]",
                    Boolean(unitFieldErrors.name)
                  )}
                />
              </label>
              <label className="grid gap-2 text-sm font-medium text-[var(--color-text-secondary)]">
                <LabelWithError error={unitFieldErrors.symbol} htmlFor="unit-symbol">
                  {copy.symbol}
                </LabelWithError>
                <input
                  id="unit-symbol"
                  name="symbol"
                  defaultValue={editingUnit?.symbol ?? ""}
                  className={getFieldInputClassName(
                    "min-h-10 rounded-md border border-[var(--color-border-strong)] bg-[var(--color-bg-elevated)] px-3 py-1.5 text-sm text-[var(--color-text-primary)] outline-none transition hover:border-[var(--color-border-hover)] focus:border-[var(--color-border-hover)] focus:ring-2 focus:ring-[var(--color-ring)]",
                    Boolean(unitFieldErrors.symbol)
                  )}
                />
              </label>
              <label className="inline-flex items-center gap-2 text-sm text-[var(--color-text-primary)]">
                <input
                  type="checkbox"
                  name="allowsFraction"
                  value="true"
                  defaultChecked={editingUnit?.allowsFraction ?? false}
                />
                {copy.allowsFraction}
              </label>
            </DialogBody>
            <DialogActions
              actionLabel={unitDialogMode === "create" ? copy.createUnit : copy.saveChanges}
              disabled={createUnitMutation.isPending || updateUnitMutation.isPending || !canWriteUnits}
            />
            {unitFieldErrors.submit ? (
              <ErrorBubble>{unitFieldErrors.submit}</ErrorBubble>
            ) : null}
          </form>
        ) : null}
      </DialogShell>

      <DeleteConfirmationDialog
        body={copy.deleteConfirmationBody}
        cancelLabel={copy.cancelDelete}
        closeLabel={copy.close}
        confirmLabel={copy.confirmDelete}
        deleteLabel={copy.delete}
        isPending={deleteUnitMutation.isPending}
        itemName={
          unitPendingDelete ? `${unitPendingDelete.name} (${unitPendingDelete.symbol})` : ""
        }
        open={Boolean(unitPendingDelete)}
        onCancel={() => setUnitPendingDelete(null)}
        onConfirm={confirmDeleteUnit}
      />

      <ToastNotice messages={toastMessages} onDismiss={dismissToastMessage} />
    </>
  );
}

function validateUnitForm(copy: Copy, formData: FormData): UnitFormErrors {
  const errors: UnitFormErrors = {};
  const name = getFormString(formData, "name");
  const symbol = getFormString(formData, "symbol");

  if (!name) {
    errors.name = copy.invalidInput;
  }

  if (!symbol) {
    errors.symbol = copy.invalidInput;
  }

  return errors;
}

function getUnitFormErrors(copy: Copy, error: string): UnitFormErrors {
  if (error === "duplicate-unit-name") {
    return {
      name: copy.duplicateUnitName
    };
  }

  if (error === "unit-in-use") {
    return {
      delete: copy.unitInUse
    };
  }

  if (error === "unit-not-found") {
    return {
      submit: copy.unitNotFound
    };
  }

  return {
    submit: getErrorMessage(copy, error)
  };
}

function getErrorMessage(copy: Copy, error: string) {
  if (error === "permission-denied") {
    return copy.permissionDenied;
  }

  if (error === "database-unavailable") {
    return copy.databaseUnavailable;
  }

  return copy.invalidInput;
}

function getUnitSuccessMessage(actionLabel: string, unitName: string) {
  return unitName ? `${actionLabel}: ${unitName}.` : actionLabel;
}

function hasFieldErrors(errors: UnitFormErrors) {
  return Object.values(errors).some(Boolean);
}

function getFormString(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}
