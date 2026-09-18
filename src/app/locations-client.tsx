"use client";

import { useMemo, useRef, useState } from "react";
import { FilterBar } from "@/app/list-filter-bar";
import type { FilterBarHandle } from "@/app/list-filter-bar";
import type { FilterDefinition } from "@/app/list-filter-config";
import { useListFilterConfiguration } from "@/app/list-filter-config";
import { useFilterUrlState } from "@/app/use-filter-url-state";
import { TREE_SELECT_NONE_ID } from "@/app/tree-select";
import { useMutation, useQuery } from "@tanstack/react-query";

import {
  createLocationForWorkspace,
  deleteLocationForWorkspace,
  updateLocationForWorkspace
} from "@/server/inventory/locationActions";
import type { StorageLocationListItem } from "@/server/inventory/locationMutations";
import { getLocationStockForWorkspace } from "@/server/inventory/entryActions";
import { DetailPanel, useDetailsPanelWidth } from "@/app/detail-panel";
import { PartLink } from "@/app/entity-links";
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
import { buildTree } from "@/app/tree-picker-utils";
import {
  LocationTreeSelect,
  type LocationTreeItem,
  type LocationTreeSelectCopy
} from "@/app/location-tree-select";

type Copy = {
  addLocation: string;
  addChild: string;
  edit: string;
  delete: string;
  close: string;
  cancelDelete: string;
  confirmDelete: string;
  deleteConfirmationBody: string;
  createLocation: string;
  saveChanges: string;
  newLocationTitle: string;
  editLocationTitle: string;
  name: string;
  parentLocation: string;
  rootLocation: string;
  type: string;
  assignable: string;
  organizational: string;
  archived: string;
  yes: string;
  no: string;
  chooseParentLocation: string;
  searchLocations: string;
  noMatchingLocations: string;
  expandLocation: string;
  collapseLocation: string;
  noLocations: string;
  actions: string;
  invalidInput: string;
  duplicateLocationName: string;
  locationInUse: string;
  locationHasChildren: string;
  locationHasStock: string;
  filterArchived: string;
  filterParentLocation: string;
  storedParts: string;
  includeSublocations: string;
  part: string;
  location: string;
  stock: string;
  available: string;
  loadingStock: string;
  loadStockError: string;
  noStoredParts: string;
  noStoredPartsWithSublocations: string;
};

type LocationFormErrors = Partial<
  Record<"name" | "parentId" | "submit" | "delete", string>
>;

