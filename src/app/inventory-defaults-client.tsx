"use client";

import { useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";

import {
  LocationTreeSelect,
  formLocationSelectButtonClassName,
  type LocationTreeSelectCopy
} from "@/app/location-tree-select";
import { buildTree } from "@/app/tree-picker-utils";
import type { StorageLocationListItem } from "@/server/inventory/locationMutations";
import { updateWorkspaceInventoryDefaults } from "@/server/workspaces/inventoryDefaults";

type Copy = LocationTreeSelectCopy & {
  defaultLocation: string;
  defaultLocationHelp: string;
  saveChanges: string;
  saved: string;
  noPermission: string;
  permissionDenied: string;
  databaseUnavailable: string;
  invalidDefaultLocation: string;
};

type InventoryDefaultsClientProps = {
  canManage: boolean;
  copy: Copy;
  initialDefaultLocationId: string;
  locations: StorageLocationListItem[];
  workspaceSlug: string;
};

function getErrorMsg(copy: Copy, error: string) {
  if (error === "workspace-permission-denied") return copy.permissionDenied;
  if (error === "invalid-default-location") return copy.invalidDefaultLocation;
  return copy.databaseUnavailable;
}

/** Settings → Inventory (#39): the workspace's fallback default location. */
export function InventoryDefaultsClient({
  canManage,
  copy,
  initialDefaultLocationId,
  locations,
  workspaceSlug
}: InventoryDefaultsClientProps) {
  const [defaultLocationId, setDefaultLocationId] = useState(initialDefaultLocationId);
  const [savedOk, setSavedOk] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const locationTree = useMemo(() => buildTree(locations), [locations]);

  const mutation = useMutation({
    mutationFn: updateWorkspaceInventoryDefaults,
    onSuccess: (result) => {
      if (!result.ok) {
        setErrorMsg(getErrorMsg(copy, result.error));
        setSavedOk(false);
        return;
      }
      setErrorMsg(null);
      setSavedOk(true);
    }
  });

  function handleLocationChange(locationId: string) {
    setDefaultLocationId(locationId);
    setSavedOk(false);
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSavedOk(false);
    setErrorMsg(null);
    mutation.mutate({ workspaceSlug, defaultLocationId: defaultLocationId || null });
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-lg space-y-6">
      {!canManage ? (
        <p className="rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {copy.noPermission}
        </p>
      ) : null}

      <div className="grid gap-2">
        <p className="text-sm font-medium text-[var(--color-text-secondary)]">{copy.defaultLocation}</p>
        <LocationTreeSelect
          locations={locations}
          locationTree={locationTree}
          copy={{
            chooseLocation: copy.chooseLocation,
            searchLocations: copy.searchLocations,
            noMatchingLocations: copy.noMatchingLocations,
            expandLocation: copy.expandLocation,
            collapseLocation: copy.collapseLocation
          }}
          name="workspace-default-location"
          selectedId={defaultLocationId}
          onSelectedIdChange={handleLocationChange}
          clearable={canManage}
          onClear={() => handleLocationChange("")}
          disabled={!canManage}
          buttonClassName={formLocationSelectButtonClassName}
          className="w-full"
        />
        <p className="text-xs text-[var(--color-text-muted)]">{copy.defaultLocationHelp}</p>
      </div>

      {errorMsg ? (
        <p className="rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errorMsg}
        </p>
      ) : null}

      {savedOk ? (
        <p className="rounded-md border border-green-300 bg-green-50 px-4 py-3 text-sm text-green-700">
          {copy.saved}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={!canManage || mutation.isPending}
        className="min-h-10 rounded-md bg-[var(--color-accent)] px-4 text-sm font-semibold text-white transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {copy.saveChanges}
      </button>
    </form>
  );
}
