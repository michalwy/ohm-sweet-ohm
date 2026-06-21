"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";

import {
  addShoppingListItemForWorkspace,
  createShoppingListForWorkspace,
  getAllShoppingListsForWorkspace,
  getShoppingListDetailForWorkspace,
  updateShoppingListItemForWorkspace,
} from "@/server/shopping-lists/shoppingListActions";
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

type Mode = "existing" | "create-new";

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
  const [mode, setMode] = useState<Mode>("existing");
  const [selectedSLId, setSelectedSLId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [newSLName, setNewSLName] = useState("");
  const [itemNotes, setItemNotes] = useState("");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ quantity?: string; slName?: string }>({});

  const allSLsQuery = useQuery({
    queryKey: ["all-sls", workspaceSlug],
    enabled: open,
    queryFn: async () => {
      const result = await getAllShoppingListsForWorkspace({ workspaceSlug });
      if (!result.ok) throw new Error(result.error);
      return result.data;
    }
  });

  const allSLs = allSLsQuery.data ?? [];

  useEffect(() => {
    if (!open) return;
    setQuantity("1");
    setNewSLName("");
    setItemNotes("");
    setSubmitError(null);
    setFieldErrors({});
  }, [open, part?.id]);

  useEffect(() => {
    if (allSLs.length === 0) {
      setMode("create-new");
    } else {
      setMode("existing");
      if (!selectedSLId || !allSLs.find((sl) => sl.id === selectedSLId)) {
        setSelectedSLId(allSLs[0]?.id ?? "");
      }
    }
  }, [allSLs, allSLs.length]);

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

      let listId = selectedSLId;

      if (mode === "create-new") {
        const createResult = await createShoppingListForWorkspace({
          workspaceSlug,
          name: newSLName.trim()
        });
        if (!createResult.ok) return createResult;
        listId = createResult.data.listId;
      } else {
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
          {allSLsQuery.isLoading ? (
            <p className="text-sm text-slate-500">{copy.loadingLabel}</p>
          ) : (
            <>
              {allSLs.length > 0 && mode === "existing" ? (
                <label className="grid gap-1 text-sm">
                  <span className="font-medium text-slate-700">{copy.chooseSL}</span>
                  <select
                    className="min-h-10 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-950 outline-none"
                    value={selectedSLId}
                    onChange={(e) => setSelectedSLId(e.currentTarget.value)}
                  >
                    {allSLs.map((sl) => (
                      <option key={sl.id} value={sl.id}>
                        {sl.name}
                        {sl.itemCount > 0 ? ` (${sl.itemCount})` : ""}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}

              {mode === "create-new" ? (
                <section className="grid gap-3 rounded-md border border-slate-200 bg-slate-50 p-3">
                  <p className="text-sm font-medium text-slate-700">{copy.createNewSL}</p>
                  <label className="grid gap-1 text-sm">
                    <span className="font-medium text-slate-700">{copy.slName}</span>
                    <input
                      className="min-h-10 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-950 outline-none"
                      placeholder={copy.slNamePlaceholder}
                      value={newSLName}
                      onChange={(e) => setNewSLName(e.currentTarget.value)}
                    />
                    {fieldErrors.slName ? (
                      <p className="text-xs text-[var(--color-error)]">{fieldErrors.slName}</p>
                    ) : null}
                  </label>
                </section>
              ) : null}

              {allSLs.length > 0 ? (
                <div>
                  <button
                    className="text-sm text-[var(--color-accent)] hover:underline"
                    type="button"
                    onClick={() => setMode(mode === "existing" ? "create-new" : "existing")}
                  >
                    {mode === "existing" ? copy.createNewSL : copy.chooseSL}
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

              {mode !== "create-new" ? (
                <label className="grid gap-1 text-sm">
                  <span className="font-medium text-slate-700">{copy.notes}</span>
                  <input
                    className="min-h-10 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-950 outline-none"
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
            disabled={isPending || !part || allSLsQuery.isLoading}
            type="submit"
          >
            {copy.addToShoppingList}
          </button>
        </DialogFooter>
      </form>
    </DialogShell>
  );
}
