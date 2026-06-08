"use client";

import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";

import {
  createPurchaseOrderForWorkspace,
  getNextOrderNumberForWorkspace,
} from "@/server/purchase-orders/purchaseOrderActions";
import {
  closeDialog,
  DialogBody,
  DialogFooter,
  DialogShell,
  ErrorBubble,
  LabelWithError,
} from "@/app/dialog-shell";
import { SupplierPickerCombobox } from "@/app/supplier-picker-combobox";

export type CreatePurchaseOrderDialogCopy = {
  title: string;
  supplier: string;
  chooseSupplier: string;
  noSuppliers: string;
  orderNumber: string;
  orderNumberPlaceholder: string;
  notes: string;
  notesPlaceholder: string;
  createOrder: string;
  cancel: string;
  close: string;
  supplierRequired: string;
  permissionDenied: string;
  databaseUnavailable: string;
  invalidInput: string;
  loadingSuppliers: string;
};

type CreatePurchaseOrderDialogProps = {
  dialogRef: React.RefObject<HTMLDialogElement | null>;
  isOpen: boolean;
  workspaceSlug: string;
  copy: CreatePurchaseOrderDialogCopy;
  onClose: () => void;
  onSuccess: (newOrderId: string) => void;
};

function getErrorMsg(copy: CreatePurchaseOrderDialogCopy, error: string) {
  if (error === "workspace-permission-denied") return copy.permissionDenied;
  if (error === "database-unavailable") return copy.databaseUnavailable;
  return copy.invalidInput;
}

function getString(formData: FormData, name: string) {
  const v = formData.get(name);
  return typeof v === "string" ? v.trim() : "";
}

export function CreatePurchaseOrderDialog({
  dialogRef,
  isOpen,
  workspaceSlug,
  copy,
  onClose,
  onSuccess,
}: CreatePurchaseOrderDialogProps) {
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [formKey, setFormKey] = useState(0);

  const orderNumberQuery = useQuery({
    queryKey: ["next-order-number", workspaceSlug, formKey],
    queryFn: async () => {
      const result = await getNextOrderNumberForWorkspace({ workspaceSlug });
      return result.ok ? result.data.orderNumber : "";
    },
    enabled: isOpen,
    staleTime: 0,
  });

  const createMutation = useMutation({
    mutationFn: createPurchaseOrderForWorkspace,
    onSuccess: (result) => {
      if (!result.ok) {
        setFormErrors({ submit: getErrorMsg(copy, result.error) });
        return;
      }
      setFormErrors({});
      setFormKey((k) => k + 1);
      onSuccess(result.data.orderId);
    },
  });

  function handleClose() {
    closeDialog(dialogRef.current);
    setFormErrors({});
    onClose();
  }

  function handleSubmit(formData: FormData) {
    const supplierId = getString(formData, "supplierId");
    if (!supplierId) {
      setFormErrors({ supplier: copy.supplierRequired });
      return;
    }
    createMutation.mutate({
      workspaceSlug,
      supplierId,
      orderNumber: getString(formData, "orderNumber") || null,
      notes: getString(formData, "notes") || null,
    });
  }

  return (
    <DialogShell
      ref={dialogRef}
      closeLabel={copy.close}
      title={copy.title}
      titleId="create-purchase-order-dialog-title"
      widthClassName="w-[min(32rem,calc(100vw-3rem))]"
      onClose={handleClose}
    >
      {isOpen ? (
        <form
          key={formKey}
          action={handleSubmit}
          className="flex min-h-0 flex-1 flex-col overflow-hidden"
        >
          <DialogBody className="grid gap-4">
            <div className="grid gap-2">
              <LabelWithError
                error={formErrors.supplier}
                htmlFor="create-po-supplier"
              >
                {copy.supplier}
              </LabelWithError>
              <SupplierPickerCombobox
                workspaceSlug={workspaceSlug}
                inputId="create-po-supplier"
                placeholder={copy.chooseSupplier}
                noItemsLabel={copy.noSuppliers}
                loadingLabel={copy.loadingSuppliers}
              />
            </div>
            <div className="grid gap-2">
              <label
                className="text-sm font-medium text-slate-700"
                htmlFor="create-po-order-number"
              >
                {copy.orderNumber}
              </label>
              <input
                id="create-po-order-number"
                name="orderNumber"
                placeholder={orderNumberQuery.isFetching ? "…" : copy.orderNumberPlaceholder}
                defaultValue={orderNumberQuery.data ?? ""}
                key={`order-num-${formKey}-${orderNumberQuery.data ?? "loading"}`}
                className="min-h-10 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-950 outline-none transition hover:border-slate-400 focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
              />
            </div>
            <div className="grid gap-2">
              <label
                className="text-sm font-medium text-slate-700"
                htmlFor="create-po-notes"
              >
                {copy.notes}
              </label>
              <textarea
                id="create-po-notes"
                name="notes"
                rows={3}
                placeholder={copy.notesPlaceholder}
                className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-950 outline-none transition hover:border-slate-400 focus:border-slate-500 focus:ring-2 focus:ring-slate-200 resize-none"
              />
            </div>
          </DialogBody>
          <DialogFooter className="justify-end gap-2">
            <button
              className="min-h-10 rounded-md border border-slate-300 px-3 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
              type="button"
              onClick={handleClose}
            >
              {copy.cancel}
            </button>
            <button
              className="min-h-10 rounded-md bg-[var(--color-accent)] px-4 text-sm font-semibold text-white transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
              type="submit"
              disabled={createMutation.isPending}
            >
              {copy.createOrder}
            </button>
          </DialogFooter>
          {formErrors.submit ? (
            <ErrorBubble>{formErrors.submit}</ErrorBubble>
          ) : null}
        </form>
      ) : null}
    </DialogShell>
  );
}
