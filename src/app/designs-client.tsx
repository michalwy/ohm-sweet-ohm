"use client";

import { useMemo, useRef, useState } from "react";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable
} from "@tanstack/react-table";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import {
  addRevisionToDesignAction,
  createDesignAction,
  deleteDesignAction,
  getDesignDetailAction,
  getNextDesignCatalogNumberAction,
  updateDesignAction,
  updateDesignRevisionAction
} from "@/server/designs/designActions";
import type { DesignDetail, DesignSummary } from "@/server/designs/designActions";
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
import { EmptyCell } from "@/app/list-table-cell";
import {
  useListTableConfiguration,
  type ListColumnDefinition
} from "@/app/list-table-config";
import {
  ListPageToolbar,
  ListTableHeaderCell,
  useColumnDragReorder,
  useColumnResizeCursor
} from "@/app/list-page-toolbar";
import { useDesignsQuery } from "@/app/use-designs-query";

type Copy = {
  title: string;
  intro: string;
  configureList: string;
  visibleColumns: string;
  newDesign: string;
  newDesignTitle: string;
  editDesignTitle: string;
  name: string;
  namePlaceholder: string;
  description: string;
  descriptionPlaceholder: string;
  catalogNumber: string;
  catalogNumberPlaceholder: string;
  outputPart: string;
  revisions: string;
  latestRevision: string;
  createdAt: string;
  actions: string;
  edit: string;
  delete: string;
  close: string;
  cancel: string;
  cancelDelete: string;
  confirmDelete: string;
  deleteConfirmationBody: string;
  createDesign: string;
  saveChanges: string;
  noDesigns: string;
  noDesignsBody: string;
  loadingDesigns: string;
  loadingMoreDesigns: string;
  loadError: string;
  nameRequired: string;
  catalogNumberRequired: string;
  catalogNumberTaken: string;
  outputPartHasStock: string;
  outputPartHasInventoryHistory: string;
  notFound: string;
  permissionDenied: string;
  databaseUnavailable: string;
  createdToast: string;
  updatedToast: string;
  deletedToast: string;
  invalidInput: string;
  detailsTab: string;
  revisionsTab: string;
  revisionNumber: string;
  revisionNotes: string;
  addRevision: string;
  addRevisionTitle: string;
  notesPlaceholder: string;
  addRevisionConfirm: string;
  noRevisions: string;
  editNotes: string;
  saveNotes: string;
  cancelEdit: string;
};

type DesignsClientProps = {
  canWrite: boolean;
  copy: Copy;
  initialPage: ListPage<DesignSummary>;
  workspaceSlug: string;
};

type EditTab = "details" | "revisions";

const columnHelper = createColumnHelper<DesignSummary>();

function getErrorMsg(copy: Copy, error: string): string {
  switch (error) {
    case "name-required": return copy.nameRequired;
    case "catalog-number-required": return copy.catalogNumberRequired;
    case "catalog-number-taken": return copy.catalogNumberTaken;
    case "output-part-has-stock": return copy.outputPartHasStock;
    case "output-part-has-inventory-history": return copy.outputPartHasInventoryHistory;
    case "not-found": return copy.notFound;
    case "workspace-permission-denied": return copy.permissionDenied;
    case "database-unavailable": return copy.databaseUnavailable;
    default: return copy.invalidInput;
  }
}

