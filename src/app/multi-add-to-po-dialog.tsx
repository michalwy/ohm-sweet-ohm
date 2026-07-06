"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";

import type { PartsListItem } from "@/server/parts/getParts";
import { addMultipleOrderItemsForWorkspace } from "@/server/purchase-orders/purchaseOrderActions";
import { closeDialog, DialogBody, DialogFooter, DialogPrimaryButton, DialogSecondaryButton, DialogShell, openDialog } from "@/app/dialog-shell";
import { PartPickerListModal, type PartPickerCopy } from "@/app/part-picker-list-modal";

export type MultiAddToPOCopy = PartPickerCopy & {
  pickerTitle: string;
  quantitiesTitle: string;
  part: string;
  quantity: string;
  /** e.g. "Already on order" — shown in badge; qty is appended automatically. */
  alreadyAdded: string;
  cancel: string;
  back: string;
  addItems: string;
  addItem: string;
  submitting: string;
};

type MultiAddToPODialogProps = {
  workspaceSlug: string;
  orderId: string;
  /**
   * Parts already on this order: partId → current quantity string.
   * Used to show "Already on order · N" badge in step 2 and to mark parts
   * in the picker table.
   */
  existingParts: ReadonlyMap<string, string>;
  open: boolean;
  copy: MultiAddToPOCopy;
  onClose: () => void;
  onSuccess: () => void;
};

/** Format "5.0000" → "5", "2.5" → "2.5". */
function fmtQty(qty: string): string {
  const n = parseFloat(qty);
  if (isNaN(n)) return qty;
  return n % 1 === 0 ? String(Math.round(n)) : n.toString();
}

export function MultiAddToPODialog({
  workspaceSlug,
  orderId,
  existingParts,
  open,
  copy,
  onClose,
  onSuccess
}: MultiAddToPODialogProps) {
  const [step, setStep] = useState<"select" | "quantities">("select");
  const [selectedParts, setSelectedParts] = useState<PartsListItem[]>([]);
  const [quantities, setQuantities] = useState<Map<string, string>>(new Map());
  const qtyDialogRef = useRef<HTMLDialogElement>(null);

  // Set to true before any programmatic closeDialog() on the qty dialog so the
  // resulting native `close` event is swallowed instead of calling handleClose.
  const suppressQtyCloseRef = useRef(false);
  // Guards against handleClose being called twice (e.g. once directly from a
  // button, then again from the native `close` event when the dialog finally
  // closes via the useEffect below).
  const isClosingRef = useRef(false);

  // Open / close the qty dialog whenever the wizard step changes.
  useEffect(() => {
    if (step === "quantities") {
      window.requestAnimationFrame(() => openDialog(qtyDialogRef.current));
    } else {
      suppressQtyCloseRef.current = true;
      closeDialog(qtyDialogRef.current);
    }
  }, [step]);

  function handleConfirmSelection(parts: PartsListItem[]) {
    setSelectedParts(parts);
    const nextQtys = new Map<string, string>();
    for (const part of parts) {
      nextQtys.set(part.id, quantities.get(part.id) ?? "1");
    }
    setQuantities(nextQtys);
    setStep("quantities");
  }

  function handleBack() {
    setStep("select");
  }

  function handleClose() {
    if (isClosingRef.current) return;
    isClosingRef.current = true;
    setStep("select");
    setSelectedParts([]);
    setQuantities(new Map());
    onClose();
    setTimeout(() => {
      isClosingRef.current = false;
    }, 0);
  }

  function handleQtyDialogClose() {
    if (suppressQtyCloseRef.current) {
      suppressQtyCloseRef.current = false;
      return;
    }
    handleClose();
  }

  const addMutation = useMutation({
    mutationFn: async () => {
      const items = selectedParts.map((part) => ({
        partId: part.id,
        quantity: quantities.get(part.id) ?? "1"
      }));
      const result = await addMultipleOrderItemsForWorkspace({ workspaceSlug, orderId, items });
      if (!result.ok) throw new Error(result.error);
    },
    onSuccess: () => {
      handleClose();
      onSuccess();
    }
  });

  // The picker only needs IDs; derive the Set so we don't expose the Map.
  const existingPartIds = new Set(existingParts.keys());
  const pickerCopy: PartPickerCopy = { ...copy, title: copy.pickerTitle };

  return (
    <>
      {/*
       * The picker stays open for the entire wizard so its internal checkbox
       * selection is preserved. The qty dialog stacks on top via showModal.
       */}
      <PartPickerListModal
        workspaceSlug={workspaceSlug}
        contextKey="add-to-po"
        alreadyAddedPartIds={existingPartIds}
        open={open}
        copy={pickerCopy}
        onClose={handleClose}
        onConfirm={handleConfirmSelection}
      />

      <DialogShell
        ref={qtyDialogRef}
        closeLabel={copy.cancel}
        title={copy.quantitiesTitle}
        titleId="multi-add-po-qty-title"
        widthClassName="w-[min(40rem,calc(100vw-3rem))]"
        onClose={handleQtyDialogClose}
        onCancel={(event) => {
          event.preventDefault();
          handleClose();
        }}
        onCloseClick={() => handleClose()}
      >
        {/* Wrap in form so Enter in any qty input triggers submit. */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            addMutation.mutate();
          }}
        >
          <DialogBody>
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border)] bg-[var(--color-bg-subtle)]">
                  <th className="px-3 py-2 font-semibold text-[var(--color-text-secondary)]">{copy.part}</th>
                  <th className="w-28 px-3 py-2 text-right font-semibold text-[var(--color-text-secondary)]">{copy.quantity}</th>
                </tr>
              </thead>
              <tbody>
                {selectedParts.map((part) => {
                  const onOrderQty = existingParts.get(part.id);
                  return (
                    <tr key={part.id} className="border-b border-[var(--color-border)]">
                      <td className="px-3 py-2 text-[var(--color-text-secondary)]">
                        <span className="font-medium">{part.catalogNumber}</span>
                        {part.description ? (
                          <span className="ml-2 text-[var(--color-text-muted)]">{part.description}</span>
                        ) : null}
                        {onOrderQty !== undefined ? (
                          <span className="ml-2 inline-flex items-center rounded bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-800">
                            {copy.alreadyAdded} · {fmtQty(onOrderQty)}
                          </span>
                        ) : null}
                      </td>
                      <td className="px-3 py-2">
                        <input
                          className="w-full rounded border border-[var(--color-border-strong)] bg-[var(--color-bg-elevated)] px-2 py-1 text-right text-sm text-[var(--color-text-primary)] focus:border-[var(--color-action-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-action-primary)]"
                          type="number"
                          min="0.001"
                          step="any"
                          value={quantities.get(part.id) ?? "1"}
                          onChange={(e) =>
                            setQuantities((prev) => new Map(prev).set(part.id, e.target.value))
                          }
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </DialogBody>
          <DialogFooter className="items-center justify-between gap-3">
            <DialogSecondaryButton onClick={handleClose}>
              {copy.cancel}
            </DialogSecondaryButton>
            <div className="flex gap-3">
              <DialogSecondaryButton onClick={handleBack} disabled={addMutation.isPending}>
                {copy.back}
              </DialogSecondaryButton>
              <DialogPrimaryButton disabled={addMutation.isPending || selectedParts.length === 0}>
                {addMutation.isPending
                  ? copy.submitting
                  : selectedParts.length === 1
                    ? copy.addItem
                    : copy.addItems.replace("{count}", String(selectedParts.length))}
              </DialogPrimaryButton>
            </div>
          </DialogFooter>
        </form>
      </DialogShell>
    </>
  );
}
