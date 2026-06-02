"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  createInventoryEntryForWorkspace
} from "@/server/inventory/entryActions";
import { getLocationsForWorkspace } from "@/server/inventory/locationActions";
import type { PartsListItem } from "@/server/parts/getParts";
import {
  DialogBody,
  DialogFooter,
  DialogShell,
  ErrorBubble,
  closeDialog,
  openDialog
} from "@/app/dialog-shell";

type Copy = {
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
};

type EntryType = "RECEIPT" | "ISSUE" | "TRANSFER" | "ADJUSTMENT";

export function PartStockDialog({
  canReadInventory,
  canWriteInventory,
  copy,
  open,
  onClose,
  part,
  workspaceSlug
}: {
  canReadInventory: boolean;
  canWriteInventory: boolean;
  copy: Copy;
  open: boolean;
  onClose: () => void;
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
              <span className="font-medium text-slate-700">{copy.stockEntryType}</span>
              <select
                className="min-h-10 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-950 outline-none"
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
              <span className="font-medium text-slate-700">{copy.quantity}</span>
              <input
                className="min-h-10 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-950 outline-none"
                disabled={!canWriteInventory}
                onChange={(event) => setQuantity(event.currentTarget.value)}
                value={quantity}
              />
            </label>

            {showFromLocation ? (
              <label className="grid gap-1 text-sm">
                <span className="font-medium text-slate-700">{copy.fromLocation}</span>
                <select
                  className="min-h-10 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-950 outline-none"
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
                <span className="font-medium text-slate-700">{copy.toLocation}</span>
                <select
                  className="min-h-10 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-950 outline-none"
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
              <span className="font-medium text-slate-700">{copy.note}</span>
              <input
                className="min-h-10 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-950 outline-none"
                disabled={!canWriteInventory}
                onChange={(event) => setNote(event.currentTarget.value)}
                value={note}
              />
            </label>
            {submitError ? <ErrorBubble>{copy.stockActionInvalid}</ErrorBubble> : null}
          </section>
        </DialogBody>
        <DialogFooter className="justify-end gap-3">
          <button
            className="min-h-10 rounded-md border border-slate-300 px-3 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
            type="button"
            onClick={resetAndClose}
          >
            {copy.close}
          </button>
          <button
            className="min-h-10 rounded-md bg-[var(--color-accent)] px-4 text-sm font-semibold text-white transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={!canWriteInventory || movementMutation.isPending || !part}
            type="button"
            onClick={submit}
          >
            {copy.addMovement}
          </button>
        </DialogFooter>
      </div>
    </DialogShell>
  );
}
