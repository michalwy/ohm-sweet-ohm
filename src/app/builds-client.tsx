"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable
} from "@tanstack/react-table";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  assembleDesignatorAction,
  cancelBuildAction,
  createBuildAction,
  deleteBuildAction,
  getBuildCreateOptionsAction,
  getBuildDetailAction,
  markBuildAllocatedAction,
  reassignDesignatorAssignmentAction,
  reopenBuildAction,
  setBuildAllocationsAction,
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
import { BuildPartSelect, type BuildPartOption } from "@/app/build-part-select";
import {
  LocationTreeSelect,
  formLocationSelectButtonClassName,
  type LocationTreeItem,
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
  quantity: string;
  noAvailableParts: string;
  addPartEntry: string;
  removeEntry: string;
  applyAllocation: string;
  applyBeforeAllocate: string;
  allocatedOfRequired: string;
  allocationTotalMismatch: string;
  invalidAllocationQuantity: string;
  partDoesNotMatchSpec: string;
  changePart: string;
  confirm: string;
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
    case "allocation-total-mismatch": return copy.allocationTotalMismatch;
    case "invalid-allocation-quantity": return copy.invalidAllocationQuantity;
    case "part-does-not-match-spec": return copy.partDoesNotMatchSpec;
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
  "h-10 w-full rounded-md border border-[var(--color-border-strong)] bg-[var(--color-bg-input)] px-2 py-1 text-sm text-[var(--color-text-primary)] focus:border-[var(--color-accent)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)] disabled:opacity-60";

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

  const setAllocationsMutation = useMutation({
    mutationFn: async (input: {
      buildId: string;
      lines: {
        buildLineItemId: string;
        entries: { partId: string; sourceLocationId: string | null; quantity: number }[];
      }[];
    }) => {
      const result = await setBuildAllocationsAction({ workspaceSlug, ...input });
      if (!result.ok) throw new Error(result.error);
    },
    onSuccess: invalidateBuilds,
    onError: (error) => showError((error as Error).message.replaceAll("_", "-"))
  });

  const reassignMutation = useMutation({
    mutationFn: async (input: {
      assignmentId: string;
      partId: string;
      sourceLocationId: string | null;
    }) => {
      const result = await reassignDesignatorAssignmentAction({ workspaceSlug, ...input });
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
            onSetBuildAllocations={(input) => setAllocationsMutation.mutate(input)}
            onAssemble={(input) => assembleMutation.mutate(input)}
            onReassign={(input) => reassignMutation.mutate(input)}
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

type AllocationEntryInput = { partId: string; sourceLocationId: string | null; quantity: number };

type BuildAllocationsInput = {
  buildId: string;
  lines: { buildLineItemId: string; entries: AllocationEntryInput[] }[];
};

type BuildDetailContentProps = {
  canWrite: boolean;
  copy: BuildsCopy;
  detail: BuildDetail | null;
  onSetBuildAllocations: (input: BuildAllocationsInput) => void;
  onAssemble: (input: { assignmentId: string; quantity: number }) => void;
  onReassign: (input: { assignmentId: string; partId: string; sourceLocationId: string | null }) => void;
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
  onSetBuildAllocations,
  onAssemble,
  onReassign,
  onMarkAllocated,
  onReopen,
  onStart,
  onCancel,
  onDelete
}: BuildDetailContentProps) {
  // Full per-line allocation drafts are owned here so a single build-wide Apply can persist every
  // line atomically — per-line saves could otherwise leave the build over-allocated.
  const [draftsByLine, setDraftsByLine] = useState<Record<string, AllocationDraft[]>>({});
  const serverSignature = allocationsSignatureOf(detail?.lines ?? []);
  const syncedRef = useRef<string | null>(null);
  useEffect(() => {
    if (syncedRef.current === serverSignature) return;
    syncedRef.current = serverSignature;
    setDraftsByLine(
      Object.fromEntries((detail?.lines ?? []).map((line) => [line.id, draftsFromLine(line)]))
    );
    // Re-sync is keyed on the persisted-allocations signature, which already encodes detail.lines.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverSignature]);
  const setLineEntries = useCallback((lineId: string, entries: AllocationDraft[]) => {
    setDraftsByLine((prev) => ({ ...prev, [lineId]: entries }));
  }, []);

  if (!detail) {
    return <p className="text-sm text-[var(--color-text-muted)]">{copy.loadingBuilds}</p>;
  }

  const build = detail;
  const editable = build.state === "CREATED";
  const entriesFor = (line: BuildLine): AllocationDraft[] => draftsByLine[line.id] ?? draftsFromLine(line);

  // Aggregate the live draft usage of every line except the target, so each editor validates
  // against shared stock immediately.
  const externalUsageFor = (targetLineId: string): LineUsage => {
    const parts: Record<string, number> = {};
    const locs: Record<string, number> = {};
    for (const other of build.lines) {
      if (other.id === targetLineId) continue;
      const usage = usageFromEntries(entriesFor(other));
      for (const [partId, qty] of Object.entries(usage.parts)) parts[partId] = (parts[partId] ?? 0) + qty;
      for (const [key, qty] of Object.entries(usage.locs)) locs[key] = (locs[key] ?? 0) + qty;
    }
    return { parts, locs };
  };

  // Build-wide Apply gating: dirty vs persisted, every present entry complete, aggregate within stock.
  const dirty = draftSignatureOf(build.lines, entriesFor) !== serverSignature;
  const entriesComplete = build.lines
    .flatMap((line) => entriesFor(line))
    .every((e) => e.partId && e.sourceLocationId && Number.isInteger(Number(e.quantity)) && Number(e.quantity) >= 1);
  const applyStockOk = buildAllocationStockOk(build.lines, entriesFor);
  const applyEnabled = dirty && entriesComplete && applyStockOk;
  const fullyAllocated = build.lines.every((line) => isLineFullyAllocated(line));

  function handleApply() {
    onSetBuildAllocations({
      buildId: build.id,
      lines: build.lines.map((line) => ({
        buildLineItemId: line.id,
        entries: entriesFor(line)
          .filter((e) => e.partId && e.sourceLocationId)
          .map((e) => ({
            partId: e.partId,
            sourceLocationId: e.sourceLocationId,
            quantity: Number.parseInt(e.quantity, 10)
          }))
      }))
    });
  }

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
                disabled={!applyEnabled}
                onClick={handleApply}
              >
                {copy.applyAllocation}
              </button>
              <button
                className={actionButtonClass}
                type="button"
                disabled={!fullyAllocated || dirty}
                title={dirty ? copy.applyBeforeAllocate : undefined}
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
                entries={entriesFor(line)}
                externalUsage={externalUsageFor(line.id)}
                onEntriesChange={(entries) => setLineEntries(line.id, entries)}
                onAssemble={onAssemble}
                onReassign={onReassign}
              />
            ))}
          </div>
        )}
      </section>
    </>
  );
}

