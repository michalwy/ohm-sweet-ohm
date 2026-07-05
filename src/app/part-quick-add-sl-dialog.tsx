"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";

import {
  addShoppingListItemForWorkspace,
  getShoppingListDetailForWorkspace,
  updateShoppingListItemForWorkspace,
} from "@/server/shopping-lists/shoppingListActions";
import type { PartsListItem } from "@/server/parts/getParts";
import {
  DialogActions,
  DialogBody,
  DialogShell,
  ErrorBubble,
  closeDialog,
  openDialog
} from "@/app/dialog-shell";
import { ShoppingListTargetFields, useShoppingListTarget } from "@/app/use-shopping-list-target";

type Copy = {
  cancel: string;
  close: string;
  quickAddSLTitle: string;
  chooseSL: string;
  noSLAvailable: string;
  createNewSL: string;
  slName: string;
  slNamePlaceholder: string;
  loadingLabel: string;
  quantity: string;
  notes: string;
  notesPlaceholder: string;
  addToShoppingList: string;
  addedToSlToast: string;
  quickAddError: string;
  missingQuantity: string;
  missingSLName: string;
};

export function QuickAddToSLDialog({
  copy,
  open,
  part,
  workspaceSlug,
  onClose,
  onSuccess
}: {
  copy: Copy;
  open: boolean;
  part: PartsListItem | null;
  workspaceSlug: string;
  onClose: () => void;
  onSuccess: (msg: string) => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const target = useShoppingListTarget({ workspaceSlug, open });
  const { mode, newSLName } = target;
  const [quantity, setQuantity] = useState("1");
  const [itemNotes, setItemNotes] = useState("");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ quantity?: string; slName?: string }>({});

  useEffect(() => {
    if (!open) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setQuantity("1");
    target.setNewSLName("");
    setItemNotes("");
    setSubmitError(null);
    setFieldErrors({});
    // eslint-disable-next-line react-hooks/exhaustive-deps -- target.setNewSLName is stable; only reset on open/part change
  }, [open, part?.id]);

  useEffect(() => {
    if (!dialogRef.current) return;
    if (open) {
      openDialog(dialogRef.current);
    } else {
      closeDialog(dialogRef.current);
    }
  }, [open]);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!part) throw new Error("no-part");

      const qty = quantity.trim();
      const errors: { quantity?: string; slName?: string } = {};
      if (!qty) errors.quantity = copy.missingQuantity;
      if (mode === "create-new" && !newSLName.trim()) errors.slName = copy.missingSLName;
      if (Object.keys(errors).length > 0) {
        setFieldErrors(errors);
        return null;
      }
      setFieldErrors({});

      const resolved = await target.resolveListId();
      if (!resolved.ok) return resolved;
      const listId = resolved.listId;

      if (mode !== "create-new") {
        const detailResult = await getShoppingListDetailForWorkspace({
          workspaceSlug,
          listId
        });
        if (!detailResult.ok) return detailResult;

        const slDetail = detailResult.data;
        if (slDetail) {
          const existingItems = slDetail.items.filter((item) => item.partId === part.id);
          if (existingItems.length > 0) {
            const last = existingItems[existingItems.length - 1];
            const existingQty = parseFloat(last.quantity) || 0;
            const addedQty = parseFloat(qty) || 0;
            const newQty = String(existingQty + addedQty);
            return updateShoppingListItemForWorkspace({
              workspaceSlug,
              listId,
              itemId: last.id,
              quantity: newQty,
              description: last.description
            });
          }
        }
      }

      return addShoppingListItemForWorkspace({
        workspaceSlug,
        listId,
        partId: part.id,
        quantity: qty,
        description: itemNotes.trim() || null
      });
    },
    onSuccess: (result) => {
      if (result === null) return;
      if (!result.ok) {
        setSubmitError(copy.quickAddError);
        return;
      }
      onSuccess(copy.addedToSlToast);
    },
    onError: () => {
      setSubmitError(copy.quickAddError);
    }
  });

  function resetAndClose() {
    setSubmitError(null);
    setFieldErrors({});
    onClose();
  }

  const isPending = mutation.isPending;

  return (
    <DialogShell
      ref={dialogRef}
      closeLabel={copy.close}
      title={
        part
          ? `${copy.quickAddSLTitle}: ${part.manufacturerName} ${part.catalogNumber}`
          : copy.quickAddSLTitle
      }
      titleId="quick-add-sl-dialog-title"
      widthClassName="w-[min(36rem,calc(100vw-3rem))]"
      onClose={resetAndClose}
    >
      <form
        className="flex min-h-0 flex-1 flex-col overflow-hidden"
        onSubmit={(e) => { e.preventDefault(); mutation.mutate(); }}
      >
        <DialogBody className="grid gap-4">
          {target.isLoading ? (
            <p className="text-sm text-[var(--color-text-muted)]">{copy.loadingLabel}</p>
          ) : (
            <>
              <ShoppingListTargetFields state={target} copy={copy} slNameError={fieldErrors.slName} />

              <label className="grid gap-1 text-sm">
                <span className="font-medium text-[var(--color-text-secondary)]">{copy.quantity}</span>
                <input
                  className="min-h-10 rounded-md border border-[var(--color-border-strong)] bg-[var(--color-bg-elevated)] px-3 py-1.5 text-sm text-[var(--color-text-primary)] outline-none"
                  value={quantity}
                  onChange={(e) => setQuantity(e.currentTarget.value)}
                />
                {fieldErrors.quantity ? (
                  <p className="text-xs text-[var(--color-error)]">{fieldErrors.quantity}</p>
                ) : null}
              </label>

              {mode !== "create-new" ? (
                <label className="grid gap-1 text-sm">
                  <span className="font-medium text-[var(--color-text-secondary)]">{copy.notes}</span>
                  <input
                    className="min-h-10 rounded-md border border-[var(--color-border-strong)] bg-[var(--color-bg-elevated)] px-3 py-1.5 text-sm text-[var(--color-text-primary)] outline-none"
                    placeholder={copy.notesPlaceholder}
                    value={itemNotes}
                    onChange={(e) => setItemNotes(e.currentTarget.value)}
                  />
                </label>
              ) : null}

              {submitError ? <ErrorBubble>{submitError}</ErrorBubble> : null}
            </>
          )}
        </DialogBody>
        <DialogActions
          actionLabel={copy.addToShoppingList}
          disabled={isPending || !part || target.isLoading}
        />
      </form>
    </DialogShell>
  );
}