export function LocationsClient({
  canReadInventory,
  canWriteLocations,
  copy,
  initialLocations,
  initialSelectedLocationId,
  isDatabaseAvailable,
  workspaceSlug
}: {
  canReadInventory: boolean;
  canWriteLocations: boolean;
  copy: Copy;
  initialLocations: StorageLocationListItem[];
  initialSelectedLocationId: string | null;
  isDatabaseAvailable: boolean;
  workspaceSlug: string;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const filterBarRef = useRef<FilterBarHandle>(null);
  const [formKey, setFormKey] = useState(0);
  const [locations, setLocations] = useState(initialLocations);
  const [editingLocation, setEditingLocation] = useState<StorageLocationListItem | null>(
    null
  );
  const [isCreateMode, setIsCreateMode] = useState(false);
  const [createParentId, setCreateParentId] = useState("");
  const [editParentId, setEditParentId] = useState("");
  const [locationPendingDelete, setLocationPendingDelete] =
    useState<StorageLocationListItem | null>(null);
  const [errors, setErrors] = useState<LocationFormErrors>({});
  const [expandedLocationIds, setExpandedLocationIds] = useState<Set<string>>(() =>
    getAncestorIds(initialLocations, initialSelectedLocationId)
  );
  const canOpenLocations = isDatabaseAvailable && canReadInventory;
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(
    canOpenLocations ? initialSelectedLocationId : null
  );
  const selectedLocation = selectedLocationId
    ? (locations.find((location) => location.id === selectedLocationId) ?? null)
    : null;
  const {
    width: detailsPanelWidth,
    hasLoaded: hasLoadedDetailsPanelWidth,
    startResizing: startResizingDetailsPanel
  } = useDetailsPanelWidth(`oso:locations-details-panel-width:${workspaceSlug}`, 480);

  function setSelectedLocationInUrl(locationId: string | null) {
    const url = new URL(window.location.href);
    if (locationId) {
      url.searchParams.set("selectedLocationId", locationId);
    } else {
      url.searchParams.delete("selectedLocationId");
    }
    window.history.replaceState(window.history.state, "", url.toString());
  }

  function openLocationDetails(location: StorageLocationListItem) {
    setSelectedLocationId(location.id);
    setSelectedLocationInUrl(location.id);
  }

  function closeLocationDetails() {
    setSelectedLocationId(null);
    setSelectedLocationInUrl(null);
  }

  const createMutation = useMutation({
    mutationFn: createLocationForWorkspace,
    onSuccess: (result) => {
      if (!result.ok) {
        setErrors(getLocationFormErrors(copy, result.error));
        return;
      }
      setLocations([...locations, result.data]);
      closeForm();
    }
  });

  const updateMutation = useMutation({
    mutationFn: updateLocationForWorkspace,
    onSuccess: (result) => {
      if (!result.ok) {
        setErrors(getLocationFormErrors(copy, result.error));
        return;
      }
      setLocations(
        locations.map((location) =>
          location.id === result.data.id ? result.data : location
        )
      );
      closeForm();
    }
  });

  const deleteMutation = useMutation({
    mutationFn: deleteLocationForWorkspace,
    onSuccess: (result, variables) => {
      if (!result.ok) {
        setErrors(getLocationFormErrors(copy, result.error));
        return;
      }
      setLocations((prev) =>
        prev.filter((location) => location.id !== variables.locationId)
      );
      if (variables.locationId === selectedLocationId) {
        closeLocationDetails();
      }
      setLocationPendingDelete(null);
      setErrors({});
    }
  });

  const locationTree = useMemo(() => buildTree(locations), [locations]);
  const parentPickerLocations = useMemo(
    () => locations.filter((l) => !editingLocation || l.id !== editingLocation.id),
    [locations, editingLocation]
  );

  // --- Search filter ---

  const locationFilterDefs = useMemo<FilterDefinition[]>(
    () => [
      {
        id: "search",
        label: copy.searchLocations,
        type: "text",
        urlParam: "q",
        debounceMs: 300,
        alwaysVisible: true
      },
      {
        id: "archived",
        label: copy.filterArchived,
        type: "boolean",
        urlParam: "archived",
        defaultVisible: true
      },
      {
        id: "parentId",
        label: copy.filterParentLocation,
        type: "tree",
        urlParam: "parent",
        defaultVisible: true,
        renderControl: ({ value, onChange, disabled }) => (
          <LocationTreeSelect
            locations={locations}
            locationTree={locationTree}
            copy={{
              chooseLocation: copy.filterParentLocation,
              searchLocations: copy.searchLocations,
              noMatchingLocations: copy.noMatchingLocations,
              expandLocation: copy.expandLocation,
              collapseLocation: copy.collapseLocation
            }}
            name="parentId-filter"
            selectedId={value || ""}
            onSelectedIdChange={onChange}
            noneOptionLabel={copy.rootLocation}
            emptyLabel={copy.filterParentLocation}
            clearable={Boolean(value)}
            onClear={() => onChange("")}
            className="min-w-52"
            disabled={disabled}
          />
        )
      }
    ],
    [
      copy.searchLocations,
      copy.filterArchived,
      copy.filterParentLocation,
      copy.noMatchingLocations,
      copy.expandLocation,
      copy.collapseLocation,
      copy.rootLocation,
      locations,
      locationTree
    ]
  );

  const { filterValues, setFilterValue, clearFilterValues, hasActiveFilters } =
    useFilterUrlState(locationFilterDefs);

  const { filterVisibility, filterOrder, configurableFilters, setFilterVisible, setFilterOrder } =
    useListFilterConfiguration({
      storageKey: `oso:filter-config:locations:${workspaceSlug}`,
      filters: locationFilterDefs
    });

  const searchQuery = filterValues.search ?? "";

  const filteredLocations = useMemo(() => {
    const hasAnyFilter =
      Boolean(searchQuery.trim()) ||
      Boolean(filterValues.archived) ||
      Boolean(filterValues.parentId);
    if (!hasAnyFilter) return null;
    let result = locations;
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter((l) => l.name.toLowerCase().includes(q));
    }
    if (filterValues.archived === "true") result = result.filter((l) => l.isArchived);
    else if (filterValues.archived === "false") result = result.filter((l) => !l.isArchived);
    if (filterValues.parentId === TREE_SELECT_NONE_ID)
      result = result.filter((l) => l.parentId === null);
    else if (filterValues.parentId)
      result = result.filter((l) => l.parentId === filterValues.parentId);
    return result;
  }, [locations, searchQuery, filterValues.archived, filterValues.parentId]);
  const parentPickerTree = useMemo(() => buildTree(parentPickerLocations), [parentPickerLocations]);

  function openCreateForm(parentId = "") {
    setEditingLocation(null);
    setIsCreateMode(true);
    setCreateParentId(parentId);
    setErrors({});
    setFormKey((current) => current + 1);
    window.requestAnimationFrame(() => openDialog(dialogRef.current));
  }

  function openEditForm(location: StorageLocationListItem) {
    setEditingLocation(location);
    setIsCreateMode(false);
    setEditParentId(location.parentId ?? "");
    setErrors({});
    setFormKey((current) => current + 1);
    window.requestAnimationFrame(() => openDialog(dialogRef.current));
  }

  function closeForm() {
    closeDialog(dialogRef.current);
    setErrors({});
    setEditingLocation(null);
    setIsCreateMode(false);
    setCreateParentId("");
    setEditParentId("");
  }

  function submit(formData: FormData) {
    const name = getFormString(formData, "name");
    const parentId = getFormString(formData, "parentId") || null;
    const isArchived = formData.get("isArchived") === "true";
    const isAssignable = getFormString(formData, "type") !== "organizational";

    if (!name) {
      setErrors({ name: copy.invalidInput });
      return;
    }

    if (isCreateMode) {
      createMutation.mutate({
        workspaceSlug,
        name,
        parentId,
        isAssignable
      });
      return;
    }

    if (!editingLocation) {
      return;
    }

    updateMutation.mutate({
      workspaceSlug,
      locationId: editingLocation.id,
      name,
      parentId,
      isAssignable,
      isArchived
    });
  }

  return (
    <section className="flex min-h-0 flex-1 flex-col">
      <div className="mb-3 flex flex-wrap items-end gap-3">
        <FilterBar
          ref={filterBarRef}
          configurableFilters={configurableFilters}
          disabled={false}
          filterOrder={filterOrder}
          filterValues={filterValues}
          filterVisibility={filterVisibility}
          filters={locationFilterDefs}
          onFilterChange={setFilterValue}
          setFilterOrder={setFilterOrder}
          setFilterVisible={setFilterVisible}
        />
        <div className="ml-auto flex items-center gap-2">
          <button
            className="min-h-9 text-sm font-medium text-[var(--color-text-muted)] transition hover:text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-ring)] focus:ring-offset-2"
            type="button"
            onClick={() => filterBarRef.current?.openConfigure()}
          >
            Configure filters
          </button>
          {hasActiveFilters ? (
            <button
              className="min-h-9 text-sm font-medium text-[var(--color-accent)] hover:underline focus:outline-none focus:ring-2 focus:ring-[var(--color-ring)] focus:ring-offset-2"
              type="button"
              onClick={clearFilterValues}
            >
              Clear filters
            </button>
          ) : null}
          <button
            className="inline-flex min-h-10 items-center rounded-md bg-[var(--color-accent)] px-4 text-sm font-semibold text-white transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
            type="button"
            disabled={!isDatabaseAvailable || !canWriteLocations}
            onClick={() => openCreateForm()}
          >
            {copy.addLocation}
          </button>
        </div>
      </div>
      <div className="flex min-h-0 flex-1 gap-4">
        <div className="min-h-0 flex-1 overflow-auto rounded-md border border-[var(--color-border)] bg-[var(--color-bg-elevated)]">
          {locations.length === 0 ? (
            <p className="px-4 py-6 text-sm text-[var(--color-text-secondary)]">{copy.noLocations}</p>
          ) : filteredLocations !== null ? (
            <div className="p-4">
              {filteredLocations.length === 0 ? (
                <p className="text-sm text-[var(--color-text-muted)]">{copy.noMatchingLocations}</p>
              ) : (
                <ol className="grid gap-1">
                  {filteredLocations.map((location) => (
                    <LocationNode
                      canOpen={canOpenLocations}
                      canWriteLocations={canWriteLocations}
                      key={location.id}
                      copy={copy}
                      expandedLocationIds={expandedLocationIds}
                      isDatabaseAvailable={isDatabaseAvailable}
                      level={0}
                      location={{ ...location, children: [] }}
                      onAddChild={(parentId) => openCreateForm(parentId)}
                      onDelete={(locationToDelete) => {
                        setErrors({});
                        setLocationPendingDelete(locationToDelete);
                      }}
                      onEdit={openEditForm}
                      onOpen={openLocationDetails}
                      selectedLocationId={selectedLocationId}
                      onToggleExpanded={() => undefined}
                    />
                  ))}
                </ol>
              )}
            </div>
          ) : (
            <div className="p-4">
              <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-[var(--color-text-muted)]">
                <span className="inline-flex items-center gap-2">
                  <span className="h-3 w-3 rounded-sm border border-[var(--color-border-hover)] bg-[var(--color-bg-elevated)]" />
                  {copy.assignable}
                </span>
                <span className="inline-flex items-center gap-2">
                  <span className="h-3 w-3 rounded-sm border border-[var(--color-border-strong)] bg-[var(--color-bg-muted)]" />
                  {copy.organizational}
                </span>
              </div>
              <ol className="grid gap-1">
                {locationTree.map((location) => (
                  <LocationNode
                    canOpen={canOpenLocations}
                    canWriteLocations={canWriteLocations}
                    key={location.id}
                    copy={copy}
                    expandedLocationIds={expandedLocationIds}
                    isDatabaseAvailable={isDatabaseAvailable}
                    level={0}
                    location={location}
                    onAddChild={(parentId) => openCreateForm(parentId)}
                    onDelete={(locationToDelete) => {
                      setErrors({});
                      setLocationPendingDelete(locationToDelete);
                    }}
                    onEdit={openEditForm}
                    onOpen={openLocationDetails}
                    selectedLocationId={selectedLocationId}
                    onToggleExpanded={(locationId) => {
                      const nextIds = new Set(expandedLocationIds);
                      if (nextIds.has(locationId)) {
                        nextIds.delete(locationId);
                      } else {
                        nextIds.add(locationId);
                      }
                      setExpandedLocationIds(nextIds);
                    }}
                  />
                ))}
              </ol>
            </div>
          )}
        </div>
        {selectedLocation && hasLoadedDetailsPanelWidth ? (
          <DetailPanel
            closeLabel={copy.close}
            title={selectedLocation.name}
            subtitle={selectedLocation.isArchived ? copy.archived : undefined}
            width={detailsPanelWidth}
            onClose={closeLocationDetails}
            onStartResize={startResizingDetailsPanel}
          >
            <LocationStockSection
              copy={copy}
              locationId={selectedLocation.id}
              workspaceSlug={workspaceSlug}
            />
          </DetailPanel>
        ) : null}
      </div>
      {errors.delete ? (
        <div className="mt-3">
          <ErrorBubble align="start">{errors.delete}</ErrorBubble>
        </div>
      ) : null}

      <DialogShell
        ref={dialogRef}
        closeLabel={copy.close}
        title={isCreateMode ? copy.newLocationTitle : copy.editLocationTitle}
        titleId="location-dialog-title"
        widthClassName="w-[min(34rem,calc(100vw-3rem))]"
        onClose={closeForm}
      >
        {isCreateMode || editingLocation ? (
          <form
            key={formKey}
            action={submit}
            className="flex min-h-0 flex-1 flex-col overflow-hidden"
          >
            <DialogBody className="grid gap-4">
              <label className="grid gap-2 text-sm font-medium text-[var(--color-text-secondary)]">
                <LabelWithError htmlFor="location-name" error={errors.name}>
                  {copy.name}
                </LabelWithError>
                <input
                  id="location-name"
                  name="name"
                  defaultValue={editingLocation?.name ?? ""}
                  className={getFieldInputClassName(
                    "min-h-10 rounded-md border border-[var(--color-border-strong)] bg-[var(--color-bg-elevated)] px-3 py-1.5 text-sm text-[var(--color-text-primary)] outline-none",
                    Boolean(errors.name)
                  )}
                />
              </label>
              <div className="grid gap-2 text-sm font-medium text-[var(--color-text-secondary)]">
                <span>{copy.parentLocation}</span>
                <input
                  name="parentId"
                  type="hidden"
                  value={isCreateMode ? createParentId : editParentId}
                />
                <LocationTreeSelect
                  locations={parentPickerLocations}
                  locationTree={parentPickerTree}
                  copy={{
                    chooseLocation: copy.chooseParentLocation,
                    searchLocations: copy.searchLocations,
                    noMatchingLocations: copy.noMatchingLocations,
                    expandLocation: copy.expandLocation,
                    collapseLocation: copy.collapseLocation
                  } satisfies LocationTreeSelectCopy}
                  name="parentId-picker"
                  selectedId={isCreateMode ? createParentId : editParentId}
                  onSelectedIdChange={(id) =>
                    isCreateMode ? setCreateParentId(id) : setEditParentId(id)
                  }
                  emptyLabel={copy.rootLocation}
                  clearable={true}
                  onClear={() =>
                    isCreateMode ? setCreateParentId("") : setEditParentId("")
                  }
                  className="w-full"
                />
              </div>
              <fieldset className="grid gap-2">
                <legend className="text-sm font-medium text-[var(--color-text-secondary)]">
                  {copy.type}
                </legend>
                <div className="grid grid-cols-2 gap-2">
                  <label className="relative">
                    <input
                      className="peer sr-only"
                      defaultChecked={!(editingLocation?.isAssignable ?? true)}
                      disabled={!isDatabaseAvailable}
                      name="type"
                      type="radio"
                      value="organizational"
                    />
                    <span className="grid min-h-11 cursor-pointer place-items-center rounded-md border border-[var(--color-border-strong)] bg-[var(--color-bg-elevated)] px-3 py-2 text-sm font-medium text-[var(--color-text-secondary)] transition peer-checked:border-[var(--color-border-hover)] peer-checked:bg-[var(--color-bg-muted)] peer-focus:ring-2 peer-focus:ring-[var(--color-ring)] peer-disabled:cursor-not-allowed peer-disabled:bg-[var(--color-bg-subtle)] peer-disabled:text-[var(--color-text-placeholder)]">
                      {copy.organizational}
                    </span>
                  </label>
                  <label className="relative">
                    <input
                      className="peer sr-only"
                      defaultChecked={editingLocation?.isAssignable ?? true}
                      disabled={!isDatabaseAvailable}
                      name="type"
                      type="radio"
                      value="assignable"
                    />
                    <span className="grid min-h-10 cursor-pointer place-items-center rounded-md border border-[var(--color-border-strong)] bg-[var(--color-bg-elevated)] px-3 py-1.5 text-sm font-medium text-[var(--color-text-secondary)] transition peer-checked:border-[var(--color-accent-border)] peer-checked:bg-[var(--color-accent-soft)] peer-focus:ring-2 peer-focus:ring-[var(--color-action-focus)] peer-disabled:cursor-not-allowed peer-disabled:bg-[var(--color-bg-subtle)] peer-disabled:text-[var(--color-text-placeholder)]">
                      {copy.assignable}
                    </span>
                  </label>
                </div>
              </fieldset>
              {!isCreateMode ? (
                <label className="inline-flex items-center gap-2 text-sm text-[var(--color-text-primary)]">
                  <input
                    type="checkbox"
                    name="isArchived"
                    value="true"
                    defaultChecked={editingLocation?.isArchived ?? false}
                  />
                  {copy.archived}
                </label>
              ) : null}
            </DialogBody>
            <DialogActions
              actionLabel={isCreateMode ? copy.createLocation : copy.saveChanges}
              disabled={createMutation.isPending || updateMutation.isPending}
            />
            {errors.submit ? <ErrorBubble>{errors.submit}</ErrorBubble> : null}
          </form>
        ) : null}
      </DialogShell>

      <DeleteConfirmationDialog
        body={copy.deleteConfirmationBody}
        cancelLabel={copy.cancelDelete}
        closeLabel={copy.close}
        confirmLabel={copy.confirmDelete}
        deleteLabel={copy.delete}
        isPending={deleteMutation.isPending}
        itemName={locationPendingDelete?.name ?? ""}
        open={Boolean(locationPendingDelete)}
        onCancel={() => setLocationPendingDelete(null)}
        onConfirm={() => {
          if (!locationPendingDelete) {
            return;
          }
          deleteMutation.mutate({
            workspaceSlug,
            locationId: locationPendingDelete.id
          });
        }}
      />
    </section>
  );
}