type BuildLine = NonNullable<BuildDetail["lines"]>[number];
type BuildAssignment = BuildLine["assignments"][number];

/** A line's allocated quantities per part and per (part, location) — used for cross-line netting. */
type LineUsage = { parts: Record<string, number>; locs: Record<string, number> };

/** Seed a line's editable draft from its persisted allocations. */
function draftsFromLine(line: BuildLine): AllocationDraft[] {
  return line.allocations.map((a) => ({
    partId: a.part.id,
    sourceLocationId: a.sourceLocation?.id ?? null,
    quantity: String(a.quantity)
  }));
}

/** Aggregate a set of draft entries into per-part and per-(part, location) quantities. */
function usageFromEntries(entries: AllocationDraft[]): LineUsage {
  const parts: Record<string, number> = {};
  const locs: Record<string, number> = {};
  for (const entry of entries) {
    const qty = Number.parseInt(entry.quantity, 10) || 0;
    if (entry.partId) parts[entry.partId] = (parts[entry.partId] ?? 0) + qty;
    if (entry.partId && entry.sourceLocationId) {
      const key = `${entry.partId}::${entry.sourceLocationId}`;
      locs[key] = (locs[key] ?? 0) + qty;
    }
  }
  return { parts, locs };
}

/** Stable signature of the build's persisted allocations, used to detect server changes. */
function allocationsSignatureOf(lines: BuildLine[]): string {
  return lines
    .map(
      (line) =>
        `${line.id}#${line.allocations
          .map((a) => `${a.part.id}:${a.sourceLocation?.id ?? ""}:${a.quantity}`)
          .join("|")}`
    )
    .join("~");
}

