"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  createInventoryEntryForWorkspace,
  getPartBalancesForWorkspace
} from "@/server/inventory/entryActions";
import { getLocationsForWorkspace } from "@/server/inventory/locationActions";
import type { PartsListItem } from "@/server/parts/getParts";
import {
  DialogActions,
  DialogBody,
  DialogShell,
  closeDialog,
  openDialog
} from "@/app/dialog-shell";
import { buildTree } from "@/app/tree-picker-utils";
import {
  LocationTreeSelect,
  formLocationSelectButtonClassName,
  type LocationTreeItem,
  type LocationTreeSelectCopy
} from "@/app/location-tree-select";

type Copy = {
  cancel: string;
  close: string;
  stock: string;
  quantity: string;
  location: string;
  fromLocation: string;
  toLocation: string;
  note: string;
  addMovement: string;
  stockEntryType: string;
  receipt: string;
  issue: string;
  transfer: string;
  adjustment: string;
  noLocations: string;
  stockSaved: string;
  stockActionInvalid: string;
  stockInsufficientStock: string;
  stockInvalidQuantity: string;
  stockFractionalQuantityNotAllowed: string;
  stockLocationArchived: string;
  stockLocationNotAssignable: string;
  chooseLocation: string;
  searchLocations: string;
  noMatchingLocations: string;
  expandLocation: string;
  collapseLocation: string;
  available: string;
};

function locationTreeSelectCopy(copy: Copy): LocationTreeSelectCopy {
  return {
    chooseLocation: copy.chooseLocation,
    searchLocations: copy.searchLocations,
    noMatchingLocations: copy.noMatchingLocations,
    expandLocation: copy.expandLocation,
    collapseLocation: copy.collapseLocation
  };
}

function collectLocationIdsWithStock(
  tree: LocationTreeItem[],
  availableQuantityByLocationId: Map<string, string>,
  keep: Set<string>
): boolean {
  let anyKept = false;

  for (const node of tree) {
    const childKept = collectLocationIdsWithStock(node.children, availableQuantityByLocationId, keep);
    const ownQuantity = Number(availableQuantityByLocationId.get(node.id) ?? 0);
    const shouldKeep = ownQuantity > 0 || childKept;
    if (shouldKeep) {
      keep.add(node.id);
    }
    anyKept = anyKept || shouldKeep;
  }

  return anyKept;
}

function getStockActionErrorMessage(copy: Copy, error: string) {
  if (error === "insufficient-stock") {
    return copy.stockInsufficientStock;
  }
  if (error === "invalid-quantity") {
    return copy.stockInvalidQuantity;
  }
  if (error === "fractional-quantity-not-allowed") {
    return copy.stockFractionalQuantityNotAllowed;
  }
  if (error === "location-archived") {
    return copy.stockLocationArchived;
  }
  if (error === "location-not-assignable") {
    return copy.stockLocationNotAssignable;
  }
  return copy.stockActionInvalid;
}

type EntryType = "RECEIPT" | "ISSUE" | "TRANSFER" | "ADJUSTMENT";