function getLocationFormErrors(copy: Copy, error: string): LocationFormErrors {
  if (error === "duplicate-location-name") {
    return { name: copy.duplicateLocationName };
  }
  if (error === "location-in-use") {
    return { delete: copy.locationInUse };
  }
  if (error === "location-has-children") {
    return { delete: copy.locationHasChildren };
  }
  if (error === "location-has-stock") {
    return { submit: copy.locationHasStock };
  }
  return { submit: copy.invalidInput };
}

function LocationNode({
  canOpen,
  canWriteLocations,
  copy,
  expandedLocationIds,
  isDatabaseAvailable,
  level,
  location,
  onAddChild,
  onDelete,
  onEdit,
  onOpen,
  onToggleExpanded,
  selectedLocationId
}: {
  canOpen: boolean;
  canWriteLocations: boolean;
  copy: Copy;
  expandedLocationIds: Set<string>;
  isDatabaseAvailable: boolean;
  level: number;
  location: LocationTreeItem;
  onAddChild: (parentId: string) => void;
  onDelete: (location: StorageLocationListItem) => void;
  onEdit: (location: StorageLocationListItem) => void;
  onOpen: (location: StorageLocationListItem) => void;
  onToggleExpanded: (locationId: string) => void;
  selectedLocationId: string | null;
}) {
  const hasChildren = location.children.length > 0;
  const isExpanded = expandedLocationIds.has(location.id);
  const toggleLabel = isExpanded ? copy.collapseLocation : copy.expandLocation;
  const isSelected = location.id === selectedLocationId;
  const rowClassName = [
    location.isAssignable
      ? "border-[var(--color-border-hover)] text-[var(--color-text-primary)]"
      : "border-[var(--color-border-strong)] text-[var(--color-text-secondary)]",
    isSelected
      ? "bg-[var(--color-bg-muted)]"
      : location.isAssignable
        ? "bg-[var(--color-bg-elevated)]"
        : "bg-[var(--color-bg-subtle)]",
    canOpen ? "cursor-pointer hover:bg-[var(--color-bg-muted)]" : ""
  ].join(" ");

  return (
    <li className="grid gap-1">
      <div
        aria-current={isSelected ? "true" : undefined}
        className={`grid min-h-12 grid-cols-[auto_1fr_auto] items-center gap-3 rounded-md border-l-4 px-3 py-2 ${rowClassName}`}
        style={{ marginLeft: `${level * 1.25}rem` }}
        onClick={canOpen ? () => onOpen(location) : undefined}
      >
        {hasChildren ? (
          <button
            aria-expanded={isExpanded}
            className="grid h-7 w-7 shrink-0 place-items-center rounded text-[var(--color-text-muted)] transition hover:bg-[var(--color-bg-elevated)]/70 hover:text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-ring-strong)] focus:ring-offset-2"
            title={`${toggleLabel} ${location.name}`}
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onToggleExpanded(location.id);
            }}
          >
            <span
              aria-hidden="true"
              className={`text-sm leading-none transition-transform ${
                isExpanded ? "rotate-90" : ""
              }`}
            >
              ▶
            </span>
            <span className="sr-only">{toggleLabel}</span>
          </button>
        ) : (
          <span className="h-7 w-7" aria-hidden="true" />
        )}
        <div className="min-w-0">
          {canOpen ? (
            // Its click bubbles to the row, which opens the location; the button adds keyboard access.
            <button
              className="block max-w-full truncate rounded text-left text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[var(--color-ring-strong)] focus:ring-offset-2"
              type="button"
            >
              {location.name}
            </button>
          ) : (
            <p className="truncate text-sm font-medium">{location.name}</p>
          )}
          {location.isArchived ? (
            <p className="text-xs text-[var(--color-text-muted)]">
              {copy.archived}: {copy.yes}
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            className="min-h-9 rounded-md border border-[var(--color-border-strong)] bg-[var(--color-bg-elevated)] px-3 py-1.5 text-sm font-medium text-[var(--color-text-secondary)] transition hover:border-[var(--color-border-hover)] hover:bg-[var(--color-bg-subtle)] focus:outline-none focus:ring-2 focus:ring-[var(--color-ring-strong)] focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-[var(--color-bg-subtle)] disabled:text-[var(--color-text-placeholder)]"
            type="button"
            disabled={!isDatabaseAvailable || !canWriteLocations}
            onClick={(event) => {
              event.stopPropagation();
              onAddChild(location.id);
            }}
          >
            {copy.addChild}
          </button>
          <button
            className="min-h-9 rounded-md border border-[var(--color-border-strong)] bg-[var(--color-bg-elevated)] px-3 py-1.5 text-sm font-medium text-[var(--color-text-secondary)] transition hover:border-[var(--color-border-hover)] hover:bg-[var(--color-bg-subtle)] focus:outline-none focus:ring-2 focus:ring-[var(--color-ring-strong)] focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-[var(--color-bg-subtle)] disabled:text-[var(--color-text-placeholder)]"
            aria-label={copy.edit}
            type="button"
            disabled={!isDatabaseAvailable || !canWriteLocations}
            onClick={(event) => {
              event.stopPropagation();
              onEdit(location);
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
            className="min-h-9 rounded-md border border-[var(--color-error-border)] bg-[var(--color-bg-elevated)] px-3 py-1.5 text-sm font-medium text-[var(--color-error)] transition hover:bg-[var(--color-error-soft)] focus:outline-none focus:ring-2 focus:ring-[var(--color-error-border)] focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-[var(--color-bg-subtle)] disabled:text-[var(--color-text-placeholder)]"
            aria-label={copy.delete}
            type="button"
            disabled={!isDatabaseAvailable || !canWriteLocations}
            onClick={(event) => {
              event.stopPropagation();
              onDelete(location);
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
      </div>
      {hasChildren && isExpanded ? (
        <ol className="grid gap-1">
          {location.children.map((child) => (
            <LocationNode
              key={child.id}
              canOpen={canOpen}
              canWriteLocations={canWriteLocations}
              copy={copy}
              expandedLocationIds={expandedLocationIds}
              isDatabaseAvailable={isDatabaseAvailable}
              level={level + 1}
              location={child}
              onAddChild={onAddChild}
              onDelete={onDelete}
              onEdit={onEdit}
              onOpen={onOpen}
              onToggleExpanded={onToggleExpanded}
              selectedLocationId={selectedLocationId}
            />
          ))}
        </ol>
      ) : null}
    </li>
  );
}

function getFormString(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

function getAncestorIds(
  locations: StorageLocationListItem[],
  locationId: string | null
): Set<string> {
  const parentIdById = new Map(locations.map((location) => [location.id, location.parentId]));
  const ancestorIds = new Set<string>();
  let parentId = locationId ? parentIdById.get(locationId) : null;
  while (parentId && !ancestorIds.has(parentId)) {
    ancestorIds.add(parentId);
    parentId = parentIdById.get(parentId);
  }
  return ancestorIds;
}

function LocationStockSection({
  copy,
  locationId,
  workspaceSlug
}: {
  copy: Copy;
  locationId: string;
  workspaceSlug: string;
}) {
  const [includeSublocations, setIncludeSublocations] = useState(false);
  const stockQuery = useQuery({
    queryKey: ["location-stock", workspaceSlug, locationId, includeSublocations],
    queryFn: async () => {
      const result = await getLocationStockForWorkspace({
        workspaceSlug,
        locationId,
        includeSublocations
      });
      if (!result.ok) throw new Error(result.error);
      return result.data;
    }
  });
  const messageClassName =
    "rounded-md border border-[var(--color-border)] bg-[var(--color-bg-subtle)] px-3 py-2 text-sm text-[var(--color-text-secondary)]";

  return (
    <section className="grid gap-2">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
          {copy.storedParts}
        </h3>
        <label className="inline-flex items-center gap-2 text-sm text-[var(--color-text-secondary)]">
          <input
            type="checkbox"
            checked={includeSublocations}
            onChange={(event) => setIncludeSublocations(event.target.checked)}
          />
          {copy.includeSublocations}
        </label>
      </div>
      {stockQuery.isLoading ? (
        <p className={messageClassName}>{copy.loadingStock}</p>
      ) : stockQuery.isError ? (
        <p className={messageClassName}>{copy.loadStockError}</p>
      ) : (stockQuery.data ?? []).length === 0 ? (
        <p className={messageClassName}>
          {includeSublocations ? copy.noStoredPartsWithSublocations : copy.noStoredParts}
        </p>
      ) : (
        <div className="overflow-hidden rounded-md border border-[var(--color-border)]">
          <table className="w-full text-left text-sm">
            <thead className="bg-[var(--color-bg-subtle)] text-[var(--color-text-secondary)]">
              <tr>
                <th className="px-3 py-2 font-semibold">{copy.part}</th>
                {includeSublocations ? (
                  <th className="px-3 py-2 font-semibold">{copy.location}</th>
                ) : null}
                <th className="px-3 py-2 text-right font-semibold">{copy.stock}</th>
                <th className="px-3 py-2 text-right font-semibold">{copy.available}</th>
              </tr>
            </thead>
            <tbody>
              {(stockQuery.data ?? []).map((row) => (
                <tr
                  key={`${row.partId}:${row.locationId}`}
                  className="group border-t border-[var(--color-border)] align-top"
                >
                  <td className="px-3 py-2">
                    <div className="font-medium text-[var(--color-text-primary)]">
                      <PartLink partId={row.partId} name={row.catalogNumber} />
                    </div>
                    <div className="text-xs text-[var(--color-text-muted)]">
                      {row.manufacturerName}
                    </div>
                    {row.description ? (
                      <div className="text-xs text-[var(--color-text-secondary)]">
                        {row.description}
                      </div>
                    ) : null}
                  </td>
                  {includeSublocations ? (
                    <td className="px-3 py-2 text-[var(--color-text-secondary)]">
                      {row.locationPath}
                    </td>
                  ) : null}
                  <td className="px-3 py-2 text-right font-semibold text-[var(--color-text-primary)]">
                    {row.quantity}
                  </td>
                  <td className="px-3 py-2 text-right font-semibold text-[var(--color-text-primary)]">
                    {row.availableQuantity}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