/** Same signature shape, computed from the current drafts (to compare against the server one). */
function draftSignatureOf(lines: BuildLine[], entriesFor: (line: BuildLine) => AllocationDraft[]): string {
  return lines
    .map(
      (line) =>
        `${line.id}#${entriesFor(line)
          .map((e) => `${e.partId}:${e.sourceLocationId ?? ""}:${Number.parseInt(e.quantity, 10) || 0}`)
          .join("|")}`
    )
    .join("~");
}

/** True when the build's whole draft stays within available part stock and per-location balances. */
function buildAllocationStockOk(lines: BuildLine[], entriesFor: (line: BuildLine) => AllocationDraft[]): boolean {
  const availableByPart = new Map<string, number>();
  const balanceByLocation = new Map<string, number>();
  for (const line of lines) {
    for (const candidate of line.matchCandidates) {
      availableByPart.set(candidate.id, Number(candidate.availableQuantity));
    }
    for (const allocation of line.allocations) {
      if (!availableByPart.has(allocation.part.id)) {
        availableByPart.set(allocation.part.id, Number(allocation.part.availableQuantity));
      }
    }
    for (const pb of line.partBalances) {
      for (const balance of pb.balances) balanceByLocation.set(`${pb.partId}::${balance.locationId}`, Number(balance.balance));
    }
  }
  const totalByPart = new Map<string, number>();
  const totalByLocation = new Map<string, number>();
  for (const line of lines) {
    for (const entry of entriesFor(line)) {
      const qty = Number.parseInt(entry.quantity, 10) || 0;
      if (entry.partId) totalByPart.set(entry.partId, (totalByPart.get(entry.partId) ?? 0) + qty);
      if (entry.partId && entry.sourceLocationId) {
        const key = `${entry.partId}::${entry.sourceLocationId}`;
        totalByLocation.set(key, (totalByLocation.get(key) ?? 0) + qty);
      }
    }
  }
  for (const [partId, qty] of totalByPart) if (qty > (availableByPart.get(partId) ?? 0)) return false;
  for (const [key, qty] of totalByLocation) if (qty > (balanceByLocation.get(key) ?? 0)) return false;
  return true;
}

type BuildLineRowProps = {
  canWrite: boolean;
  copy: BuildsCopy;
  editable: boolean;
  line: BuildLine;
  locations: StorageLocationListItem[];
  showAssembly: boolean;
  entries: AllocationDraft[];
  externalUsage: LineUsage;
  onEntriesChange: (entries: AllocationDraft[]) => void;
  onAssemble: (input: { assignmentId: string; quantity: number }) => void;
  onReassign: (input: { assignmentId: string; partId: string; sourceLocationId: string | null }) => void;
};

/** A line is fully allocated when its entries cover the requirement and each has a source location. */
function isLineFullyAllocated(line: BuildLine): boolean {
  if (line.requiredUnits === 0) return true;
  if (line.allocations.length === 0) return false;
  if (line.allocations.some((a) => !a.sourceLocation)) return false;
  const total = line.allocations.reduce((sum, a) => sum + a.quantity, 0);
  return total === line.requiredUnits;
}

