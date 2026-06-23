"use client";

import { useMemo, useRef, useState } from "react";
import { CURRENCIES } from "@/app/currencies";
import {
  createColumnHelper,
  flexRender,
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
  createOrganizationAction,
  deleteOrganizationAction,
  getOrganizationsPageForWorkspace,
  updateOrganizationAction
} from "@/server/organizations/organizationActions";
import type { OrganizationSummary } from "@/server/organizations/organizationActions";

const ORGANIZATION_ROLES = ["manufacturer", "supplier"] as const;
import type { ListPage } from "@/server/pagination";
import {
  closeDialog,
  DeleteConfirmationDialog,
  DialogBody,
  DialogFooter,
  DialogShell,
  ErrorBubble,
  LabelWithError,
  openDialog
} from "@/app/dialog-shell";
import { getNextToastId, ToastNotice, type ToastMessage } from "@/app/toast-notice";
import { InfiniteListViewport } from "@/app/infinite-list";
import {
  useListTableConfiguration,
  type ListColumnDefinition
} from "@/app/list-table-config";
import { ListPageToolbar, ListTableHeaderCell, useColumnDragReorder, useColumnResizeCursor } from "@/app/list-page-toolbar";
import { EmptyCell } from "@/app/list-table-cell";

type Copy = {
  title: string;
  intro: string;
  addOrganization: string;
  newOrganizationTitle: string;
  editOrganizationTitle: string;
  name: string;
  namePlaceholder: string;
  roles: string;
  roleManufacturer: string;
  roleSupplier: string;
  createdAt: string;
  actions: string;
  edit: string;
  delete: string;
  close: string;
  cancel: string;
  cancelDelete: string;
  confirmDelete: string;
  deleteConfirmationBody: string;
  deleteOrganization: string;
  createOrganization: string;
  saveChanges: string;
  noOrganizations: string;
  loadError: string;
  loadingOrganizations: string;
  loadingMore: string;
  nameRequired: string;
  roleRequired: string;
  nameTaken: string;
  referencedByParts: string;
  referencedByPurchaseOrders: string;
  notFound: string;
  permissionDenied: string;
  databaseUnavailable: string;
  createdToast: string;
  updatedToast: string;
  deletedToast: string;
  invalidInput: string;
  configureList: string;
  visibleColumns: string;
  listCountSummary: string;
  currency: string;
  chooseCurrency: string;
  defaultPriceEntryMode: string;
  priceEntryModeNet: string;
  priceEntryModeGross: string;
  priceEntryModeNone: string;
  defaultTaxRate: string;
  defaultTaxRatePlaceholder: string;
};

type OrganizationsClientProps = {
  canWrite: boolean;
  copy: Copy;
  initialPage: ListPage<OrganizationSummary>;
  workspaceSlug: string;
};

const columnHelper = createColumnHelper<OrganizationSummary>();

function roleLabel(role: string, copy: Copy): string {
  if (role === "manufacturer") return copy.roleManufacturer;
  if (role === "supplier") return copy.roleSupplier;
  return role;
}

function getErrorMsg(copy: Copy, error: string): string {
  switch (error) {
    case "name-required": return copy.nameRequired;
    case "role-required": return copy.roleRequired;
    case "name-taken": return copy.nameTaken;
    case "referenced-by-parts": return copy.referencedByParts;
    case "referenced-by-purchase-orders": return copy.referencedByPurchaseOrders;
    case "not-found": return copy.notFound;
    case "permission-denied": return copy.permissionDenied;
    case "database-unavailable": return copy.databaseUnavailable;
    default: return copy.invalidInput;
  }
}

