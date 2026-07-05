"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";

import type { ProcurementItem } from "@/server/designs/shortageAnalysis";
import { addMultipleShoppingListItemsForWorkspace } from "@/server/shopping-lists/shoppingListActions";
import { mergeShoppingListRows } from "@/lib/shoppingListRowMerge";
import {
  DialogActions,
  DialogBody,
  DialogShell,
  closeDialog,
  openDialog
} from "@/app/dialog-shell";
import {
  ShoppingListTargetFields,
  useShoppingListTarget,
  type ShoppingListTargetCopy
} from "@/app/use-shopping-list-target";

export type ShortageToSLCopy = ShoppingListTargetCopy & {
  dialogTitle: string;
  catalogNumber: string;
  manufacturer: string;
  substitutePart: string;
  quantity: string;
  addToShoppingList: string;
  addedToSlToast: string;
  submitError: string;
  missingQuantities: string;
  cancel: string;
};

export const DEFAULT_SHORTAGE_TO_SL_COPY: ShortageToSLCopy = {
  dialogTitle: "Create shopping list",
  catalogNumber: "Catalog #",
  manufacturer: "Manufacturer",
  substitutePart: "Part",
  quantity: "Quantity",
  addToShoppingList: "Add to shopping list",
  addedToSlToast: "Added to shopping list.",
  submitError: "Failed to add items to the shopping list.",
  missingQuantities: "Enter a quantity for at least one item.",
  cancel: "Cancel",
  chooseSL: "Shopping list",
  createNewSL: "Create new list",
  slName: "List name",
  slNamePlaceholder: "e.g. Weekend restock",
  loadingLabel: "Loading…"
};

type RowState = {
  selectedPartId: string;
  quantity: string;
};

export function ShortageToShoppingListDialog({
  open,
  onClose,
  workspaceSlug,
  procurement,
  copy = DEFAULT_SHORTAGE_TO_SL_COPY,
  onSuccess
}: {
  open: boolean;
  onClose: () => void;
  workspaceSlug: string;
  procurement: ProcurementItem[];
  copy?: ShortageToSLCopy;
  onSuccess: (msg: string) => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const target = useShoppingListTarget({ workspaceSlug, open });
  const [rows, setRows] = useState<Map<string, RowState>>(new Map());
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRows(
      new Map(
        procurement.map((item) => [
          item.partId,
          { selectedPartId: item.partId, quantity: String(item.shortageQty) }
        ])
      )
    );
    setSubmitError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- procurement intentionally omitted: rows are only reseeded when the dialog opens
  }, [open]);

  useEffect(() => {
    if (!dialogRef.current) return;
    if (open) openDialog(dialogRef.current);
    else closeDialog(dialogRef.current);
  }, [open]);

  const candidatesByItem = useMemo(
    () => new Map(procurement.map((item) => [item.partId, item.candidates])),
    [procurement]
  );

  const mutation = useMutation({
    mutationFn: async () => {
      const merged = mergeShoppingListRows(
        procurement.map((item) => {
          const row = rows.get(item.partId);
          return { partId: row?.selectedPartId ?? item.partId, quantity: row?.quantity ?? "" };
        })
      );
      if (merged.length === 0) {
        return { ok: false as const, error: copy.missingQuantities };
      }

      const resolved = await target.resolveListId();
      if (!resolved.ok) return { ok: false as const, error: resolved.error };

      const result = await addMultipleShoppingListItemsForWorkspace({
        workspaceSlug,
        listId: resolved.listId,
        items: merged
      });
      if (!result.ok) return { ok: false as const, error: result.error };
      return { ok: true as const };
    },
    onSuccess: (result) => {
      if (!result.ok) {
        setSubmitError(result.error === copy.missingQuantities ? result.error : copy.submitError);
        return;
      }
      onSuccess(copy.addedToSlToast);
      onClose();
    },
    onError: () => {
      setSubmitError(copy.submitError);
    }
  });

  function updateRow(partId: string, patch: Partial<RowState>) {
    setRows((prev) => {
      const next = new Map(prev);
      const current = next.get(partId);
      if (!current) return prev;
      next.set(partId, { ...current, ...patch });
      return next;
    });
  }

  return (
    <DialogShell
      ref={dialogRef}
      closeLabel={copy.cancel}
      title={copy.dialogTitle}
      titleId="shortage-to-sl-dialog-title"
      widthClassName="w-[min(48rem,calc(100vw-3rem))]"
      onClose={onClose}
      onCloseClick={onClose}
    >
      <form
        className="flex min-h-0 flex-1 flex-col overflow-hidden"
        onSubmit={(e) => {
          e.preventDefault();
          mutation.mutate();
        }}
      >
        <DialogBody className="grid gap-4">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)] bg-[var(--color-bg-subtle)]">
                <th className="px-3 py-2 font-semibold text-[var(--color-text-secondary)]">
                  {copy.catalogNumber}
                </th>
                <th className="px-3 py-2 font-semibold text-[var(--color-text-secondary)]">
                  {copy.manufacturer}
                </th>
                <th className="w-28 px-3 py-2 text-right font-semibold text-[var(--color-text-secondary)]">
                  {copy.quantity}
                </th>
              </tr>
            </thead>
            <tbody>
              {procurement.map((item) => {
                const row = rows.get(item.partId);
                const candidates = candidatesByItem.get(item.partId) ?? [];
                const selected =
                  candidates.find((c) => c.partId === row?.selectedPartId) ?? {
                    partId: item.partId,
                    catalogNumber: item.catalogNumber,
                    manufacturerName: item.manufacturerName
                  };
                return (
                  <tr key={item.partId} className="border-b border-[var(--color-border)]">
                    <td className="px-3 py-2 font-medium text-[var(--color-text-primary)]">
                      {candidates.length > 1 ? (
                        <select
                          aria-label={copy.substitutePart}
                          className="min-h-8 rounded border border-[var(--color-border-strong)] bg-[var(--color-bg-elevated)] px-2 py-1 text-sm text-[var(--color-text-primary)] outline-none"
                          value={row?.selectedPartId ?? item.partId}
                          onChange={(e) => updateRow(item.partId, { selectedPartId: e.target.value })}
                        >
                          {candidates.map((candidate) => (
                            <option key={candidate.partId} value={candidate.partId}>
                              {candidate.catalogNumber} — {candidate.manufacturerName}
                            </option>
                          ))}
                        </select>
                      ) : (
                        selected.catalogNumber
                      )}
                    </td>
                    <td className="px-3 py-2 text-[var(--color-text-secondary)]">
                      {selected.manufacturerName}
                    </td>
                    <td className="px-3 py-2">
                      <input
                        className="w-full rounded border border-[var(--color-border-strong)] bg-[var(--color-bg-elevated)] px-2 py-1 text-right text-sm text-[var(--color-text-primary)] focus:border-[var(--color-action-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-action-primary)]"
                        type="number"
                        min="0"
                        step="any"
                        value={row?.quantity ?? ""}
                        onChange={(e) => updateRow(item.partId, { quantity: e.target.value })}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {target.isLoading ? (
            <p className="text-sm text-[var(--color-text-muted)]">{copy.loadingLabel}</p>
          ) : (
            <ShoppingListTargetFields state={target} copy={copy} />
          )}
        </DialogBody>
        <DialogActions
          actionLabel={copy.addToShoppingList}
          cancelLabel={copy.cancel}
          onCancel={onClose}
          disabled={mutation.isPending || target.isLoading}
          error={submitError}
        />
      </form>
    </DialogShell>
  );
}
