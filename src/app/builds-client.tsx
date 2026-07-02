"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable
} from "@tanstack/react-table";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  allocateBuildLineAction,
  assembleDesignatorAction,
  cancelBuildAction,
  createBuildAction,
  deleteBuildAction,
  getBuildCreateOptionsAction,
  getBuildDetailAction,
  markBuildAllocatedAction,
  reopenBuildAction,
  startBuildAction,
  type BuildDetail,
  type BuildSummary
} from "@/server/builds/buildActions";
import type { ListPage } from "@/server/pagination";
import type { StorageLocationListItem } from "@/server/inventory/locationMutations";
import {
  closeDialog,
  DialogActions,
  DialogBody,
  DialogShell,
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
import { useBuildsQuery } from "@/app/use-builds-query";
import { DetailPanel, useDetailsPanelWidth } from "@/app/detail-panel";
import { buildTree } from "@/app/tree-picker-utils";
import { PartLink } from "@/app/entity-links";
import {
  LocationTreeSelect,
  formLocationSelectButtonClassName,
  type LocationTreeSelectCopy
} from "@/app/location-tree-select";

export type BuildsCopy = {
  title: string;
  intro: string;
  configureList: string;
  visibleColumns: string;
  newBuild: string;
  newBuildTitle: string;
  design: string;
  revision: string;
  targetQuantity: string;
  state: string;
  progress: string;
  createdAt: string;
  close: string;
  cancel: string;
  outputLocation: string;
  outputPart: string;
  selectDesign: string;
  selectRevision: string;
  selectLocation: string;
  createBuild: string;
  noBuilds: string;
  noBuildsBody: string;
  loadingBuilds: string;
  loadingMoreBuilds: string;
  loadError: string;
  designRequired: string;
  revisionRequired: string;
  targetQuantityRequired: string;
  permissionDenied: string;
  databaseUnavailable: string;
  invalidInput: string;
  createdToast: string;
  bom: string;
  designators: string;
  part: string;
  sourceLocation: string;
  unassigned: string;
  available: string;
  markAllocated: string;
  reopen: string;
  start: string;
  cancelBuild: string;
  deleteBuild: string;
  assembleOne: string;
  assembleAll: string;
  notFullyAllocated: string;
  insufficientAvailableStock: string;
  insufficientLocationStock: string;
  outputLocationRequired: string;
  chooseLocation: string;
  searchLocations: string;
  noMatchingLocations: string;
  expandLocation: string;
  collapseLocation: string;
  states: Record<string, string>;
};

type BuildsClientProps = {
  canWrite: boolean;
  copy: BuildsCopy;
  initialPage: ListPage<BuildSummary>;
  workspaceSlug: string;
};

const columnHelper = createColumnHelper<BuildSummary>();

const STATE_BADGE_CLASS: Record<string, string> = {
  CREATED: "bg-[var(--color-bg-subtle)] text-[var(--color-text-secondary)]",
  ALLOCATED: "bg-[var(--color-accent-soft)] text-[var(--color-accent)]",
  STARTED: "bg-[var(--color-warning-soft)] text-[var(--color-warning)]",
  IN_PROGRESS: "bg-[var(--color-warning-soft)] text-[var(--color-warning)]",
  COMPLETED: "bg-[var(--color-success-soft)] text-[var(--color-success)]",
  CANCELLED: "bg-[var(--color-error-soft)] text-[var(--color-error)]"
};

function getErrorMsg(copy: BuildsCopy, error: string): string {
  switch (error) {
    case "build-not-fully-allocated": return copy.notFullyAllocated;
    case "insufficient-available-stock": return copy.insufficientAvailableStock;
    case "insufficient-location-stock": return copy.insufficientLocationStock;
    case "output-location-required": return copy.outputLocationRequired;
    case "workspace-permission-denied": return copy.permissionDenied;
    case "database-unavailable": return copy.databaseUnavailable;
    default: return copy.invalidInput;
  }
}

function locationTreeSelectCopy(copy: BuildsCopy): LocationTreeSelectCopy {
  return {
    chooseLocation: copy.chooseLocation,
    searchLocations: copy.searchLocations,
    noMatchingLocations: copy.noMatchingLocations,
    expandLocation: copy.expandLocation,
    collapseLocation: copy.collapseLocation
  };
}

const inputClass =
  "mt-1 w-full rounded-md border border-[var(--color-border-strong)] bg-[var(--color-bg-input)] px-3 py-2 text-sm text-[var(--color-text-primary)] focus:border-[var(--color-accent)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]";
const smallSelectClass =
  "w-full rounded-md border border-[var(--color-border-strong)] bg-[var(--color-bg-input)] px-2 py-1 text-sm text-[var(--color-text-primary)] focus:border-[var(--color-accent)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)] disabled:opacity-60";

export function BuildsClient({ canWrite, copy, initialPage, workspaceSlug }: BuildsClientProps) {
  const queryClient = useQueryClient();
  const createDialogRef = useRef<HTMLDialogElement>(null);
  const nextToastIdRef = useRef(0);

  const [selectedBuildId, setSelectedBuildId] = useState<string | null>(null);
  const [hoveredBuildId, setHoveredBuildId] = useState<string | null>(null);
  const [toastMessages, setToastMessages] = useState<ToastMessage[]>([]);

  // Create-dialog form state
  const [formKey, setFormKey] = useState(0);
  const [formDesignId, setFormDesignId] = useState("");
  const [formRevisionId, setFormRevisionId] = useState("");
  const [formTargetQuantity, setFormTargetQuantity] = useState("1");
  const [formOutputLocationId, setFormOutputLocationId] = useState("");
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  function pushToast(message: string, variant: "success" | "error" = "success") {
    setToastMessages((prev) => [...prev, { id: getNextToastId(nextToastIdRef), message, variant }]);
  }

  function showError(error: string) {
    pushToast(getErrorMsg(copy, error), "error");
  }

  // --- Column configuration ---

  const buildColumns = useMemo<ListColumnDefinition[]>(
    () => [
      { id: "design", label: copy.design, group: "base", defaultWidth: 220, minWidth: 140 },
      { id: "revision", label: copy.revision, group: "base", defaultWidth: 100, minWidth: 80 },
      { id: "targetQuantity", label: copy.targetQuantity, group: "base", defaultWidth: 110, minWidth: 80, align: "right" },
      { id: "state", label: copy.state, group: "base", defaultWidth: 140, minWidth: 110 },
      { id: "progress", label: copy.progress, group: "base", defaultWidth: 120, minWidth: 90, align: "right" },
      { id: "createdAt", label: copy.createdAt, group: "base", defaultWidth: 160, minWidth: 100 }
    ],
    [copy]
  );

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
    storageKey: `oso:list-config:builds:${workspaceSlug}`,
    columns: buildColumns
  });

  const { isResizingColumn, setIsResizingColumn, containerClassName } = useColumnResizeCursor();
  const { draggedColumnId, onDragEnd, onStartDrag, onDropOnto } = useColumnDragReorder(setColumnOrder);

  const { currentBuilds, totalCount, isLoading, isError, isFetchingNextPage, hasNextPage, fetchNextPage } =
    useBuildsQuery({ workspaceSlug, initialPage });

  // --- Detail + create options ---

  const { data: buildDetail } = useQuery({
    queryKey: ["build-detail", workspaceSlug, selectedBuildId],
    queryFn: async () => {
      if (!selectedBuildId) return null;
      const result = await getBuildDetailAction({ workspaceSlug, buildId: selectedBuildId });
      return result.ok ? result.data : null;
    },
    enabled: Boolean(selectedBuildId)
  });

  const { data: createOptions } = useQuery({
    queryKey: ["build-options", workspaceSlug],
    queryFn: async () => {
      const result = await getBuildCreateOptionsAction({ workspaceSlug });
      return result.ok ? result.data : null;
    },
    enabled: canWrite
  });

  const outputLocations = useMemo(
    () => (createOptions?.locations ?? []).filter((location) => !location.isArchived),
    [createOptions]
  );
  const outputLocationTree = useMemo(() => buildTree(outputLocations), [outputLocations]);

  function invalidateBuilds() {
    void queryClient.invalidateQueries({ queryKey: ["builds", workspaceSlug] });
    void queryClient.invalidateQueries({ queryKey: ["build-detail", workspaceSlug, selectedBuildId] });
    void queryClient.invalidateQueries({ queryKey: ["parts-list", workspaceSlug] });
  }

  // --- Mutations ---

  const createMutation = useMutation({
    mutationFn: async (input: {
      designRevisionId: string;
      targetQuantity: number;
      outputLocationId: string | null;
    }) => {
      const result = await createBuildAction({ workspaceSlug, ...input });
      if (!result.ok) throw new Error(result.error);
      return result.data;
    },
    onSuccess: (data) => {
      invalidateBuilds();
      closeDialog(createDialogRef.current);
      pushToast(copy.createdToast);
      setSelectedBuildId(data.id);
    },
    onError: (error) => showError((error as Error).message.replaceAll("_", "-"))
  });

  const allocateMutation = useMutation({
    mutationFn: async (input: {
      buildLineItemId: string;
      partId: string | null;
      sourceLocationId: string | null;
    }) => {
      const result = await allocateBuildLineAction({ workspaceSlug, ...input });
      if (!result.ok) throw new Error(result.error);
    },
    onSuccess: invalidateBuilds,
    onError: (error) => showError((error as Error).message.replaceAll("_", "-"))
  });

  function buildTransitionMutation(action: (buildId: string) => Promise<{ ok: boolean; error?: string }>) {
    return {
      mutationFn: async (buildId: string) => {
        const result = await action(buildId);
        if (!result.ok) throw new Error(result.error ?? "invalid-input");
      },
      onSuccess: invalidateBuilds,
      onError: (error: unknown) => showError((error as Error).message.replaceAll("_", "-"))
    };
  }

  const markAllocatedMutation = useMutation(
    buildTransitionMutation((buildId) => markBuildAllocatedAction({ workspaceSlug, buildId }))
  );
  const reopenMutation = useMutation(
    buildTransitionMutation((buildId) => reopenBuildAction({ workspaceSlug, buildId }))
  );
  const startMutation = useMutation(
    buildTransitionMutation((buildId) => startBuildAction({ workspaceSlug, buildId }))
  );
  const cancelMutation = useMutation(
    buildTransitionMutation((buildId) => cancelBuildAction({ workspaceSlug, buildId }))
  );

  const deleteMutation = useMutation({
    mutationFn: async (buildId: string) => {
      const result = await deleteBuildAction({ workspaceSlug, buildId });
      if (!result.ok) throw new Error(result.error);
    },
    onSuccess: () => {
      invalidateBuilds();
      setSelectedBuildId(null);
    },
    onError: (error) => showError((error as Error).message.replaceAll("_", "-"))
  });

  const assembleMutation = useMutation({
    mutationFn: async (input: { assignmentId: string; quantity: number }) => {
      const result = await assembleDesignatorAction({ workspaceSlug, ...input });
      if (!result.ok) throw new Error(result.error);
    },
    onSuccess: invalidateBuilds,
    onError: (error) => showError((error as Error).message.replaceAll("_", "-"))
  });

  // --- Create dialog ---

  const openCreateDialog = useCallback(() => {
    setFormDesignId("");
    setFormRevisionId("");
    setFormTargetQuantity("1");
    setFormOutputLocationId("");
    setFormErrors({});
    setFormKey((k) => k + 1);
    window.requestAnimationFrame(() => openDialog(createDialogRef.current));
  }, []);

  const selectedFormDesign = createOptions?.designs.find((d) => d.id === formDesignId) ?? null;

  function handleDesignChange(designId: string) {
    setFormDesignId(designId);
    setFormErrors((prev) => ({ ...prev, design: "", revision: "" }));
    const design = createOptions?.designs.find((d) => d.id === designId) ?? null;
    // Auto-select the latest revision (revisions are ordered newest-first).
    setFormRevisionId(design?.revisions[0]?.id ?? "");
    // Default the output location to the design output part's default location.
    setFormOutputLocationId(design?.defaultLocationId ?? "");
  }

  function handleCreateSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errors: Record<string, string> = {};
    if (!formDesignId) errors.design = copy.designRequired;
    if (!formRevisionId) errors.revision = copy.revisionRequired;
    const target = Number(formTargetQuantity);
    if (!Number.isInteger(target) || target < 1) errors.targetQuantity = copy.targetQuantityRequired;
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }
    createMutation.mutate({
      designRevisionId: formRevisionId,
      targetQuantity: target,
      outputLocationId: formOutputLocationId || null
    });
  }

  // --- TanStack Table ---

  const columns = useMemo(
    () => [
      columnHelper.accessor("designName", {
        id: "design",
        header: copy.design,
        cell: ({ getValue }) => (
          <span className="font-medium text-[var(--color-text-primary)]">{getValue()}</span>
        )
      }),
      columnHelper.accessor((row) => `v${row.revisionNumber}`, {
        id: "revision",
        header: copy.revision,
        cell: ({ getValue }) => (
          <span className="text-[var(--color-text-secondary)]">{getValue()}</span>
        )
      }),
      columnHelper.accessor("targetQuantity", {
        id: "targetQuantity",
        header: copy.targetQuantity,
        cell: ({ getValue }) => (
          <span className="block text-right text-[var(--color-text-secondary)]">{getValue()}</span>
        )
      }),
      columnHelper.accessor("state", {
        id: "state",
        header: copy.state,
        cell: ({ getValue }) => {
          const value = getValue();
          return (
            <span
              className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${STATE_BADGE_CLASS[value] ?? ""}`}
            >
              {copy.states[value] ?? value}
            </span>
          );
        }
      }),
      columnHelper.accessor((row) => `${row.unitsAssembled}/${row.unitsTotal}`, {
        id: "progress",
        header: copy.progress,
        cell: ({ getValue }) => (
          <span className="block text-right text-[var(--color-text-secondary)]">{getValue()}</span>
        )
      }),
      columnHelper.accessor("createdAt", {
        id: "createdAt",
        header: copy.createdAt,
        cell: ({ getValue }) => (
          <span className="text-[var(--color-text-secondary)]">
            {new Date(getValue()).toLocaleDateString()}
          </span>
        )
      })
    ],
    [copy]
  );

  const tableColumnOrder = useMemo(() => persistedColumnOrder, [persistedColumnOrder]);

  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: currentBuilds,
    columns,
    state: { columnVisibility, columnOrder: tableColumnOrder, sorting, columnSizing },
    onColumnVisibilityChange: setColumnVisibility,
    onColumnOrderChange: setColumnOrder,
    onSortingChange: setSorting,
    onColumnSizingChange: setColumnSizing,
    columnResizeMode: "onChange",
    enableColumnResizing: true,
    manualSorting: true,
    getCoreRowModel: getCoreRowModel()
  });

  const {
    width: detailsPanelWidth,
    hasLoaded: hasLoadedDetailsPanelWidth,
    startResizing: startResizingDetailsPanel
  } = useDetailsPanelWidth(`oso:builds-details-panel-width:${workspaceSlug}`, 460);

  const selectedBuild = selectedBuildId
    ? (currentBuilds.find((b) => b.id === selectedBuildId) ?? null)
    : null;

  return (
    <div className={`flex min-h-0 flex-1 gap-4 overflow-hidden ${containerClassName}`}>
      <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elevated)] shadow-sm">
        <ListPageToolbar
          totalCount={totalCount}
          formatCount={(_visible, total) => `${total} ${total === 1 ? "build" : "builds"}`}
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
                onClick={openCreateDialog}
              >
                {copy.newBuild}
              </button>
            ) : null
          }
        />

        <InfiniteListViewport
          isEmpty={currentBuilds.length === 0}
          isInitialLoading={!isConfigLoaded || isLoading}
          isError={isError}
          hasNextPage={hasNextPage}
          isFetchingNextPage={isFetchingNextPage}
          loadingLabel={copy.loadingBuilds}
          loadingMoreLabel={copy.loadingMoreBuilds}
          loadMore={() => void fetchNextPage()}
          emptyState={
            <div className="flex flex-1 flex-col items-center justify-center gap-2 py-20 text-center">
              <p className="text-base font-medium text-[var(--color-text-primary)]">{copy.noBuilds}</p>
              <p className="text-sm text-[var(--color-text-muted)]">{copy.noBuildsBody}</p>
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
                      columnDefs={buildColumns}
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
                <tr
                  key={row.id}
                  className={`cursor-pointer border-b border-[var(--color-border)] ${
                    row.original.id === selectedBuildId
                      ? "bg-[var(--color-bg-muted)]"
                      : row.original.id === hoveredBuildId
                        ? "bg-[var(--color-bg-subtle)]"
                        : ""
                  }`}
                  role="button"
                  tabIndex={0}
                  onClick={() => setSelectedBuildId(row.original.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setSelectedBuildId(row.original.id);
                    }
                  }}
                  onMouseEnter={() => setHoveredBuildId(row.original.id)}
                  onMouseLeave={() =>
                    setHoveredBuildId((cur) => (cur === row.original.id ? null : cur))
                  }
                >
                  {row.getVisibleCells().map((cell) => (
                    <td
                      key={cell.id}
                      className="overflow-hidden border-b border-[var(--color-border)] px-2 py-2 text-[var(--color-text-secondary)]"
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

      {selectedBuild && hasLoadedDetailsPanelWidth ? (
        <DetailPanel
          closeLabel={copy.close}
          subtitle={`v${selectedBuild.revisionNumber} · ${copy.targetQuantity} ${selectedBuild.targetQuantity}`}
          title={selectedBuild.designName}
          width={detailsPanelWidth}
          onClose={() => setSelectedBuildId(null)}
          onStartResize={startResizingDetailsPanel}
        >
          <BuildDetailContent
            canWrite={canWrite}
            copy={copy}
            detail={buildDetail ?? null}
            onAllocate={(input) => allocateMutation.mutate(input)}
            onAssemble={(input) => assembleMutation.mutate(input)}
            onMarkAllocated={(buildId) => markAllocatedMutation.mutate(buildId)}
            onReopen={(buildId) => reopenMutation.mutate(buildId)}
            onStart={(buildId) => startMutation.mutate(buildId)}
            onCancel={(buildId) => cancelMutation.mutate(buildId)}
            onDelete={(buildId) => deleteMutation.mutate(buildId)}
          />
        </DetailPanel>
      ) : null}

      {/* Create build dialog */}
      <DialogShell
        ref={createDialogRef}
        title={copy.newBuildTitle}
        titleId="build-dialog-title"
        closeLabel={copy.close}
        onClose={() => closeDialog(createDialogRef.current)}
      >
        <form key={formKey} className="flex min-h-0 flex-1 flex-col" onSubmit={handleCreateSubmit}>
          <DialogBody>
            <div className="grid gap-4">
              <div>
                <LabelWithError htmlFor="build-design" error={formErrors.design}>
                  {copy.design}
                </LabelWithError>
                <select
                  id="build-design"
                  className={inputClass}
                  value={formDesignId}
                  onChange={(e) => handleDesignChange(e.target.value)}
                >
                  <option value="">{copy.selectDesign}</option>
                  {createOptions?.designs.map((design) => (
                    <option key={design.id} value={design.id}>
                      {design.name} ({design.outputPartCatalogNumber})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <LabelWithError htmlFor="build-revision" error={formErrors.revision}>
                  {copy.revision}
                </LabelWithError>
                <select
                  id="build-revision"
                  className={inputClass}
                  disabled={!selectedFormDesign}
                  value={formRevisionId}
                  onChange={(e) => {
                    setFormRevisionId(e.target.value);
                    setFormErrors((prev) => ({ ...prev, revision: "" }));
                  }}
                >
                  <option value="">{copy.selectRevision}</option>
                  {selectedFormDesign?.revisions.map((rev) => (
                    <option key={rev.id} value={rev.id}>
                      v{rev.revisionNumber}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <LabelWithError htmlFor="build-target" error={formErrors.targetQuantity}>
                  {copy.targetQuantity}
                </LabelWithError>
                <input
                  id="build-target"
                  className={inputClass}
                  type="number"
                  min={1}
                  step={1}
                  value={formTargetQuantity}
                  onChange={(e) => {
                    setFormTargetQuantity(e.target.value);
                    setFormErrors((prev) => ({ ...prev, targetQuantity: "" }));
                  }}
                />
              </div>
              <div className="grid gap-1">
                <label className="text-sm font-medium text-[var(--color-text-primary)]">
                  {copy.outputLocation}
                </label>
                <LocationTreeSelect
                  locations={outputLocations}
                  locationTree={outputLocationTree}
                  copy={locationTreeSelectCopy(copy)}
                  name="build-output-location"
                  selectedId={formOutputLocationId}
                  onSelectedIdChange={setFormOutputLocationId}
                  clearable
                  emptyLabel={copy.selectLocation}
                  className="w-full"
                  buttonClassName={formLocationSelectButtonClassName}
                />
              </div>
            </div>
          </DialogBody>
          <DialogActions actionLabel={copy.createBuild} disabled={createMutation.isPending} />
        </form>
      </DialogShell>

      <ToastNotice
        messages={toastMessages}
        onDismiss={(id) => setToastMessages((prev) => prev.filter((m) => m.id !== id))}
      />
    </div>
  );
}

type BuildDetailContentProps = {
  canWrite: boolean;
  copy: BuildsCopy;
  detail: BuildDetail | null;
  onAllocate: (input: { buildLineItemId: string; partId: string | null; sourceLocationId: string | null }) => void;
  onAssemble: (input: { assignmentId: string; quantity: number }) => void;
  onMarkAllocated: (buildId: string) => void;
  onReopen: (buildId: string) => void;
  onStart: (buildId: string) => void;
  onCancel: (buildId: string) => void;
  onDelete: (buildId: string) => void;
};

const actionButtonClass =
  "inline-flex min-h-8 items-center rounded-md border border-[var(--color-border-strong)] bg-[var(--color-bg-elevated)] px-3 py-1 text-sm font-medium text-[var(--color-text-secondary)] transition hover:bg-[var(--color-bg-subtle)] disabled:cursor-not-allowed disabled:opacity-50";
const primaryActionClass =
  "inline-flex min-h-8 items-center rounded-md bg-[var(--color-accent)] px-3 py-1 text-sm font-semibold text-white transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50";

function BuildDetailContent({
  canWrite,
  copy,
  detail,
  onAllocate,
  onAssemble,
  onMarkAllocated,
  onReopen,
  onStart,
  onCancel,
  onDelete
}: BuildDetailContentProps) {
  if (!detail) {
    return <p className="text-sm text-[var(--color-text-muted)]">{copy.loadingBuilds}</p>;
  }

  const editable = detail.state === "CREATED";
  const fullyAllocated = detail.lines.every((line) => line.part && line.sourceLocation);

  return (
    <>
      <section className="grid gap-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
          {copy.state}
        </p>
        <span
          className={`inline-flex w-fit rounded-full px-2 py-0.5 text-xs font-medium ${STATE_BADGE_CLASS[detail.state] ?? ""}`}
        >
          {copy.states[detail.state] ?? detail.state}
        </span>
      </section>

      <section className="grid gap-1 text-sm">
        <div className="group flex justify-between">
          <span className="text-[var(--color-text-muted)]">{copy.outputPart}</span>
          <span className="font-mono text-[var(--color-text-primary)]">
            <PartLink partId={detail.outputPart.id} name={detail.outputPart.catalogNumber} />
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-[var(--color-text-muted)]">{copy.outputLocation}</span>
          <span className="text-[var(--color-text-primary)]">
            {detail.outputLocation?.name ?? <EmptyCell />}
          </span>
        </div>
      </section>

      {canWrite && (
        <section className="flex flex-wrap gap-2">
          {detail.state === "CREATED" && (
            <>
              <button
                className={primaryActionClass}
                type="button"
                disabled={!fullyAllocated}
                onClick={() => onMarkAllocated(detail.id)}
              >
                {copy.markAllocated}
              </button>
              <button className={actionButtonClass} type="button" onClick={() => onDelete(detail.id)}>
                {copy.deleteBuild}
              </button>
            </>
          )}
          {detail.state === "ALLOCATED" && (
            <>
              <button className={primaryActionClass} type="button" onClick={() => onStart(detail.id)}>
                {copy.start}
              </button>
              <button className={actionButtonClass} type="button" onClick={() => onReopen(detail.id)}>
                {copy.reopen}
              </button>
              <button className={actionButtonClass} type="button" onClick={() => onCancel(detail.id)}>
                {copy.cancelBuild}
              </button>
            </>
          )}
          {(detail.state === "STARTED" || detail.state === "IN_PROGRESS") && (
            <button className={actionButtonClass} type="button" onClick={() => onCancel(detail.id)}>
              {copy.cancelBuild}
            </button>
          )}
        </section>
      )}

      <section className="grid gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
          {copy.bom}
        </p>
        {detail.lines.length === 0 ? (
          <p className="text-sm text-[var(--color-text-muted)]">—</p>
        ) : (
          <div className="grid gap-2">
            {detail.lines.map((line) => (
              <BuildLineRow
                key={line.id}
                canWrite={canWrite}
                copy={copy}
                editable={editable}
                line={line}
                locations={detail.locations}
                showAssembly={detail.state === "STARTED" || detail.state === "IN_PROGRESS"}
                onAllocate={onAllocate}
                onAssemble={onAssemble}
              />
            ))}
          </div>
        )}
      </section>
    </>
  );
}

type BuildLineRowProps = {
  canWrite: boolean;
  copy: BuildsCopy;
  editable: boolean;
  line: NonNullable<BuildDetail["lines"]>[number];
  locations: StorageLocationListItem[];
  showAssembly: boolean;
  onAllocate: (input: { buildLineItemId: string; partId: string | null; sourceLocationId: string | null }) => void;
  onAssemble: (input: { assignmentId: string; quantity: number }) => void;
};

function BuildLineRow({
  canWrite,
  copy,
  editable,
  line,
  locations,
  showAssembly,
  onAllocate,
  onAssemble
}: BuildLineRowProps) {
  // Narrow the source-location picker to locations that physically hold the chosen part
  // (with their current balance), keeping ancestors as structural-only nodes for the tree.
  const sourceLocationData = useMemo(() => {
    const balanceById = new Map(line.sourceLocationBalances.map((b) => [b.locationId, b.balance]));
    if (balanceById.size === 0) return { items: [] as StorageLocationListItem[], tree: [] };
    const byId = new Map(locations.map((l) => [l.id, l]));
    const includeIds = new Set<string>();
    for (const balance of line.sourceLocationBalances) {
      let current = byId.get(balance.locationId);
      while (current) {
        includeIds.add(current.id);
        current = current.parentId ? byId.get(current.parentId) : undefined;
      }
    }
    const items = locations
      .filter((l) => includeIds.has(l.id))
      .map((l) => {
        const balance = balanceById.get(l.id);
        return {
          ...l,
          // Only locations with a balance are selectable; ancestors are structural.
          isAssignable: balance !== undefined,
          name: balance !== undefined ? `${l.name} · ${balance}` : l.name
        };
      });
    return { items, tree: buildTree(items) };
  }, [line.sourceLocationBalances, locations]);

  const partOptions = useMemo(() => {
    const options = line.matchCandidates.slice();
    if (line.part && !options.some((p) => p.id === line.part!.id)) {
      options.unshift({
        id: line.part.id,
        catalogNumber: line.part.catalogNumber,
        description: null,
        manufacturerName: "",
        availableQuantity: line.part.availableQuantity
      });
    }
    return options;
  }, [line.matchCandidates, line.part]);

  return (
    <div className="grid gap-1.5 rounded-md border border-[var(--color-border)] px-2.5 py-2">
      <div className="flex items-center justify-between">
        <span className="font-mono text-sm text-[var(--color-text-primary)]">{line.designators}</span>
        {line.categoryName && (
          <span className="rounded bg-[var(--color-bg-subtle)] px-1.5 py-0.5 text-xs text-[var(--color-text-secondary)]">
            {line.categoryName}
          </span>
        )}
      </div>

      {editable && canWrite ? (
        <div className="grid grid-cols-2 items-end gap-2">
          <label className="grid gap-1 text-xs text-[var(--color-text-muted)]">
            {copy.part}
            <select
              className={smallSelectClass}
              value={line.part?.id ?? ""}
              onChange={(e) =>
                onAllocate({
                  buildLineItemId: line.id,
                  partId: e.target.value || null,
                  sourceLocationId: line.sourceLocation?.id ?? null
                })
              }
            >
              <option value="">{copy.unassigned}</option>
              {partOptions.map((part) => (
                <option key={part.id} value={part.id}>
                  {part.catalogNumber}
                  {part.manufacturerName ? ` · ${part.manufacturerName}` : ""}
                  {part.description ? ` · ${part.description}` : ""}
                  {` — ${copy.available} ${part.availableQuantity}`}
                </option>
              ))}
            </select>
          </label>
          <div className="grid gap-1 text-xs text-[var(--color-text-muted)]">
            {copy.sourceLocation}
            <LocationTreeSelect
              locations={sourceLocationData.items}
              locationTree={sourceLocationData.tree}
              copy={locationTreeSelectCopy(copy)}
              name={`build-source-${line.id}`}
              selectedId={line.sourceLocation?.id ?? ""}
              onSelectedIdChange={(locationId) =>
                onAllocate({
                  buildLineItemId: line.id,
                  partId: line.part?.id ?? null,
                  sourceLocationId: locationId || null
                })
              }
              clearable
              emptyLabel={copy.unassigned}
              className="w-full"
              buttonClassName={formLocationSelectButtonClassName}
            />
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="group">
            <span className="text-xs text-[var(--color-text-muted)]">{copy.part}</span>
            <p className="font-mono text-[var(--color-text-primary)]">
              {line.part ? (
                <PartLink partId={line.part.id} name={line.part.catalogNumber} />
              ) : (
                <span className="font-sans text-[var(--color-text-muted)]">{copy.unassigned}</span>
              )}
            </p>
          </div>
          <div>
            <span className="text-xs text-[var(--color-text-muted)]">{copy.sourceLocation}</span>
            <p className="text-[var(--color-text-primary)]">
              {line.sourceLocation?.name ?? copy.unassigned}
            </p>
          </div>
        </div>
      )}

      {showAssembly && (
        <div className="flex flex-wrap gap-1.5">
          {line.assignments.map((assignment) => {
            const remaining = assignment.quantity - assignment.assembledQuantity;
            const done = remaining <= 0;
            const label =
              assignment.quantity > 1
                ? `${assignment.designator} ${assignment.assembledQuantity}/${assignment.quantity}`
                : assignment.designator;
            if (done) {
              return (
                <span
                  key={assignment.id}
                  className="inline-flex items-center gap-1 rounded bg-[var(--color-success-soft)] px-2 py-0.5 font-mono text-xs text-[var(--color-success)]"
                >
                  ✓ {label}
                </span>
              );
            }
            return (
              <span
                key={assignment.id}
                className="inline-flex items-center gap-1 rounded border border-[var(--color-border-strong)] px-1.5 py-0.5 font-mono text-xs text-[var(--color-text-secondary)]"
              >
                {label}
                <button
                  className="rounded px-1 text-[var(--color-accent)] hover:bg-[var(--color-bg-subtle)] disabled:opacity-50"
                  type="button"
                  disabled={!canWrite}
                  title={copy.assembleOne}
                  onClick={() => onAssemble({ assignmentId: assignment.id, quantity: 1 })}
                >
                  +1
                </button>
                {remaining > 1 && (
                  <button
                    className="rounded px-1 text-[var(--color-accent)] hover:bg-[var(--color-bg-subtle)] disabled:opacity-50"
                    type="button"
                    disabled={!canWrite}
                    title={copy.assembleAll}
                    onClick={() => onAssemble({ assignmentId: assignment.id, quantity: remaining })}
                  >
                    {copy.assembleAll}
                  </button>
                )}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}