export function DesignsClient({ canWrite, copy, initialPage, workspaceSlug }: DesignsClientProps) {
  const queryClient = useQueryClient();
  const createDialogRef = useRef<HTMLDialogElement>(null);
  const editDialogRef = useRef<HTMLDialogElement>(null);
  const nextToastIdRef = useRef(0);

  const [dialogFormKey, setDialogFormKey] = useState(0);
  const [editingDesign, setEditingDesign] = useState<DesignSummary | null>(null);
  const [editDesignDetail, setEditDesignDetail] = useState<DesignDetail | null>(null);
  const [editTab, setEditTab] = useState<EditTab>("details");
  const [designPendingDelete, setDesignPendingDelete] = useState<DesignSummary | null>(null);
  const [toastMessages, setToastMessages] = useState<ToastMessage[]>([]);
  const [globalError, setGlobalError] = useState<string | null>(null);

  // Create form state
  const [createName, setCreateName] = useState("");
  const [createDescription, setCreateDescription] = useState("");
  const [createCatalogNumber, setCreateCatalogNumber] = useState("");
  const [createErrors, setCreateErrors] = useState<Record<string, string>>({});

  // Edit form state
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editErrors, setEditErrors] = useState<Record<string, string>>({});

  // Revision state
  const [showAddRevision, setShowAddRevision] = useState(false);
  const [newRevisionNotes, setNewRevisionNotes] = useState("");
  const [editingRevisionId, setEditingRevisionId] = useState<string | null>(null);
  const [editingRevisionNotes, setEditingRevisionNotes] = useState("");

  // --- Column configuration ---

  const designColumns = useMemo<ListColumnDefinition[]>(
    () => [
      { id: "name", label: copy.name, group: "base", defaultWidth: 240, minWidth: 140, sortable: true },
      { id: "description", label: copy.description, group: "base", defaultWidth: 320, minWidth: 140 },
      { id: "outputPart", label: copy.outputPart, group: "base", defaultWidth: 180, minWidth: 120, sortable: true },
      { id: "revisions", label: copy.revisions, group: "base", defaultWidth: 120, minWidth: 90 },
      { id: "createdAt", label: copy.createdAt, group: "base", defaultWidth: 160, minWidth: 100, sortable: true }
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
    storageKey: `oso:list-config:designs:${workspaceSlug}`,
    columns: designColumns,
    fixedColumnIds
  });

  const { isResizingColumn, setIsResizingColumn, containerClassName } = useColumnResizeCursor();
  const { draggedColumnId, onDragEnd, onStartDrag, onDropOnto } = useColumnDragReorder(setColumnOrder);

  const { currentDesigns, totalCount, isLoading, isError, isFetchingNextPage, hasNextPage, fetchNextPage } =
    useDesignsQuery({ workspaceSlug, initialPage, sorting });

  // --- TanStack Table ---

  const columns = useMemo(
    () => [
      columnHelper.accessor("name", {
        header: copy.name,
        size: 240,
        minSize: 140,
        cell: ({ getValue }) => (
          <span className="font-medium text-[var(--color-text-primary)]">{getValue()}</span>
        )
      }),
      columnHelper.accessor("description", {
        header: copy.description,
        size: 320,
        minSize: 140,
        enableSorting: false,
        cell: ({ getValue }) => {
          const value = getValue();
          return value ? (
            <span className="text-[var(--color-text-secondary)]">{value}</span>
          ) : (
            <EmptyCell />
          );
        }
      }),
      columnHelper.accessor((row) => row.outputPart.catalogNumber, {
        id: "outputPart",
        header: copy.outputPart,
        size: 180,
        minSize: 120,
        cell: ({ getValue }) => (
          <span className="font-mono text-[var(--color-text-primary)]">{getValue()}</span>
        )
      }),
      columnHelper.accessor("revisionCount", {
        id: "revisions",
        header: copy.revisions,
        size: 120,
        minSize: 90,
        enableSorting: false,
        cell: ({ row }) => {
          const { revisionCount, latestRevisionNumber } = row.original;
          if (revisionCount === 0) return <EmptyCell />;
          return (
            <span className="text-[var(--color-text-secondary)]">
              {revisionCount}{latestRevisionNumber !== null ? ` (v${latestRevisionNumber})` : ""}
            </span>
          );
        }
      }),
      columnHelper.accessor("createdAt", {
        header: copy.createdAt,
        size: 160,
        minSize: 100,
        cell: ({ getValue }) => (
          <span className="text-[var(--color-text-secondary)]">
            {new Date(getValue()).toLocaleDateString()}
          </span>
        )
      }),
      columnHelper.display({
        id: "actions",
        header: "",
        size: 120,
        minSize: 120,
        maxSize: 120,
        enableResizing: false,
        cell: ({ row }) =>
          canWrite ? (
            <div className="flex justify-end gap-2">
              <button
                aria-label={copy.edit}
                title={copy.edit}
                className="min-h-8 rounded-md border border-[var(--color-border-strong)] bg-[var(--color-bg-elevated)] px-2.5 py-1 text-sm font-medium text-[var(--color-text-secondary)] transition hover:border-[var(--color-border-hover)] hover:bg-[var(--color-bg-subtle)] focus:outline-none focus:ring-2 focus:ring-[var(--color-ring-strong)] focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-[var(--color-bg-subtle)] disabled:text-[var(--color-text-placeholder)]"
                type="button"
                onClick={() => openEditDialog(row.original)}
              >
                <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                  <path d="M13.9 3.3a1.5 1.5 0 0 1 2.1 0l.7.7a1.5 1.5 0 0 1 0 2.1l-8.4 8.4-3.3.8.8-3.3 8.4-8.4Z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
                </svg>
              </button>
              <button
                aria-label={copy.delete}
                title={copy.delete}
                className="min-h-8 rounded-md border border-[var(--color-error-border)] bg-[var(--color-bg-elevated)] px-2.5 py-1 text-sm font-medium text-[var(--color-error)] transition hover:bg-[var(--color-error-soft)] focus:outline-none focus:ring-2 focus:ring-[var(--color-error-border)] focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-[var(--color-bg-subtle)] disabled:text-[var(--color-text-placeholder)]"
                type="button"
                onClick={() => setDesignPendingDelete(row.original)}
              >
                <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                  <path d="M5.5 6h9m-7.5 0V4.75A1.75 1.75 0 0 1 8.75 3h2.5A1.75 1.75 0 0 1 13 4.75V6m-6.5 0 .6 9.1A1.75 1.75 0 0 0 8.84 16.75h2.32a1.75 1.75 0 0 0 1.74-1.65L13.5 6M8.75 8.5v5m2.5-5v5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
                </svg>
              </button>
            </div>
          ) : null
      })
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [copy, canWrite]
  );

  const tableColumnOrder = useMemo(() => persistedColumnOrder, [persistedColumnOrder]);

  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: currentDesigns,
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

  // --- Mutations ---

  const createMutation = useMutation({
    mutationFn: async (input: { name: string; description: string; catalogNumber: string }) => {
      const result = await createDesignAction({
        workspaceSlug,
        name: input.name,
        description: input.description || null,
        catalogNumber: input.catalogNumber
      });
      if (!result.ok) throw new Error(result.error);
      return result.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["designs", workspaceSlug] });
      void queryClient.invalidateQueries({ queryKey: ["parts-list", workspaceSlug] });
      closeDialog(createDialogRef.current);
      setToastMessages((prev) => [
        ...prev,
        { id: getNextToastId(nextToastIdRef), message: copy.createdToast }
      ]);
    },
    onError: (error) => {
      const msg = error instanceof Error ? error.message.replaceAll("_", "-") : "invalid-input";
      setGlobalError(getErrorMsg(copy, msg));
    }
  });

  const updateMutation = useMutation({
    mutationFn: async (input: { designId: string; name: string; description: string }) => {
      const result = await updateDesignAction({
        workspaceSlug,
        designId: input.designId,
        name: input.name,
        description: input.description || null
      });
      if (!result.ok) throw new Error(result.error);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["designs", workspaceSlug] });
      closeDialog(editDialogRef.current);
      setToastMessages((prev) => [
        ...prev,
        { id: getNextToastId(nextToastIdRef), message: copy.updatedToast }
      ]);
    },
    onError: (error) => {
      const msg = error instanceof Error ? error.message.replaceAll("_", "-") : "invalid-input";
      setEditErrors({ name: getErrorMsg(copy, msg) });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (designId: string) => {
      const result = await deleteDesignAction({ workspaceSlug, designId });
      if (!result.ok) throw new Error(result.error);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["designs", workspaceSlug] });
      void queryClient.invalidateQueries({ queryKey: ["parts-list", workspaceSlug] });
      setDesignPendingDelete(null);
      setToastMessages((prev) => [
        ...prev,
        { id: getNextToastId(nextToastIdRef), message: copy.deletedToast }
      ]);
    },
    onError: (error) => {
      const msg = error instanceof Error ? error.message.replaceAll("_", "-") : "invalid-input";
      setGlobalError(getErrorMsg(copy, msg));
      setDesignPendingDelete(null);
    }
  });

  const addRevisionMutation = useMutation({
    mutationFn: async (input: { designId: string; notes: string }) => {
      const result = await addRevisionToDesignAction({
        workspaceSlug,
        designId: input.designId,
        notes: input.notes || null
      });
      if (!result.ok) throw new Error(result.error);
      return result.data;
    },
    onSuccess: async () => {
      void queryClient.invalidateQueries({ queryKey: ["designs", workspaceSlug] });
      setShowAddRevision(false);
      setNewRevisionNotes("");
      if (editingDesign) await refreshEditDetail(editingDesign.id);
    }
  });

  const updateRevisionNotesMutation = useMutation({
    mutationFn: async (input: { revisionId: string; notes: string }) => {
      const result = await updateDesignRevisionAction({
        workspaceSlug,
        revisionId: input.revisionId,
        notes: input.notes || null
      });
      if (!result.ok) throw new Error(result.error);
    },
    onSuccess: async () => {
      setEditingRevisionId(null);
      setEditingRevisionNotes("");
      if (editingDesign) await refreshEditDetail(editingDesign.id);
    }
  });

  // --- Handlers ---

  function openCreateDialog() {
    setCreateName("");
    setCreateDescription("");
    setCreateCatalogNumber("");
    setCreateErrors({});
    setGlobalError(null);
    setDialogFormKey((k) => k + 1);
    window.requestAnimationFrame(() => {
      openDialog(createDialogRef.current);
      void getNextDesignCatalogNumberAction({ workspaceSlug }).then((result) => {
        if (result.ok) setCreateCatalogNumber(result.data);
      });
    });
  }

  async function refreshEditDetail(designId: string) {
    const result = await getDesignDetailAction({ workspaceSlug, designId });
    if (result.ok && result.data) setEditDesignDetail(result.data);
  }

  function openEditDialog(design: DesignSummary) {
    setEditingDesign(design);
    setEditName(design.name);
    setEditDescription(design.description ?? "");
    setEditErrors({});
    setGlobalError(null);
    setEditTab("details");
    setShowAddRevision(false);
    setNewRevisionNotes("");
    setEditingRevisionId(null);
    setEditDesignDetail(null);
    setDialogFormKey((k) => k + 1);
    window.requestAnimationFrame(() => {
      openDialog(editDialogRef.current);
      void refreshEditDetail(design.id);
    });
  }

  function handleCreateSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errors: Record<string, string> = {};
    if (!createName.trim()) errors.name = copy.nameRequired;
    if (!createCatalogNumber.trim()) errors.catalogNumber = copy.catalogNumberRequired;
    if (Object.keys(errors).length > 0) { setCreateErrors(errors); return; }
    setGlobalError(null);
    createMutation.mutate({
      name: createName,
      description: createDescription,
      catalogNumber: createCatalogNumber
    });
  }

  function handleEditSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingDesign) return;
    const errors: Record<string, string> = {};
    if (!editName.trim()) errors.name = copy.nameRequired;
    if (Object.keys(errors).length > 0) { setEditErrors(errors); return; }
    setGlobalError(null);
    updateMutation.mutate({
      designId: editingDesign.id,
      name: editName,
      description: editDescription
    });
  }

  function handleAddRevision() {
    if (!editingDesign) return;
    addRevisionMutation.mutate({ designId: editingDesign.id, notes: newRevisionNotes });
  }

  function handleSaveRevisionNotes(revisionId: string) {
    updateRevisionNotesMutation.mutate({ revisionId, notes: editingRevisionNotes });
  }

  const isMutating = createMutation.isPending || updateMutation.isPending;

  // --- Render ---

  return (
    <div className={`flex min-h-0 flex-1 flex-col overflow-hidden ${containerClassName}`}>
      <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elevated)] shadow-sm">
        <ListPageToolbar
          totalCount={totalCount}
          formatCount={(_visible, total) => `${total} ${total === 1 ? "design" : "designs"}`}
          configurableColumns={configurableColumns}
          columnVisibility={columnVisibility}
          setColumnVisible={setColumnVisible}
          configureListLabel={copy.configureList}
          visibleColumnsLabel={copy.visibleColumns}
          primaryAction={
            canWrite ? (
              <button
                className="inline-flex min-h-9 items-center rounded-md bg-[var(--color-accent)] px-4 text-sm font-semibold text-white transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
                type="button"
                onClick={() => void openCreateDialog()}
              >
                {copy.newDesign}
              </button>
            ) : null
          }
        />

        <InfiniteListViewport
          isEmpty={currentDesigns.length === 0}
          isInitialLoading={!isConfigLoaded || isLoading}
          isError={isError}
          hasNextPage={hasNextPage}
          isFetchingNextPage={isFetchingNextPage}
          loadingLabel={copy.loadingDesigns}
          loadingMoreLabel={copy.loadingMoreDesigns}
          loadMore={() => void fetchNextPage()}
          emptyState={
            <div className="flex flex-1 flex-col items-center justify-center gap-2 py-20 text-center">
              <p className="text-base font-medium text-[var(--color-text-primary)]">{copy.noDesigns}</p>
              <p className="text-sm text-[var(--color-text-muted)]">{copy.noDesignsBody}</p>
            </div>
          }
          errorState={<p className="px-4 py-10 text-sm text-[var(--color-error)]">{copy.loadError}</p>}
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
            <thead className="sticky top-0 z-10 bg-[var(--color-bg-subtle)]">
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <ListTableHeaderCell
                      key={header.id}
                      columnDefs={designColumns}
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
            <tbody className="bg-[var(--color-bg-elevated)]">
              {table.getRowModel().rows.map((row) => (
                <tr key={row.id} className="hover:bg-[var(--color-bg-subtle)]">
                  {row.getVisibleCells().map((cell) => (
                    <td
                      key={cell.id}
                      className={`overflow-hidden border-b border-[var(--color-border)] px-2 py-2 text-[var(--color-text-secondary)] ${
                        cell.column.id === "actions"
                          ? "sticky right-0 z-10 bg-[var(--color-bg-elevated)] px-1 py-1.5"
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

      {/* Create dialog */}
      <DialogShell
        ref={createDialogRef}
        title={copy.newDesignTitle}
        titleId="create-design-title"
        closeLabel={copy.close}
        onClose={() => closeDialog(createDialogRef.current)}
      >
        <form key={dialogFormKey} className="flex min-h-0 flex-1 flex-col" onSubmit={handleCreateSubmit}>
          <DialogBody>
            <div className="grid gap-4">
              {globalError && <ErrorBubble>{globalError}</ErrorBubble>}
              <div>
                <LabelWithError htmlFor="create-design-name" error={createErrors.name}>
                  {copy.name}
                </LabelWithError>
                <input
                  id="create-design-name"
                  className="mt-1 w-full rounded-md border border-[var(--color-border-strong)] bg-[var(--color-bg-input)] px-3 py-2 text-sm text-[var(--color-text-primary)] placeholder-[var(--color-text-placeholder)] focus:border-[var(--color-accent)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]"
                  placeholder={copy.namePlaceholder}
                  type="text"
                  value={createName}
                  onChange={(e) => { setCreateName(e.target.value); setCreateErrors((prev) => ({ ...prev, name: "" })); }}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-[var(--color-text-primary)]" htmlFor="create-design-description">
                  {copy.description}
                </label>
                <input
                  id="create-design-description"
                  className="mt-1 w-full rounded-md border border-[var(--color-border-strong)] bg-[var(--color-bg-input)] px-3 py-2 text-sm text-[var(--color-text-primary)] placeholder-[var(--color-text-placeholder)] focus:border-[var(--color-accent)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]"
                  placeholder={copy.descriptionPlaceholder}
                  type="text"
                  value={createDescription}
                  onChange={(e) => setCreateDescription(e.target.value)}
                />
              </div>
              <div>
                <LabelWithError htmlFor="create-design-catalog" error={createErrors.catalogNumber}>
                  {copy.catalogNumber}
                </LabelWithError>
                <input
                  id="create-design-catalog"
                  className="mt-1 w-full rounded-md border border-[var(--color-border-strong)] bg-[var(--color-bg-input)] px-3 py-2 font-mono text-sm text-[var(--color-text-primary)] placeholder-[var(--color-text-placeholder)] focus:border-[var(--color-accent)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]"
                  placeholder={copy.catalogNumberPlaceholder}
                  type="text"
                  value={createCatalogNumber}
                  onChange={(e) => { setCreateCatalogNumber(e.target.value); setCreateErrors((prev) => ({ ...prev, catalogNumber: "" })); }}
                />
              </div>
            </div>
          </DialogBody>
          <DialogFooter className="justify-end gap-3">
            <button
              className="rounded-md border border-[var(--color-border-strong)] px-4 py-2 text-sm font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-subtle)]"
              type="button"
              onClick={() => closeDialog(createDialogRef.current)}
            >
              {copy.cancel}
            </button>
            <button
              className="rounded-md bg-[var(--color-action-primary)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--color-action-primary-hover)] disabled:opacity-50"
              type="submit"
              disabled={isMutating}
            >
              {copy.createDesign}
            </button>
          </DialogFooter>
        </form>
      </DialogShell>

      {/* Edit dialog */}
      {editingDesign && (
        <DialogShell
          ref={editDialogRef}
          title={copy.editDesignTitle}
          titleId="edit-design-title"
          closeLabel={copy.close}
          heightClassName="h-[min(calc(100vh-2rem),560px)]"
          onClose={() => closeDialog(editDialogRef.current)}
        >
          <div className="flex min-h-0 flex-1 flex-col">
            {/* Tabs */}
            <div className="shrink-0 border-b border-[var(--color-border)] px-5">
              <div className="flex gap-2">
                {(["details", "revisions"] as EditTab[]).map((tab) => (
                  <button
                    key={tab}
                    className={`min-h-10 border-b-2 px-3 text-sm font-medium ${
                      editTab === tab
                        ? "border-[var(--color-accent)] text-[var(--color-text-primary)]"
                        : "border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]"
                    }`}
                    type="button"
                    onClick={() => setEditTab(tab)}
                  >
                    {tab === "details" ? copy.detailsTab : copy.revisionsTab}
                  </button>
                ))}
              </div>
            </div>

            {editTab === "details" ? (
              <form
                key={`edit-${dialogFormKey}`}
                className="flex min-h-0 flex-1 flex-col"
                onSubmit={handleEditSubmit}
              >
                <DialogBody>
                  <div className="grid gap-4">
                    {globalError && <ErrorBubble>{globalError}</ErrorBubble>}
                    <div>
                      <LabelWithError htmlFor="edit-design-name" error={editErrors.name}>
                        {copy.name}
                      </LabelWithError>
                      <input
                        id="edit-design-name"
                        className="mt-1 w-full rounded-md border border-[var(--color-border-strong)] bg-[var(--color-bg-input)] px-3 py-2 text-sm text-[var(--color-text-primary)] focus:border-[var(--color-accent)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]"
                        type="text"
                        value={editName}
                        onChange={(e) => { setEditName(e.target.value); setEditErrors((prev) => ({ ...prev, name: "" })); }}
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-[var(--color-text-primary)]" htmlFor="edit-design-description">
                        {copy.description}
                      </label>
                      <input
                        id="edit-design-description"
                        className="mt-1 w-full rounded-md border border-[var(--color-border-strong)] bg-[var(--color-bg-input)] px-3 py-2 text-sm text-[var(--color-text-primary)] focus:border-[var(--color-accent)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]"
                        type="text"
                        value={editDescription}
                        onChange={(e) => setEditDescription(e.target.value)}
                      />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-[var(--color-text-primary)]">{copy.outputPart}</p>
                      <p className="mt-1 font-mono text-sm text-[var(--color-text-secondary)]">
                        {editingDesign.outputPart.catalogNumber}
                      </p>
                    </div>
                  </div>
                </DialogBody>
                <DialogFooter className="justify-end gap-3">
                  <button
                    className="rounded-md border border-[var(--color-border-strong)] px-4 py-2 text-sm font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-subtle)]"
                    type="button"
                    onClick={() => closeDialog(editDialogRef.current)}
                  >
                    {copy.cancel}
                  </button>
                  <button
                    className="rounded-md bg-[var(--color-action-primary)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--color-action-primary-hover)] disabled:opacity-50"
                    type="submit"
                    disabled={isMutating}
                  >
                    {copy.saveChanges}
                  </button>
                </DialogFooter>
              </form>
            ) : (
              /* Revisions tab */
              <div className="flex min-h-0 flex-1 flex-col">
                <DialogBody>
                  {!editDesignDetail ? (
                    <p className="text-sm text-[var(--color-text-muted)]">{copy.loadingDesigns}</p>
                  ) : editDesignDetail.revisions.length === 0 ? (
                    <p className="text-sm text-[var(--color-text-muted)]">{copy.noRevisions}</p>
                  ) : (
                    <table className="w-full border-collapse text-sm">
                      <thead>
                        <tr className="border-b border-[var(--color-border)]">
                          <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
                            {copy.revisionNumber}
                          </th>
                          <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
                            {copy.revisionNotes}
                          </th>
                          {canWrite && (
                            <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
                              {copy.actions}
                            </th>
                          )}
                        </tr>
                      </thead>
                      <tbody>
                        {editDesignDetail.revisions.map((rev) => (
                          <tr key={rev.id} className="border-b border-[var(--color-border)]">
                            <td className="px-3 py-2 font-medium text-[var(--color-text-primary)]">
                              v{rev.revisionNumber}
                            </td>
                            <td className="px-3 py-2">
                              {editingRevisionId === rev.id ? (
                                <input
                                  className="w-full rounded border border-[var(--color-accent)] bg-[var(--color-bg-input)] px-2 py-1 text-sm text-[var(--color-text-primary)] focus:outline-none"
                                  type="text"
                                  value={editingRevisionNotes}
                                  onChange={(e) => setEditingRevisionNotes(e.target.value)}
                                />
                              ) : rev.notes ? (
                                <span className="text-[var(--color-text-secondary)]">{rev.notes}</span>
                              ) : (
                                <EmptyCell />
                              )}
                            </td>
                            {canWrite && (
                              <td className="px-3 py-2">
                                {editingRevisionId === rev.id ? (
                                  <div className="flex gap-2">
                                    <button
                                      className="rounded px-2 py-1 text-xs font-medium text-[var(--color-accent)] hover:bg-[var(--color-accent-soft)]"
                                      type="button"
                                      onClick={() => handleSaveRevisionNotes(rev.id)}
                                      disabled={updateRevisionNotesMutation.isPending}
                                    >
                                      {copy.saveNotes}
                                    </button>
                                    <button
                                      className="rounded px-2 py-1 text-xs font-medium text-[var(--color-text-muted)] hover:bg-[var(--color-bg-subtle)]"
                                      type="button"
                                      onClick={() => { setEditingRevisionId(null); setEditingRevisionNotes(""); }}
                                    >
                                      {copy.cancelEdit}
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    className="rounded px-2 py-1 text-xs font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-subtle)]"
                                    type="button"
                                    onClick={() => {
                                      setEditingRevisionId(rev.id);
                                      setEditingRevisionNotes(rev.notes ?? "");
                                    }}
                                  >
                                    {copy.editNotes}
                                  </button>
                                )}
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}

                  {/* Add revision */}
                  {canWrite && (
                    <div className="mt-4">
                      {showAddRevision ? (
                        <div className="rounded-md border border-[var(--color-border)] p-3">
                          <p className="mb-2 text-sm font-medium text-[var(--color-text-primary)]">{copy.addRevisionTitle}</p>
                          <input
                            className="w-full rounded-md border border-[var(--color-border-strong)] bg-[var(--color-bg-input)] px-3 py-2 text-sm text-[var(--color-text-primary)] placeholder-[var(--color-text-placeholder)] focus:border-[var(--color-accent)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]"
                            placeholder={copy.notesPlaceholder}
                            type="text"
                            value={newRevisionNotes}
                            onChange={(e) => setNewRevisionNotes(e.target.value)}
                          />
                          <div className="mt-2 flex gap-2">
                            <button
                              className="rounded-md bg-[var(--color-action-primary)] px-3 py-1.5 text-sm font-medium text-white hover:bg-[var(--color-action-primary-hover)] disabled:opacity-50"
                              type="button"
                              onClick={handleAddRevision}
                              disabled={addRevisionMutation.isPending}
                            >
                              {copy.addRevisionConfirm}
                            </button>
                            <button
                              className="rounded-md border border-[var(--color-border-strong)] px-3 py-1.5 text-sm font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-subtle)]"
                              type="button"
                              onClick={() => { setShowAddRevision(false); setNewRevisionNotes(""); }}
                            >
                              {copy.cancel}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          className="rounded-md border border-[var(--color-border-strong)] px-3 py-2 text-sm font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-subtle)]"
                          type="button"
                          onClick={() => setShowAddRevision(true)}
                        >
                          {copy.addRevision}
                        </button>
                      )}
                    </div>
                  )}
                </DialogBody>
                <DialogFooter className="justify-end gap-3">
                  <button
                    className="rounded-md border border-[var(--color-border-strong)] px-4 py-2 text-sm font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-subtle)]"
                    type="button"
                    onClick={() => closeDialog(editDialogRef.current)}
                  >
                    {copy.close}
                  </button>
                </DialogFooter>
              </div>
            )}
          </div>
        </DialogShell>
      )}

      {/* Delete confirmation */}
      {designPendingDelete && (
        <DeleteConfirmationDialog
          open
          body={copy.deleteConfirmationBody}
          cancelLabel={copy.cancelDelete}
          closeLabel={copy.close}
          confirmLabel={copy.confirmDelete}
          deleteLabel={copy.delete}
          isPending={deleteMutation.isPending}
          itemName={designPendingDelete.name}
          onCancel={() => setDesignPendingDelete(null)}
          onConfirm={() => deleteMutation.mutate(designPendingDelete.id)}
        />
      )}

      {/* Global error toast */}
      {globalError && (
        <div className="fixed bottom-4 right-4 rounded-md bg-[var(--color-error)] px-4 py-3 text-sm text-white shadow-lg">
          {globalError}
        </div>
      )}

      {/* Toast messages */}
      <ToastNotice messages={toastMessages} onDismiss={(id) => setToastMessages((prev) => prev.filter((m) => m.id !== id))} />
    </div>
  );
}