export function PartStockDialog({
  canReadInventory,
  canWriteInventory,
  copy,
  open,
  onClose,
  onSuccess,
  part,
  workspaceSlug
}: {
  canReadInventory: boolean;
  canWriteInventory: boolean;
  copy: Copy;
  open: boolean;
  onClose: () => void;
  onSuccess: (msg: string) => void;
  part: PartsListItem | null;
  workspaceSlug: string;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const queryClient = useQueryClient();
  const [entryType, setEntryType] = useState<EntryType>("RECEIPT");
  const [quantity, setQuantity] = useState("");
  const [fromLocationId, setFromLocationId] = useState("");
  const [toLocationId, setToLocationId] = useState("");
  const [note, setNote] = useState("");
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setEntryType("RECEIPT");
    setQuantity("");
    setFromLocationId("");
    setToLocationId("");
    setNote("");
    setSubmitError(null);
  }, [open, part?.id]);

  const locationsQuery = useQuery({
    queryKey: ["locations-all", workspaceSlug, "stock-dialog"],
    enabled: open && canReadInventory,
    queryFn: async () => {
      const result = await getLocationsForWorkspace({ workspaceSlug });
      if (!result.ok) {
        throw new Error(result.error);
      }
      return result.data.filter((location) => !location.isArchived);
    }
  });
  const locations = useMemo(() => locationsQuery.data ?? [], [locationsQuery.data]);
  const locationTree = useMemo(() => buildTree(locations), [locations]);

  const balancesQuery = useQuery({
    queryKey: ["part-balances", workspaceSlug, part?.id, "stock-dialog"],
    enabled: open && canReadInventory && Boolean(part),
    queryFn: async () => {
      const result = await getPartBalancesForWorkspace({ workspaceSlug, partId: part!.id });
      if (!result.ok) {
        throw new Error(result.error);
      }
      return result.data;
    }
  });
  const availableQuantityByLocationId = useMemo(() => {
    const map = new Map<string, string>();
    for (const balance of balancesQuery.data ?? []) {
      map.set(balance.locationId, balance.availableQuantity);
    }
    return map;
  }, [balancesQuery.data]);

  const fromLocations = useMemo(() => {
    const keep = new Set<string>();
    collectLocationIdsWithStock(locationTree, availableQuantityByLocationId, keep);
    return locations
      .filter((location) => keep.has(location.id))
      .map((location) => ({
        ...location,
        isAssignable:
          location.isAssignable && Number(availableQuantityByLocationId.get(location.id) ?? 0) > 0
      }));
  }, [locations, locationTree, availableQuantityByLocationId]);
  const fromLocationTree = useMemo(() => buildTree(fromLocations), [fromLocations]);

  function describeFromLocation(location: { id: string }) {
    const quantity = availableQuantityByLocationId.get(location.id);
    if (quantity === undefined || Number(quantity) <= 0) {
      return undefined;
    }
    return `${copy.available}: ${quantity}`;
  }

  const movementMutation = useMutation({
    mutationFn: createInventoryEntryForWorkspace,
    onSuccess: async (result) => {
      if (!result.ok) {
        setSubmitError(result.error);
        return;
      }
      setQuantity("");
      setFromLocationId("");
      setToLocationId("");
      setNote("");
      setSubmitError(null);
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["part-balances", workspaceSlug, part?.id]
        }),
        queryClient.invalidateQueries({
          queryKey: ["part-balances", workspaceSlug, part?.id, "details-panel"]
        }),
        queryClient.invalidateQueries({
          queryKey: ["parts-list", workspaceSlug]
        }),
        queryClient.invalidateQueries({
          queryKey: ["part-inventory-history", workspaceSlug, part?.id]
        })
      ]);
      onSuccess(copy.stockSaved);
    }
  });

  function resetAndClose() {
    setSubmitError(null);
    onClose();
  }

  function submit() {
    if (!part) {
      return;
    }

    movementMutation.mutate({
      workspaceSlug,
      partId: part.id,
      entryType,
      quantity,
      fromLocationId: fromLocationId || null,
      toLocationId: toLocationId || null,
      note: note || null
    });
  }

  const showFromLocation = entryType === "ISSUE" || entryType === "TRANSFER";
  const showToLocation =
    entryType === "RECEIPT" || entryType === "TRANSFER" || entryType === "ADJUSTMENT";

  useEffect(() => {
    if (!dialogRef.current) {
      return;
    }
    if (open) {
      openDialog(dialogRef.current);
      return;
    }
    closeDialog(dialogRef.current);
  }, [open]);

  return (
    <DialogShell
      ref={dialogRef}
      closeLabel={copy.close}
      title={part ? `${copy.stock}: ${part.manufacturerName} ${part.catalogNumber}` : copy.stock}
      titleId="part-stock-dialog-title"
      widthClassName="w-[min(44rem,calc(100vw-3rem))]"
      onClose={resetAndClose}
    >
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <DialogBody className="grid gap-4">
          <section className="grid gap-3">
            <label className="grid gap-1 text-sm">
              <span className="font-medium text-[var(--color-text-secondary)]">{copy.stockEntryType}</span>
              <select
                className="min-h-10 rounded-md border border-[var(--color-border-strong)] bg-[var(--color-bg-elevated)] px-3 py-1.5 text-sm text-[var(--color-text-primary)] outline-none"
                disabled={!canWriteInventory}
                onChange={(event) => setEntryType(event.currentTarget.value as EntryType)}
                value={entryType}
              >
                <option value="RECEIPT">{copy.receipt}</option>
                <option value="ISSUE">{copy.issue}</option>
                <option value="TRANSFER">{copy.transfer}</option>
                <option value="ADJUSTMENT">{copy.adjustment}</option>
              </select>
            </label>

            <label className="grid gap-1 text-sm">
              <span className="font-medium text-[var(--color-text-secondary)]">{copy.quantity}</span>
              <input
                className="min-h-10 rounded-md border border-[var(--color-border-strong)] bg-[var(--color-bg-elevated)] px-3 py-1.5 text-sm text-[var(--color-text-primary)] outline-none"
                disabled={!canWriteInventory}
                onChange={(event) => setQuantity(event.currentTarget.value)}
                value={quantity}
              />
            </label>

            {showFromLocation ? (
              <div className="grid gap-1 text-sm">
                <span className="font-medium text-[var(--color-text-secondary)]">{copy.fromLocation}</span>
                <LocationTreeSelect
                  locations={fromLocations}
                  locationTree={fromLocationTree}
                  copy={locationTreeSelectCopy(copy)}
                  name="from-location-picker"
                  selectedId={fromLocationId}
                  onSelectedIdChange={setFromLocationId}
                  clearable={true}
                  onClear={() => setFromLocationId("")}
                  emptyLabel={copy.location}
                  disabled={!canWriteInventory}
                  describeLocation={describeFromLocation}
                  buttonClassName={formLocationSelectButtonClassName}
                  className="w-full"
                />
              </div>
            ) : null}

            {showToLocation ? (
              <div className="grid gap-1 text-sm">
                <span className="font-medium text-[var(--color-text-secondary)]">{copy.toLocation}</span>
                <LocationTreeSelect
                  locations={locations}
                  locationTree={locationTree}
                  copy={locationTreeSelectCopy(copy)}
                  name="to-location-picker"
                  selectedId={toLocationId}
                  onSelectedIdChange={setToLocationId}
                  clearable={true}
                  onClear={() => setToLocationId("")}
                  emptyLabel={copy.location}
                  disabled={!canWriteInventory}
                  buttonClassName={formLocationSelectButtonClassName}
                  className="w-full"
                />
              </div>
            ) : null}

            <label className="grid gap-1 text-sm">
              <span className="font-medium text-[var(--color-text-secondary)]">{copy.note}</span>
              <input
                className="min-h-10 rounded-md border border-[var(--color-border-strong)] bg-[var(--color-bg-elevated)] px-3 py-1.5 text-sm text-[var(--color-text-primary)] outline-none"
                disabled={!canWriteInventory}
                onChange={(event) => setNote(event.currentTarget.value)}
                value={note}
              />
            </label>
          </section>
        </DialogBody>
        <DialogActions
          actionLabel={copy.addMovement}
          disabled={!canWriteInventory || movementMutation.isPending || !part}
          error={submitError ? getStockActionErrorMessage(copy, submitError) : undefined}
          errorAlign="end"
          onAction={submit}
        />
      </div>
    </DialogShell>
  );
}
