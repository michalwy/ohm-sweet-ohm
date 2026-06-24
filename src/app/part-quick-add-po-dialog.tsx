"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";

import {
  addOrderItemForWorkspace,
  createPurchaseOrderForWorkspace,
  getDraftPurchaseOrdersForWorkspace,
  getPurchaseOrderDetailForWorkspace,
  updateOrderItemForWorkspace
} from "@/server/purchase-orders/purchaseOrderActions";
import type { PartsListItem } from "@/server/parts/getParts";
import {
  DialogBody,
  DialogFooter,
  DialogShell,
  ErrorBubble,
  closeDialog,
  openDialog
} from "@/app/dialog-shell";
import { SupplierPickerCombobox } from "@/app/supplier-picker-combobox";

type Copy = {
  close: string;
  quickAddPOTitle: string;
  choosePO: string;
  noPoAvailable: string;
  createNewPO: string;
  chooseSupplier: string;
  noSuppliers: string;
  loadingLabel: string;
  quantity: string;
  orderNumber: string;
  orderNumberPlaceholder: string;
  addToPurchaseOrder: string;
  addedToPoToast: string;
  quickAddError: string;
  missingQuantity: string;
  missingSupplier: string;
};

type Mode = "existing" | "create-new";

export function QuickAddToPODialog({
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
  const [mode, setMode] = useState<Mode>("existing");
  const [selectedPOId, setSelectedPOId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [newOrderNumber, setNewOrderNumber] = useState("");
  const [newSupplierId, setNewSupplierId] = useState("");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ quantity?: string; supplier?: string }>({});

  const draftPOsQuery = useQuery({
    queryKey: ["draft-pos", workspaceSlug],
    enabled: open,
    queryFn: async () => {
      const result = await getDraftPurchaseOrdersForWorkspace({ workspaceSlug });
      if (!result.ok) throw new Error(result.error);
      return result.data;
    }
  });

  const draftPOs = draftPOsQuery.data ?? [];

  useEffect(() => {
    if (!open) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setQuantity("1");
    setNewOrderNumber("");
    setNewSupplierId("");
    setSubmitError(null);
    setFieldErrors({});
  }, [open, part?.id]);

  useEffect(() => {
    if (draftPOs.length === 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setMode("create-new");
    } else {
      setMode("existing");
      if (!selectedPOId || !draftPOs.find((po) => po.id === selectedPOId)) {
        setSelectedPOId(draftPOs[0]?.id ?? "");
      }
    }
  }, [draftPOs, draftPOs.length]);

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
      const errors: { quantity?: string; supplier?: string } = {};
      if (!qty) errors.quantity = copy.missingQuantity;
      if (mode === "create-new" && !newSupplierId) errors.supplier = copy.missingSupplier;
      if (Object.keys(errors).length > 0) {
        setFieldErrors(errors);
        return null;
      }
      setFieldErrors({});

      let orderId = selectedPOId;

      if (mode === "create-new") {
        const createResult = await createPurchaseOrderForWorkspace({
          workspaceSlug,
          supplierId: newSupplierId,
          orderNumber: newOrderNumber.trim() || null
        });
        if (!createResult.ok) return createResult;
        orderId = createResult.data.orderId;
      } else {
        const detailResult = await getPurchaseOrderDetailForWorkspace({
          workspaceSlug,
          orderId
        });
        if (!detailResult.ok) return detailResult;

        const poDetail = detailResult.data;
        if (poDetail) {
          const existingItems = poDetail.items.filter((item) => item.partId === part.id);
          if (existingItems.length > 0) {
            const last = existingItems[existingItems.length - 1];
            const existingQty = parseFloat(last.quantity) || 0;
            const addedQty = parseFloat(qty) || 0;
            const newQty = String(existingQty + addedQty);
            return updateOrderItemForWorkspace({
              workspaceSlug,
              orderId,
              itemId: last.id,
              quantity: newQty
            });
          }
        }
      }

      return addOrderItemForWorkspace({
        workspaceSlug,
        orderId,
        partId: part.id,
        quantity: qty
      });
    },
    onSuccess: (result) => {
      if (result === null) return;
      if (!result.ok) {
        setSubmitError(copy.quickAddError);
        return;
      }
      onSuccess(copy.addedToPoToast);
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
          ? `${copy.quickAddPOTitle}: ${part.manufacturerName} ${part.catalogNumber}`
          : copy.quickAddPOTitle
      }
      titleId="quick-add-po-dialog-title"
      widthClassName="w-[min(36rem,calc(100vw-3rem))]"
      onClose={resetAndClose}
    >
      <form
        className="flex min-h-0 flex-1 flex-col overflow-hidden"
        onSubmit={(e) => { e.preventDefault(); mutation.mutate(); }}
      >
        <DialogBody className="grid gap-4">
          {draftPOsQuery.isLoading ? (
            <p className="text-sm text-slate-500">{copy.loadingLabel}</p>
          ) : (
            <>
              {draftPOs.length > 0 && mode === "existing" ? (
                <label className="grid gap-1 text-sm">
                  <span className="font-medium text-slate-700">{copy.choosePO}</span>
                  <select
                    className="min-h-10 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-950 outline-none"
                    value={selectedPOId}
                    onChange={(e) => setSelectedPOId(e.currentTarget.value)}
                  >
                    {draftPOs.map((po) => (
                      <option key={po.id} value={po.id}>
                        {po.orderNumber ? `#${po.orderNumber} · ` : ""}{po.supplierName}
                        {po.itemCount > 0 ? ` (${po.itemCount})` : ""}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}

              {mode === "create-new" ? (
                <section className="grid gap-3 rounded-md border border-slate-200 bg-slate-50 p-3">
                  <p className="text-sm font-medium text-slate-700">{copy.createNewPO}</p>
                  <label className="grid gap-1 text-sm">
                    <span className="font-medium text-slate-700">{copy.chooseSupplier}</span>
                    <SupplierPickerCombobox
                      workspaceSlug={workspaceSlug}
                      inputId="quick-add-po-supplier"
                      placeholder={copy.chooseSupplier}
                      noItemsLabel={copy.noSuppliers}
                      loadingLabel={copy.loadingLabel}
                      onSupplierSelect={(s) => setNewSupplierId(s.id)}
                    />
                    {fieldErrors.supplier ? (
                      <p className="text-xs text-[var(--color-error)]">{fieldErrors.supplier}</p>
                    ) : null}
                  </label>
                  <label className="grid gap-1 text-sm">
                    <span className="font-medium text-slate-700">{copy.orderNumber}</span>
                    <input
                      className="min-h-10 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-950 outline-none"
                      placeholder={copy.orderNumberPlaceholder}
                      value={newOrderNumber}
                      onChange={(e) => setNewOrderNumber(e.currentTarget.value)}
                    />
                  </label>
                </section>
              ) : null}

              {draftPOs.length > 0 ? (
                <div>
                  <button
                    className="text-sm text-[var(--color-accent)] hover:underline"
                    type="button"
                    onClick={() => setMode(mode === "existing" ? "create-new" : "existing")}
                  >
                    {mode === "existing" ? copy.createNewPO : copy.choosePO}
                  </button>
                </div>
              ) : null}

              <label className="grid gap-1 text-sm">
                <span className="font-medium text-slate-700">{copy.quantity}</span>
                <input
                  className="min-h-10 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-950 outline-none"
                  value={quantity}
                  onChange={(e) => setQuantity(e.currentTarget.value)}
                />
                {fieldErrors.quantity ? (
                  <p className="text-xs text-[var(--color-error)]">{fieldErrors.quantity}</p>
                ) : null}
              </label>

              {submitError ? <ErrorBubble>{submitError}</ErrorBubble> : null}
            </>
          )}
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
            disabled={isPending || !part || draftPOsQuery.isLoading}
            type="submit"
          >
            {copy.addToPurchaseOrder}
          </button>
        </DialogFooter>
      </form>
    </DialogShell>
  );
}
