"use client";

import { useMemo, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";

import {
  createLocationForWorkspace,
  deleteLocationForWorkspace,
  updateLocationForWorkspace
} from "@/server/inventory/locationActions";
import type { StorageLocationListItem } from "@/server/inventory/locationMutations";
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
};

type LocationFormErrors = Partial<
  Record<"name" | "parentId" | "submit" | "delete", string>
>;

export function LocationsClient({
  canWriteLocations,
  copy,
  initialLocations,
  isDatabaseAvailable,
  workspaceSlug
}: {
  canWriteLocations: boolean;
  copy: Copy;
  initialLocations: StorageLocationListItem[];
  isDatabaseAvailable: boolean;
  workspaceSlug: string;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
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
  const [expandedLocationIds, setExpandedLocationIds] = useState<Set<string>>(
    new Set()
  );

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
      setLocationPendingDelete(null);
      setErrors({});
    }
  });

  const locationTree = useMemo(() => buildTree(locations), [locations]);
  const parentPickerLocations = useMemo(
    () => locations.filter((l) => !editingLocation || l.id !== editingLocation.id),
    [locations, editingLocation]
  );
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
      <div className="mb-3 flex justify-end">
        <button
          className="inline-flex min-h-10 items-center rounded-md bg-[var(--color-accent)] px-4 text-sm font-semibold text-white transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
          type="button"
          disabled={!isDatabaseAvailable || !canWriteLocations}
          onClick={() => openCreateForm()}
        >
          {copy.addLocation}
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-auto rounded-md border border-[var(--color-border)] bg-[var(--color-bg-elevated)]">
        {locations.length === 0 ? (
          <p className="px-4 py-6 text-sm text-[var(--color-text-secondary)]">{copy.noLocations}</p>
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
  canWriteLocations,
  copy,
  expandedLocationIds,
  isDatabaseAvailable,
  level,
  location,
  onAddChild,
  onDelete,
  onEdit,
  onToggleExpanded
}: {
  canWriteLocations: boolean;
  copy: Copy;
  expandedLocationIds: Set<string>;
  isDatabaseAvailable: boolean;
  level: number;
  location: LocationTreeItem;
  onAddChild: (parentId: string) => void;
  onDelete: (location: StorageLocationListItem) => void;
  onEdit: (location: StorageLocationListItem) => void;
  onToggleExpanded: (locationId: string) => void;
}) {
  const hasChildren = location.children.length > 0;
  const isExpanded = expandedLocationIds.has(location.id);
  const toggleLabel = isExpanded ? copy.collapseLocation : copy.expandLocation;
  const rowClassName = location.isAssignable
    ? "border-[var(--color-border-hover)] bg-[var(--color-bg-elevated)] text-[var(--color-text-primary)]"
    : "border-[var(--color-border-strong)] bg-[var(--color-bg-subtle)] text-[var(--color-text-secondary)]";

  return (
    <li className="grid gap-1">
      <div
        className={`grid min-h-12 grid-cols-[auto_1fr_auto] items-center gap-3 rounded-md border-l-4 px-3 py-2 ${rowClassName}`}
        style={{ marginLeft: `${level * 1.25}rem` }}
      >
        {hasChildren ? (
          <button
            aria-expanded={isExpanded}
            className="grid h-7 w-7 shrink-0 place-items-center rounded text-[var(--color-text-muted)] transition hover:bg-[var(--color-bg-elevated)]/70 hover:text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-ring-strong)] focus:ring-offset-2"
            title={`${toggleLabel} ${location.name}`}
            type="button"
            onClick={() => onToggleExpanded(location.id)}
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
          <p className="truncate text-sm font-medium">{location.name}</p>
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
            onClick={() => onAddChild(location.id)}
          >
            {copy.addChild}
          </button>
          <button
            className="min-h-9 rounded-md border border-[var(--color-border-strong)] bg-[var(--color-bg-elevated)] px-3 py-1.5 text-sm font-medium text-[var(--color-text-secondary)] transition hover:border-[var(--color-border-hover)] hover:bg-[var(--color-bg-subtle)] focus:outline-none focus:ring-2 focus:ring-[var(--color-ring-strong)] focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-[var(--color-bg-subtle)] disabled:text-[var(--color-text-placeholder)]"
            aria-label={copy.edit}
            type="button"
            disabled={!isDatabaseAvailable || !canWriteLocations}
            onClick={() => onEdit(location)}
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
            onClick={() => onDelete(location)}
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
              canWriteLocations={canWriteLocations}
              copy={copy}
              expandedLocationIds={expandedLocationIds}
              isDatabaseAvailable={isDatabaseAvailable}
              level={level + 1}
              location={child}
              onAddChild={onAddChild}
              onDelete={onDelete}
              onEdit={onEdit}
              onToggleExpanded={onToggleExpanded}
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