/** Narrow a location tree to those that hold the given part, annotating each with its balance. */
function narrowLocationsToBalances(
  locations: StorageLocationListItem[],
  balances: { locationId: string; balance: string }[]
): { items: StorageLocationListItem[]; tree: LocationTreeItem[] } {
  const balanceById = new Map(balances.map((b) => [b.locationId, b.balance]));
  if (balanceById.size === 0) return { items: [], tree: [] };
  const byId = new Map(locations.map((l) => [l.id, l]));
  const includeIds = new Set<string>();
  for (const balance of balances) {
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
}

function BuildLineRow({
  canWrite,
  copy,
  editable,
  line,
  locations,
  showAssembly,
  entries,
  externalUsage,
  onEntriesChange,
  onAssemble,
  onReassign
}: BuildLineRowProps) {
  const editing = editable && canWrite;
  const allocatedTotal = editing
    ? entries.reduce((sum, e) => sum + (Number.parseInt(e.quantity, 10) || 0), 0)
    : line.allocations.reduce((sum, a) => sum + a.quantity, 0);

  return (
    <div className="grid gap-1.5 rounded-md border border-[var(--color-border)] px-2.5 py-2">
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-sm text-[var(--color-text-primary)]">{line.designators}</span>
        <div className="flex items-center gap-2">
          {line.categoryName && (
            <span className="rounded bg-[var(--color-bg-subtle)] px-1.5 py-0.5 text-xs text-[var(--color-text-secondary)]">
              {line.categoryName}
            </span>
          )}
          <AllocatedCounter copy={copy} total={allocatedTotal} required={line.requiredUnits} />
        </div>
      </div>

      {editing ? (
        <AllocationEditor
          copy={copy}
          line={line}
          locations={locations}
          entries={entries}
          externalUsage={externalUsage}
          onEntriesChange={onEntriesChange}
        />
      ) : (
        <ReadOnlyAllocations copy={copy} line={line} />
      )}

      {showAssembly && (
        <AssemblyList
          canWrite={canWrite}
          copy={copy}
          line={line}
          locations={locations}
          onAssemble={onAssemble}
          onReassign={onReassign}
        />
      )}
    </div>
  );
}

const removeButtonClass =
  "inline-flex h-10 items-center rounded-md border border-[var(--color-border-strong)] px-2 text-sm text-[var(--color-text-muted)] transition hover:bg-[var(--color-bg-subtle)] disabled:opacity-50";

// Applied to an allocation control whose quantity exceeds available stock.
const stockErrorBorder = "border-[var(--color-error)] focus:border-[var(--color-error)]";

type AllocationDraft = { partId: string; sourceLocationId: string | null; quantity: string };

function AllocationEditor({
  copy,
  line,
  locations,
  entries,
  externalUsage,
  onEntriesChange
}: {
  copy: BuildsCopy;
  line: BuildLine;
  locations: StorageLocationListItem[];
  entries: AllocationDraft[];
  externalUsage: LineUsage;
  onEntriesChange: (entries: AllocationDraft[]) => void;
}) {
  // Part options: the live match candidates plus any already-chosen part not among them.
  const partOptions = useMemo(() => {
    const byId = new Map<string, { catalogNumber: string; manufacturerName: string; description: string | null }>();
    for (const candidate of line.matchCandidates) {
      byId.set(candidate.id, {
        catalogNumber: candidate.catalogNumber,
        manufacturerName: candidate.manufacturerName,
        description: candidate.description
      });
    }
    for (const allocation of line.allocations) {
      if (!byId.has(allocation.part.id)) {
        byId.set(allocation.part.id, {
          catalogNumber: allocation.part.catalogNumber,
          manufacturerName: "",
          description: null
        });
      }
    }
    return [...byId.entries()].map(([id, value]) => ({ id, ...value }));
  }, [line.matchCandidates, line.allocations]);

  const balancesByPart = useMemo(
    () => new Map(line.partBalances.map((pb) => [pb.partId, pb.balances])),
    [line.partBalances]
  );

  // Available stock per part (on hand − reserved) and physical balance per (part, location), net of
  // what the build's *other* lines currently draw (live) — so this line cannot claim the same stock.
  const availableByPart = useMemo(() => {
    const map = new Map<string, number>();
    const net = (partId: string, gross: number) =>
      Math.max(0, gross - (externalUsage.parts[partId] ?? 0));
    for (const candidate of line.matchCandidates) {
      map.set(candidate.id, net(candidate.id, Number(candidate.availableQuantity)));
    }
    for (const allocation of line.allocations) {
      if (!map.has(allocation.part.id)) {
        map.set(allocation.part.id, net(allocation.part.id, Number(allocation.part.availableQuantity)));
      }
    }
    return map;
  }, [line.matchCandidates, line.allocations, externalUsage]);
  const balanceByPartLocation = useMemo(() => {
    const map = new Map<string, number>();
    for (const pb of line.partBalances) {
      for (const balance of pb.balances) {
        const key = `${pb.partId}::${balance.locationId}`;
        map.set(key, Math.max(0, Number(balance.balance) - (externalUsage.locs[key] ?? 0)));
      }
    }
    return map;
  }, [line.partBalances, externalUsage]);

  // Rich options for the part picker, carrying each part's net-available count.
  const selectablePartOptions = useMemo<BuildPartOption[]>(
    () => partOptions.map((part) => ({ ...part, available: availableByPart.get(part.id) ?? 0 })),
    [partOptions, availableByPart]
  );

  const qtyByPart = new Map<string, number>();
  const qtyByPartLocation = new Map<string, number>();
  for (const entry of entries) {
    const qty = Number.parseInt(entry.quantity, 10) || 0;
    if (entry.partId) qtyByPart.set(entry.partId, (qtyByPart.get(entry.partId) ?? 0) + qty);
    if (entry.partId && entry.sourceLocationId) {
      const key = `${entry.partId}::${entry.sourceLocationId}`;
      qtyByPartLocation.set(key, (qtyByPartLocation.get(key) ?? 0) + qty);
    }
  }
  const partOver = (partId: string) =>
    Boolean(partId) && (qtyByPart.get(partId) ?? 0) > (availableByPart.get(partId) ?? 0);
  const locationOver = (partId: string, locationId: string | null) =>
    Boolean(partId && locationId) &&
    (qtyByPartLocation.get(`${partId}::${locationId}`) ?? 0) >
      (balanceByPartLocation.get(`${partId}::${locationId}`) ?? 0);
  const anyPartOver = [...qtyByPart.keys()].some((partId) => partOver(partId));
  const anyLocationOver = entries.some((e) => locationOver(e.partId, e.sourceLocationId));
  const stockOk = !anyPartOver && !anyLocationOver;

  function update(index: number, patch: Partial<AllocationDraft>) {
    onEntriesChange(entries.map((entry, i) => (i === index ? { ...entry, ...patch } : entry)));
  }

  // Greedily suggest the next entry the way the build does on creation: cover the remaining
  // requirement from the best-stocked matching part/location that still has spare capacity, net of
  // what the current entries already use. Falls back to a blank row when nothing is left to draw.
  function suggestNextEntry(current: AllocationDraft[]): AllocationDraft {
    const blank: AllocationDraft = { partId: "", sourceLocationId: null, quantity: "0" };
    const used = current.reduce((sum, e) => sum + (Number.parseInt(e.quantity, 10) || 0), 0);
    const remaining = line.requiredUnits - used;
    if (remaining <= 0) return blank;

    const usedByPart = new Map<string, number>();
    const usedByPartLocation = new Map<string, number>();
    for (const e of current) {
      const qty = Number.parseInt(e.quantity, 10) || 0;
      if (e.partId) usedByPart.set(e.partId, (usedByPart.get(e.partId) ?? 0) + qty);
      if (e.partId && e.sourceLocationId) {
        const key = `${e.partId}::${e.sourceLocationId}`;
        usedByPartLocation.set(key, (usedByPartLocation.get(key) ?? 0) + qty);
      }
    }

    for (const candidate of line.matchCandidates) {
      const partCapacity =
        (availableByPart.get(candidate.id) ?? 0) - (usedByPart.get(candidate.id) ?? 0);
      if (partCapacity <= 0) continue;
      // Remaining at each location = balance net of the build's other lines (balanceByPartLocation)
      // minus this line's own entries. Using the raw balance here would over-suggest when a sibling
      // line already draws from the same location.
      const locations = (balancesByPart.get(candidate.id) ?? [])
        .map((balance) => {
          const key = `${candidate.id}::${balance.locationId}`;
          return {
            locationId: balance.locationId,
            remaining: (balanceByPartLocation.get(key) ?? 0) - (usedByPartLocation.get(key) ?? 0)
          };
        })
        .sort((a, b) => b.remaining - a.remaining);
      for (const location of locations) {
        const capacity = Math.min(partCapacity, location.remaining);
        if (capacity <= 0) continue;
        return {
          partId: candidate.id,
          sourceLocationId: location.locationId,
          quantity: String(Math.min(remaining, capacity))
        };
      }
    }

    return blank;
  }

  return (
    <div className="grid gap-2">
      {entries.length > 0 && (
        <div className="grid grid-cols-[1fr_1fr_auto_auto] gap-2 text-xs text-[var(--color-text-muted)]">
          <span>{copy.part}</span>
          <span>{copy.sourceLocation}</span>
          <span>{copy.quantity}</span>
          <span aria-hidden="true" />
        </div>
      )}
      {entries.map((entry, index) => {
        const narrowed = narrowLocationsToBalances(locations, balancesByPart.get(entry.partId) ?? []);
        const overPart = partOver(entry.partId);
        const overLocation = locationOver(entry.partId, entry.sourceLocationId);
        return (
          <div key={index} className="grid grid-cols-[1fr_1fr_auto_auto] items-center gap-2">
            <BuildPartSelect
              name={`alloc-part-${line.id}-${index}`}
              options={selectablePartOptions.filter((p) => p.available > 0 || p.id === entry.partId)}
              value={entry.partId}
              placeholder={copy.unassigned}
              availableLabel={copy.available}
              noOptionsLabel={copy.noAvailableParts}
              invalid={overPart}
              onChange={(partId) => update(index, { partId, sourceLocationId: null })}
            />
            <LocationTreeSelect
              locations={narrowed.items}
              locationTree={narrowed.tree}
              copy={locationTreeSelectCopy(copy)}
              name={`alloc-${line.id}-${index}`}
              selectedId={entry.sourceLocationId ?? ""}
              onSelectedIdChange={(locationId) => update(index, { sourceLocationId: locationId || null })}
              emptyLabel={copy.unassigned}
              className="w-full"
              buttonClassName={`${formLocationSelectButtonClassName}${
                overLocation ? ` ${stockErrorBorder}` : ""
              }`}
            />
            <input
              className={`${smallSelectClass} w-20${overPart || overLocation ? ` ${stockErrorBorder}` : ""}`}
              type="number"
              min={1}
              step={1}
              value={entry.quantity}
              onChange={(e) => update(index, { quantity: e.target.value })}
            />
            <button
              type="button"
              className={removeButtonClass}
              title={copy.removeEntry}
              onClick={() => onEntriesChange(entries.filter((_, i) => i !== index))}
            >
              ✕
            </button>
          </div>
        );
      })}
      {!stockOk && (
        <p className="text-xs text-[var(--color-error)]">
          {anyPartOver ? copy.insufficientAvailableStock : copy.insufficientLocationStock}
        </p>
      )}
      <div>
        <button
          type="button"
          className={actionButtonClass}
          onClick={() => onEntriesChange([...entries, suggestNextEntry(entries)])}
        >
          {copy.addPartEntry}
        </button>
      </div>
    </div>
  );
}

function AllocatedCounter({
  copy,
  total,
  required
}: {
  copy: BuildsCopy;
  total: number;
  required: number;
}) {
  return (
    <span
      className={`text-xs ${
        total === required ? "text-[var(--color-success)]" : "text-[var(--color-text-muted)]"
      }`}
    >
      {copy.allocatedOfRequired}: {total}/{required}
    </span>
  );
}

function ReadOnlyAllocations({ copy, line }: { copy: BuildsCopy; line: BuildLine }) {
  if (line.allocations.length === 0) {
    return <p className="text-sm text-[var(--color-text-muted)]">{copy.unassigned}</p>;
  }
  return (
    <div className="grid gap-1 text-sm">
      {line.allocations.map((allocation) => (
        <div key={allocation.id} className="flex items-center justify-between gap-2">
          <span className="font-mono text-[var(--color-text-primary)]">
            <PartLink partId={allocation.part.id} name={allocation.part.catalogNumber} />
          </span>
          <span className="text-[var(--color-text-secondary)]">
            {(allocation.sourceLocation?.name ?? copy.unassigned) + " · " + allocation.quantity}
          </span>
        </div>
      ))}
    </div>
  );
}

function AssemblyList({
  canWrite,
  copy,
  line,
  locations,
  onAssemble,
  onReassign
}: {
  canWrite: boolean;
  copy: BuildsCopy;
  line: BuildLine;
  locations: StorageLocationListItem[];
  onAssemble: (input: { assignmentId: string; quantity: number }) => void;
  onReassign: (input: { assignmentId: string; partId: string; sourceLocationId: string | null }) => void;
}) {
  const [reassignId, setReassignId] = useState<string | null>(null);
  const balancesByPart = useMemo(
    () => new Map(line.partBalances.map((pb) => [pb.partId, pb.balances])),
    [line.partBalances]
  );

  return (
    <div className="grid gap-1.5">
      {line.assignments.map((assignment) => {
        const remaining = assignment.quantity - assignment.assembledQuantity;
        const done = remaining <= 0;
        const partLabel = assignment.part?.catalogNumber ?? copy.unassigned;
        const qtyLabel = assignment.quantity > 1 ? ` ${assignment.assembledQuantity}/${assignment.quantity}` : "";
        return (
          <div key={assignment.id} className="grid gap-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <span
                className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-mono text-xs ${
                  done
                    ? "bg-[var(--color-success-soft)] text-[var(--color-success)]"
                    : "border border-[var(--color-border-strong)] text-[var(--color-text-secondary)]"
                }`}
              >
                {done ? "✓ " : ""}
                {`${assignment.designator}${qtyLabel} · ${partLabel}`}
              </span>
              {!done && (
                <>
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
                  {canWrite && assignment.assembledQuantity === 0 && (
                    <button
                      className="rounded px-1 text-xs text-[var(--color-accent)] underline hover:bg-[var(--color-bg-subtle)]"
                      type="button"
                      onClick={() => setReassignId(reassignId === assignment.id ? null : assignment.id)}
                    >
                      {copy.changePart}
                    </button>
                  )}
                </>
              )}
            </div>
            {reassignId === assignment.id && (
              <ReassignEditor
                copy={copy}
                assignment={assignment}
                candidates={line.matchCandidates}
                balancesByPart={balancesByPart}
                locations={locations}
                onConfirm={(partId, sourceLocationId) => {
                  onReassign({ assignmentId: assignment.id, partId, sourceLocationId });
                  setReassignId(null);
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

function ReassignEditor({
  copy,
  assignment,
  candidates,
  balancesByPart,
  locations,
  onConfirm
}: {
  copy: BuildsCopy;
  assignment: BuildAssignment;
  candidates: BuildLine["matchCandidates"];
  balancesByPart: Map<string, { locationId: string; balance: string }[]>;
  locations: StorageLocationListItem[];
  onConfirm: (partId: string, sourceLocationId: string | null) => void;
}) {
  const [partId, setPartId] = useState(assignment.part?.id ?? "");
  const [sourceLocationId, setSourceLocationId] = useState<string | null>(
    assignment.sourceLocation?.id ?? null
  );

  const options = useMemo(() => {
    const opts = candidates.slice();
    if (assignment.part && !opts.some((p) => p.id === assignment.part!.id)) {
      opts.unshift({
        id: assignment.part.id,
        catalogNumber: assignment.part.catalogNumber,
        description: null,
        manufacturerName: "",
        availableQuantity: ""
      });
    }
    return opts;
  }, [candidates, assignment.part]);

  const narrowed = narrowLocationsToBalances(locations, balancesByPart.get(partId) ?? []);

  return (
    <div className="grid grid-cols-[1fr_1fr_auto] items-end gap-2 rounded-md border border-[var(--color-border)] bg-[var(--color-bg-subtle)] p-1.5">
      <select
        className={smallSelectClass}
        value={partId}
        onChange={(e) => {
          setPartId(e.target.value);
          setSourceLocationId(null);
        }}
      >
        <option value="">{copy.unassigned}</option>
        {options.map((part) => (
          <option key={part.id} value={part.id}>
            {part.catalogNumber}
            {part.manufacturerName ? ` · ${part.manufacturerName}` : ""}
            {part.availableQuantity ? ` — ${copy.available} ${part.availableQuantity}` : ""}
          </option>
        ))}
      </select>
      <LocationTreeSelect
        locations={narrowed.items}
        locationTree={narrowed.tree}
        copy={locationTreeSelectCopy(copy)}
        name={`reassign-${assignment.id}`}
        selectedId={sourceLocationId ?? ""}
        onSelectedIdChange={(locationId) => setSourceLocationId(locationId || null)}
        clearable
        emptyLabel={copy.unassigned}
        className="w-full"
        buttonClassName={formLocationSelectButtonClassName}
      />
      <button
        type="button"
        className={`${primaryActionClass} h-10`}
        disabled={!partId || !sourceLocationId}
        onClick={() => onConfirm(partId, sourceLocationId)}
      >
        {copy.confirm}
      </button>
    </div>
  );
}
