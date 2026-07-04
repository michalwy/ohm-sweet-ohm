"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  createInventoryEntryForWorkspace
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
};

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
    queryKey: ["locations-assignable", workspaceSlug],
    enabled: open && canReadInventory,
    queryFn: async () => {
      const result = await getLocationsForWorkspace({ workspaceSlug });
      if (!result.ok) {
        throw new Error(result.error);
      }
      return result.data.filter((location) => location.isAssignable && !location.isArchived);
    }
  });

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
              <label className="grid gap-1 text-sm">
                <span className="font-medium text-[var(--color-text-secondary)]">{copy.fromLocation}</span>
                <select
                  className="min-h-10 rounded-md border border-[var(--color-border-strong)] bg-[var(--color-bg-elevated)] px-3 py-1.5 text-sm text-[var(--color-text-primary)] outline-none"
                  disabled={!canWriteInventory}
                  onChange={(event) => setFromLocationId(event.currentTarget.value)}
                  value={fromLocationId}
                >
                  <option value="">{copy.location}</option>
                  {(locationsQuery.data ?? []).map((location) => (
                    <option key={location.id} value={location.id}>
                      {location.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}

            {showToLocation ? (
              <label className="grid gap-1 text-sm">
                <span className="font-medium text-[var(--color-text-secondary)]">{copy.toLocation}</span>
                <select
                  className="min-h-10 rounded-md border border-[var(--color-border-strong)] bg-[var(--color-bg-elevated)] px-3 py-1.5 text-sm text-[var(--color-text-primary)] outline-none"
                  disabled={!canWriteInventory}
                  onChange={(event) => setToLocationId(event.currentTarget.value)}
                  value={toLocationId}
                >
                  <option value="">{copy.location}</option>
                  {(locationsQuery.data ?? []).map((location) => (
                    <option key={location.id} value={location.id}>
                      {location.name}
                    </option>
                  ))}
                </select>
              </label>
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