export function OrganizationsClient({
  canWrite,
  copy,
  initialPage,
  workspaceSlug
}: OrganizationsClientProps) {
  const queryClient = useQueryClient();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const nextToastIdRef = useRef(0);
  const [dialogMode, setDialogMode] = useState<"create" | "edit" | null>(null);
  const [editingOrg, setEditingOrg] = useState<OrganizationSummary | null>(null);
  const [orgPendingDelete, setOrgPendingDelete] = useState<OrganizationSummary | null>(null);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [dialogFormKey, setDialogFormKey] = useState(0);
  const [toastMessages, setToastMessages] = useState<ToastMessage[]>([]);
  const { isResizingColumn, setIsResizingColumn, containerClassName } = useColumnResizeCursor();

  // --- Column configuration ---

  const orgColumns = useMemo<ListColumnDefinition[]>(
    () => [
      { id: "name", label: copy.name, group: "base", defaultWidth: 280, minWidth: 120, sortable: true },
      { id: "roles", label: copy.roles, group: "base", defaultWidth: 200, minWidth: 120 },
      { id: "createdAt", label: copy.createdAt, group: "base", defaultWidth: 160, minWidth: 100 }
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
    storageKey: `oso:list-config:organizations:${workspaceSlug}`,
    columns: orgColumns,
    fixedColumnIds
  });

  const { draggedColumnId, onDragEnd, onStartDrag, onDropOnto } = useColumnDragReorder(setColumnOrder);

  // --- Data ---

  const activeSorting = sorting[0] ?? null;
  const sortDir = activeSorting?.desc ? "desc" : "asc";

  const orgsQuery = useInfiniteQuery({
    queryKey: ["organizations", workspaceSlug, { sorting }] as const,
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam }) => {
      const result = await getOrganizationsPageForWorkspace({
        workspaceSlug,
        cursor: pageParam,
        sortDir
      });
      if (!result.ok) throw new Error(result.error);
      return result.data;
    },
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    placeholderData: keepPreviousData,
    initialData:
      sorting.length === 0
        ? { pages: [initialPage], pageParams: [null] }
        : undefined
  });

  const orgs = useMemo(
    () => orgsQuery.data?.pages.flatMap((p) => p.items) ?? [],
    [orgsQuery.data]
  );

  function reloadOrgs() {
    void queryClient.invalidateQueries({ queryKey: ["organizations", workspaceSlug] });
  }

  // --- Mutations ---

  const createMutation = useMutation({
    mutationFn: createOrganizationAction,
    onSuccess: (result) => {
      if (!result.ok) {
        setFormErrors({ submit: getErrorMsg(copy, result.error) });
        return;
      }
      closeOrgDialog();
      addToast(copy.createdToast);
      reloadOrgs();
    }
  });

  const updateMutation = useMutation({
    mutationFn: updateOrganizationAction,
    onSuccess: (result) => {
      if (!result.ok) {
        setFormErrors({ submit: getErrorMsg(copy, result.error) });
        return;
      }
      closeOrgDialog();
      addToast(copy.updatedToast);
      reloadOrgs();
    }
  });

  const deleteMutation = useMutation({
    mutationFn: deleteOrganizationAction,
    onSuccess: (result) => {
      if (!result.ok) {
        setOrgPendingDelete(null);
        addToast(getErrorMsg(copy, result.error));
        return;
      }
      setOrgPendingDelete(null);
      addToast(copy.deletedToast);
      reloadOrgs();
    }
  });

  // --- Dialog helpers ---

  function openCreateDialog() {
    setEditingOrg(null);
    setDialogMode("create");
    setFormErrors({});
    setDialogFormKey((k) => k + 1);
    window.requestAnimationFrame(() => openDialog(dialogRef.current));
  }

  function openEditDialog(org: OrganizationSummary) {
    setEditingOrg(org);
    setDialogMode("edit");
    setFormErrors({});
    setDialogFormKey((k) => k + 1);
    window.requestAnimationFrame(() => openDialog(dialogRef.current));
  }

  function closeOrgDialog() {
    closeDialog(dialogRef.current);
    setDialogMode(null);
    setEditingOrg(null);
    setFormErrors({});
  }

  function addToast(message: string) {
    const id = getNextToastId(nextToastIdRef);
    setToastMessages((prev) => [...prev, { id, message }]);
  }

  function handleDialogSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const name = (fd.get("name") as string | null) ?? "";
    const roles = ORGANIZATION_ROLES.filter((r) => fd.get(`role-${r}`) === "on");
    const currency = ((fd.get("currency") as string | null) ?? "").trim() || null;
    const defaultPriceEntryMode = ((fd.get("defaultPriceEntryMode") as string | null) ?? "").trim() || null;
    const defaultTaxRate = ((fd.get("defaultTaxRate") as string | null) ?? "").trim() || null;

    if (!name.trim()) {
      setFormErrors({ name: copy.nameRequired });
      return;
    }
    if (roles.length === 0) {
      setFormErrors({ roles: copy.roleRequired });
      return;
    }

    setFormErrors({});
    if (dialogMode === "create") {
      createMutation.mutate({ workspaceSlug, name, roles: [...roles], currency, defaultPriceEntryMode, defaultTaxRate });
    } else if (dialogMode === "edit" && editingOrg) {
      updateMutation.mutate({ workspaceSlug, id: editingOrg.id, name, roles: [...roles], currency, defaultPriceEntryMode, defaultTaxRate });
    }
  }

  const isMutating = createMutation.isPending || updateMutation.isPending;

  // --- TanStack Table ---

  const columns = useMemo(
    () => [
      columnHelper.accessor("name", {
        header: copy.name,
        size: 280,
        minSize: 120,
        cell: ({ getValue }) => (
          <span className="font-medium text-slate-950">{getValue()}</span>
        )
      }),
      columnHelper.accessor("roles", {
        header: copy.roles,
        size: 200,
        minSize: 120,
        enableSorting: false,
        cell: ({ getValue }) => {
          const roles = getValue();
          if (roles.length === 0) return <EmptyCell />;
          return (
            <span className="flex flex-wrap gap-1">
              {roles.map((r) => (
                <span
                  key={r}
                  className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700"
                >
                  {roleLabel(r, copy)}
                </span>
              ))}
            </span>
          );
        }
      }),
      columnHelper.accessor("createdAt", {
        header: copy.createdAt,
        size: 160,
        minSize: 100,
        enableSorting: false,
        cell: ({ getValue }) => (
          <span className="text-slate-500">
            {new Date(getValue()).toLocaleDateString("en-US", {
              year: "numeric",
              month: "short",
              day: "numeric"
            })}
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
              aria-label={copy.edit}
              className="min-h-8 rounded-md border border-slate-300 bg-white px-2.5 py-1 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400"
              disabled={!canWrite}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                openEditDialog(row.original);
              }}
            >
              <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                <path d="M13.9 3.3a1.5 1.5 0 0 1 2.1 0l.7.7a1.5 1.5 0 0 1 0 2.1l-8.4 8.4-3.3.8.8-3.3 8.4-8.4Z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
              </svg>
            </button>
            <button
              aria-label={copy.delete}
              className="min-h-8 rounded-md border border-[var(--color-error-border)] bg-white px-2.5 py-1 text-sm font-medium text-[var(--color-error)] transition hover:bg-[var(--color-error-soft)] focus:outline-none focus:ring-2 focus:ring-[var(--color-error-border)] focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400"
              disabled={!canWrite || deleteMutation.isPending}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setOrgPendingDelete(row.original);
              }}
            >
              <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                <path d="M5.5 6h9m-7.5 0V4.75A1.75 1.75 0 0 1 8.75 3h2.5A1.75 1.75 0 0 1 13 4.75V6m-6.5 0 .6 9.1A1.75 1.75 0 0 0 8.84 16.75h2.32a1.75 1.75 0 0 0 1.74-1.65L13.5 6M8.75 8.5v5m2.5-5v5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
              </svg>
            </button>
          </div>
        )
      })
    ],
    [canWrite, copy, deleteMutation.isPending]
  );

  const tableColumnOrder = useMemo(() => persistedColumnOrder, [persistedColumnOrder]);

  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: orgs,
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
      <div className={`flex min-h-0 flex-1 flex-col overflow-hidden ${containerClassName}`}>
        <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <ListPageToolbar
            columnVisibility={columnVisibility}
            configurableColumns={configurableColumns}
            configureListLabel={copy.configureList}
            filteredCount={orgsQuery.data?.pages[0]?.filteredCount}
            formatCount={(visible, total) =>
              copy.listCountSummary
                .replace("{visible}", String(visible))
                .replace("{total}", String(total))
            }
            totalCount={orgsQuery.data?.pages[0]?.totalCount}
            visibleColumnsLabel={copy.visibleColumns}
            setColumnVisible={setColumnVisible}
            primaryAction={
              <button
                className="inline-flex min-h-9 items-center rounded-md bg-[var(--color-accent)] px-4 text-sm font-semibold text-white transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={!canWrite}
                type="button"
                onClick={openCreateDialog}
              >
                {copy.addOrganization}
              </button>
            }
          />

          <InfiniteListViewport
            emptyState={
              <p className="px-4 py-10 text-sm text-slate-500">{copy.noOrganizations}</p>
            }
            errorState={
              <p className="px-4 py-10 text-sm text-[var(--color-error)]">{copy.loadError}</p>
            }
            hasNextPage={orgsQuery.hasNextPage}
            isEmpty={orgs.length === 0}
            isError={orgsQuery.isError}
            isFetchingNextPage={orgsQuery.isFetchingNextPage}
            isInitialLoading={!isConfigLoaded || orgsQuery.isLoading}
            loadMore={() => void orgsQuery.fetchNextPage()}
            loadingLabel={copy.loadingOrganizations}
            loadingMoreLabel={copy.loadingMore}
          >
            <table
              className="table-fixed border-separate border-spacing-0 text-left text-sm"
              style={{ width: table.getTotalSize() }}
            >
              <colgroup>
                {table.getVisibleLeafColumns().map((col) => (
                  <col key={col.id} style={{ width: col.getSize() }} />
                ))}
              </colgroup>
              <thead className="sticky top-0 z-10 bg-slate-50">
                {table.getHeaderGroups().map((headerGroup) => (
                  <tr key={headerGroup.id}>
                    {headerGroup.headers.map((header) => (
                      <ListTableHeaderCell
                        key={header.id}
                        columnDefs={orgColumns}
                        draggedColumnId={draggedColumnId}
                        header={header}
                        isResizingColumn={isResizingColumn}
                        setColumnSorting={setColumnSorting}
                        setColumnWidth={setColumnWidth}
                        setIsResizingColumn={setIsResizingColumn}
                        onDragEnd={onDragEnd}
                        onDropOnto={onDropOnto}
                        onStartDrag={onStartDrag}
                      />
                    ))}
                  </tr>
                ))}
              </thead>
              <tbody className="bg-white">
                {table.getRowModel().rows.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50">
                    {row.getVisibleCells().map((cell) => (
                      <td
                        key={cell.id}
                        className={`overflow-hidden border-b border-slate-100 px-2 py-2 text-slate-700 ${
                          cell.column.id === "actions"
                            ? "sticky right-0 z-10 bg-white px-1 py-1.5 hover:bg-slate-50"
                            : ""
                        }`}
                        style={{ width: cell.column.getSize() }}
                      >
                        <div className="overflow-hidden text-ellipsis">
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </div>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </InfiniteListViewport>
        </section>
      </div>

      {/* Create / Edit dialog */}
      <DialogShell
        ref={dialogRef}
        closeLabel={copy.close}
        title={dialogMode === "edit" ? copy.editOrganizationTitle : copy.newOrganizationTitle}
        titleId="org-dialog-title"
        onClose={closeOrgDialog}
      >
        <form key={dialogFormKey} onSubmit={handleDialogSubmit}>
          <DialogBody>
            <div className="grid gap-4">
              <div className="grid gap-1">
                <LabelWithError error={formErrors.name} htmlFor="org-name">
                  {copy.name}
                </LabelWithError>
                <input
                  autoComplete="off"
                  className={`w-full rounded-md border px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] ${
                    formErrors.name
                      ? "border-[var(--color-error-border)] focus:ring-[var(--color-error-border)]"
                      : "border-slate-300"
                  }`}
                  data-dialog-initial-focus
                  defaultValue={editingOrg?.name ?? ""}
                  id="org-name"
                  name="name"
                  placeholder={copy.namePlaceholder}
                  type="text"
                />
              </div>

              <fieldset>
                <legend
                  className={`mb-2 block text-sm font-medium ${
                    formErrors.roles ? "text-[var(--color-error)]" : "text-slate-700"
                  }`}
                >
                  {copy.roles}
                  {formErrors.roles ? (
                    <span className="ml-2 text-xs font-normal text-[var(--color-error)]">
                      — {formErrors.roles}
                    </span>
                  ) : null}
                </legend>
                <div className="flex flex-col gap-2">
                  {ORGANIZATION_ROLES.map((role) => (
                    <label
                      key={role}
                      className="flex cursor-pointer items-center gap-2 text-sm text-slate-700"
                    >
                      <input
                        className="h-4 w-4 rounded border-slate-300 text-[var(--color-accent)] focus:ring-[var(--color-accent)]"
                        defaultChecked={editingOrg?.roles.includes(role) ?? false}
                        name={`role-${role}`}
                        type="checkbox"
                      />
                      {roleLabel(role, copy)}
                    </label>
                  ))}
                </div>
              </fieldset>

              <div className="grid gap-1">
                <label className="block text-sm font-medium text-slate-700" htmlFor="org-currency">
                  {copy.currency}
                </label>
                <select
                  id="org-currency"
                  name="currency"
                  defaultValue={editingOrg?.currency ?? ""}
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
                >
                  <option value="">{copy.chooseCurrency}</option>
                  {CURRENCIES.map((c) => (
                    <option key={c.code} value={c.code}>{c.code}</option>
                  ))}
                </select>
              </div>

              <div className="grid gap-1">
                <label className="block text-sm font-medium text-slate-700" htmlFor="org-price-entry-mode">
                  {copy.defaultPriceEntryMode}
                </label>
                <select
                  id="org-price-entry-mode"
                  name="defaultPriceEntryMode"
                  defaultValue={editingOrg?.defaultPriceEntryMode ?? ""}
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
                >
                  <option value="">{copy.priceEntryModeNone}</option>
                  <option value="net">{copy.priceEntryModeNet}</option>
                  <option value="gross">{copy.priceEntryModeGross}</option>
                </select>
              </div>

              <div className="grid gap-1">
                <label className="block text-sm font-medium text-slate-700" htmlFor="org-default-tax-rate">
                  {copy.defaultTaxRate}
                </label>
                <input
                  id="org-default-tax-rate"
                  name="defaultTaxRate"
                  type="text"
                  inputMode="decimal"
                  placeholder={copy.defaultTaxRatePlaceholder}
                  defaultValue={editingOrg?.defaultTaxRate ?? ""}
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
                />
              </div>
            </div>

            {formErrors.submit ? (
              <div className="relative mt-4">
                <ErrorBubble>{formErrors.submit}</ErrorBubble>
              </div>
            ) : null}
          </DialogBody>

          <DialogFooter>
            <button
              className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2"
              type="button"
              onClick={closeOrgDialog}
            >
              {copy.cancel}
            </button>
            <button
              className="rounded-md bg-[var(--color-accent)] px-4 py-2 text-sm font-semibold text-white transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isMutating}
              type="submit"
            >
              {dialogMode === "edit" ? copy.saveChanges : copy.createOrganization}
            </button>
          </DialogFooter>
        </form>
      </DialogShell>

      {/* Delete confirmation */}
      <DeleteConfirmationDialog
        body={copy.deleteConfirmationBody}
        cancelLabel={copy.cancelDelete}
        closeLabel={copy.close}
        confirmLabel={copy.confirmDelete}
        deleteLabel={copy.deleteOrganization}
        isPending={deleteMutation.isPending}
        itemName={orgPendingDelete?.name ?? ""}
        open={Boolean(orgPendingDelete)}
        onCancel={() => setOrgPendingDelete(null)}
        onConfirm={() => {
          if (orgPendingDelete) {
            deleteMutation.mutate({ workspaceSlug, id: orgPendingDelete.id });
          }
        }}
      />

      <ToastNotice
        messages={toastMessages}
        onDismiss={(id) => setToastMessages((m) => m.filter((t) => t.id !== id))}
      />
    </>
  );
}
