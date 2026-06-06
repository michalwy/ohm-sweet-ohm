"use client";

import { useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";

import {
  addShoppingListItemForWorkspace,
  convertShoppingListToOrderForWorkspace,
  createShoppingListForWorkspace,
  deleteShoppingListForWorkspace,
  getShoppingListDetailForWorkspace,
  removeShoppingListItemForWorkspace,
  updateShoppingListForWorkspace,
  updateShoppingListItemForWorkspace
} from "@/server/shopping-lists/shoppingListActions";
import type {
  ShoppingListDetail,
  ShoppingListItem,
  ShoppingListSummary
} from "@/server/shopping-lists/shoppingListMutations";
import { getPartsListPageForWorkspace } from "@/server/parts/listActions";
import {
  closeDialog,
  DeleteConfirmationDialog,
  DialogBody,
  DialogFooter,
  DialogShell,
  ErrorBubble,
  getFieldInputClassName,
  LabelWithError,
  openDialog
} from "@/app/dialog-shell";
import { getNextToastId, ToastNotice, type ToastMessage } from "@/app/toast-notice";

type Organization = { id: string; name: string };

type Copy = {
  title: string;
  intro: string;
  newList: string;
  newListTitle: string;
  editListTitle: string;
  name: string;
  notes: string;
  namePlaceholder: string;
  notesPlaceholder: string;
  createList: string;
  saveChanges: string;
  edit: string;
  delete: string;
  close: string;
  cancel: string;
  cancelDelete: string;
  confirmDelete: string;
  deleteConfirmationBody: string;
  deleteList: string;
  noLists: string;
  items: string;
  itemsPlural: string;
  openList: string;
  listItems: string;
  addItem: string;
  editItem: string;
  removeItem: string;
  removeItemConfirmBody: string;
  part: string;
  quantity: string;
  noItems: string;
  searchParts: string;
  searchPartsPlaceholder: string;
  noMatchingParts: string;
  orderedBadge: string;
  convertToOrder: string;
  convertToOrderTitle: string;
  convertToOrderBody: string;
  supplier: string;
  chooseSupplier: string;
  noSuppliers: string;
  selectedItems: string;
  noItemsSelected: string;
  convert: string;
  createdToast: string;
  updatedToast: string;
  deletedToast: string;
  itemAddedToast: string;
  itemUpdatedToast: string;
  itemRemovedToast: string;
  convertedToast: string;
  nameRequired: string;
  quantityRequired: string;
  partRequired: string;
  supplierRequired: string;
  invalidInput: string;
  permissionDenied: string;
  databaseUnavailable: string;
  actions: string;
};

type ShoppingListsClientProps = {
  canWrite: boolean;
  copy: Copy;
  initialLists: ShoppingListSummary[];
  organizations: Organization[];
  workspaceSlug: string;
};

export function ShoppingListsClient({
  canWrite,
  copy,
  initialLists,
  organizations,
  workspaceSlug
}: ShoppingListsClientProps) {
  const [lists, setLists] = useState(initialLists);
  const [selectedListId, setSelectedListId] = useState<string | null>(null);
  const [listDialogMode, setListDialogMode] = useState<"create" | "edit" | null>(null);
  const [editingList, setEditingList] = useState<ShoppingListSummary | null>(null);
  const [listPendingDelete, setListPendingDelete] = useState<ShoppingListSummary | null>(null);
  const [itemDialogMode, setItemDialogMode] = useState<"create" | "edit" | null>(null);
  const [editingItem, setEditingItem] = useState<ShoppingListItem | null>(null);
  const [itemPendingRemove, setItemPendingRemove] = useState<ShoppingListItem | null>(null);
  const [convertDialogOpen, setConvertDialogOpen] = useState(false);
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set());
  const [partSearchQuery, setPartSearchQuery] = useState("");
  const [selectedPartId, setSelectedPartId] = useState<string | null>(null);
  const [listFormErrors, setListFormErrors] = useState<Record<string, string>>({});
  const [itemFormErrors, setItemFormErrors] = useState<Record<string, string>>({});
  const [convertFormErrors, setConvertFormErrors] = useState<Record<string, string>>({});
  const [dialogFormKey, setDialogFormKey] = useState(0);
  const [toastMessages, setToastMessages] = useState<ToastMessage[]>([]);
  const nextToastIdRef = useRef(0);
  const listDialogRef = useRef<HTMLDialogElement>(null);
  const itemDialogRef = useRef<HTMLDialogElement>(null);
  const convertDialogRef = useRef<HTMLDialogElement>(null);

  const { data: listDetail, refetch: refetchDetail } = useQuery({
    queryKey: ["shopping-list-detail", workspaceSlug, selectedListId],
    queryFn: async () => {
      if (!selectedListId) return null;
      const result = await getShoppingListDetailForWorkspace({
        workspaceSlug,
        listId: selectedListId
      });
      return result.ok ? result.data : null;
    },
    enabled: Boolean(selectedListId)
  });

  const { data: partsSearchResult } = useQuery({
    queryKey: ["parts-search", workspaceSlug, partSearchQuery],
    queryFn: async () => {
      const result = await getPartsListPageForWorkspace({
        workspaceSlug,
        searchQuery: partSearchQuery || undefined,
        pageSize: 8
      });
      return result.ok ? result.page.items : [];
    },
    enabled: itemDialogMode !== null,
    placeholderData: (prev) => prev
  });

  const createListMutation = useMutation({
    mutationFn: createShoppingListForWorkspace,
    onSuccess: (result) => {
      if (!result.ok) { setListFormErrors({ submit: getErrorMsg(copy, result.error) }); return; }
      closeListDialog();
      addToast(copy.createdToast);
      void reloadLists();
    }
  });

  const updateListMutation = useMutation({
    mutationFn: updateShoppingListForWorkspace,
    onSuccess: (result) => {
      if (!result.ok) { setListFormErrors({ submit: getErrorMsg(copy, result.error) }); return; }
      closeListDialog();
      addToast(copy.updatedToast);
      void reloadLists();
    }
  });

  const deleteListMutation = useMutation({
    mutationFn: deleteShoppingListForWorkspace,
    onSuccess: (result) => {
      if (!result.ok) { addToast(getErrorMsg(copy, result.error)); return; }
      if (selectedListId === listPendingDelete?.id) setSelectedListId(null);
      setListPendingDelete(null);
      addToast(copy.deletedToast);
      void reloadLists();
    }
  });

  const addItemMutation = useMutation({
    mutationFn: addShoppingListItemForWorkspace,
    onSuccess: (result) => {
      if (!result.ok) { setItemFormErrors({ submit: getErrorMsg(copy, result.error) }); return; }
      closeItemDialog();
      addToast(copy.itemAddedToast);
      void refetchDetail();
      void reloadLists();
    }
  });

  const updateItemMutation = useMutation({
    mutationFn: updateShoppingListItemForWorkspace,
    onSuccess: (result) => {
      if (!result.ok) { setItemFormErrors({ submit: getErrorMsg(copy, result.error) }); return; }
      closeItemDialog();
      addToast(copy.itemUpdatedToast);
      void refetchDetail();
    }
  });

  const removeItemMutation = useMutation({
    mutationFn: removeShoppingListItemForWorkspace,
    onSuccess: (result) => {
      if (!result.ok) { addToast(getErrorMsg(copy, result.error)); return; }
      setItemPendingRemove(null);
      addToast(copy.itemRemovedToast);
      void refetchDetail();
      void reloadLists();
    }
  });

  const convertMutation = useMutation({
    mutationFn: convertShoppingListToOrderForWorkspace,
    onSuccess: (result) => {
      if (!result.ok) { setConvertFormErrors({ submit: getErrorMsg(copy, result.error) }); return; }
      closeConvertDialog();
      addToast(copy.convertedToast);
      void refetchDetail();
    }
  });

  async function reloadLists() {
    const { getShoppingListsForWorkspace } = await import(
      "@/server/shopping-lists/shoppingListActions"
    );
    const result = await getShoppingListsForWorkspace({ workspaceSlug });
    if (result.ok) setLists(result.data);
  }

  function openCreateListDialog() {
    setEditingList(null);
    setListDialogMode("create");
    setListFormErrors({});
    setDialogFormKey((k) => k + 1);
    window.requestAnimationFrame(() => openDialog(listDialogRef.current));
  }

  function openEditListDialog(list: ShoppingListSummary) {
    setEditingList(list);
    setListDialogMode("edit");
    setListFormErrors({});
    setDialogFormKey((k) => k + 1);
    window.requestAnimationFrame(() => openDialog(listDialogRef.current));
  }

  function closeListDialog() {
    closeDialog(listDialogRef.current);
    setListDialogMode(null);
    setEditingList(null);
    setListFormErrors({});
  }

  function openCreateItemDialog() {
    setEditingItem(null);
    setItemDialogMode("create");
    setItemFormErrors({});
    setSelectedPartId(null);
    setPartSearchQuery("");
    setDialogFormKey((k) => k + 1);
    window.requestAnimationFrame(() => openDialog(itemDialogRef.current));
  }

  function openEditItemDialog(item: ShoppingListItem) {
    setEditingItem(item);
    setItemDialogMode("edit");
    setItemFormErrors({});
    setSelectedPartId(item.partId);
    setPartSearchQuery("");
    setDialogFormKey((k) => k + 1);
    window.requestAnimationFrame(() => openDialog(itemDialogRef.current));
  }

  function closeItemDialog() {
    closeDialog(itemDialogRef.current);
    setItemDialogMode(null);
    setEditingItem(null);
    setItemFormErrors({});
    setSelectedPartId(null);
    setPartSearchQuery("");
  }

  function openConvertDialog() {
    setConvertFormErrors({});
    setConvertDialogOpen(true);
    setDialogFormKey((k) => k + 1);
    window.requestAnimationFrame(() => openDialog(convertDialogRef.current));
  }

  function closeConvertDialog() {
    closeDialog(convertDialogRef.current);
    setConvertDialogOpen(false);
    setConvertFormErrors({});
  }

  function handleListSubmit(formData: FormData) {
    const name = getString(formData, "name");
    if (!name) { setListFormErrors({ name: copy.nameRequired }); return; }

    if (listDialogMode === "create") {
      createListMutation.mutate({ workspaceSlug, name, notes: getString(formData, "notes") || null });
    } else if (editingList) {
      updateListMutation.mutate({ workspaceSlug, listId: editingList.id, name, notes: getString(formData, "notes") || null });
    }
  }

  function handleItemSubmit(formData: FormData) {
    const quantity = getString(formData, "quantity");
    const partId = selectedPartId ?? (editingItem?.partId ?? null);

    if (!partId && itemDialogMode === "create") {
      setItemFormErrors({ part: copy.partRequired });
      return;
    }
    if (!quantity) {
      setItemFormErrors({ quantity: copy.quantityRequired });
      return;
    }

    if (itemDialogMode === "create" && selectedListId && partId) {
      addItemMutation.mutate({
        workspaceSlug,
        listId: selectedListId,
        partId,
        quantity,
        notes: getString(formData, "notes") || null
      });
    } else if (editingItem && selectedListId) {
      updateItemMutation.mutate({
        workspaceSlug,
        listId: selectedListId,
        itemId: editingItem.id,
        quantity,
        notes: getString(formData, "notes") || null
      });
    }
  }

  function handleConvertSubmit(formData: FormData) {
    const supplierId = getString(formData, "supplierId");
    if (!supplierId) { setConvertFormErrors({ supplier: copy.supplierRequired }); return; }
    if (selectedItemIds.size === 0) { setConvertFormErrors({ items: copy.noItemsSelected }); return; }
    if (!selectedListId) return;

    convertMutation.mutate({
      workspaceSlug,
      listId: selectedListId,
      selectedItemIds: [...selectedItemIds],
      supplierId
    });
  }

  function toggleItemSelection(itemId: string) {
    setSelectedItemIds((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  }

  function addToast(message: string) {
    setToastMessages((msgs) => [...msgs, { id: getNextToastId(nextToastIdRef), message }]);
  }

  const items = (listDetail as ShoppingListDetail | null | undefined)?.items ?? [];
  const isMutating =
    createListMutation.isPending ||
    updateListMutation.isPending ||
    addItemMutation.isPending ||
    updateItemMutation.isPending ||
    convertMutation.isPending;

  return (
    <section className="flex min-h-0 flex-1 flex-col gap-4">
      {/* Lists table */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-700">{copy.title}</h2>
        <button
          className="inline-flex min-h-9 items-center rounded-md bg-[var(--color-accent)] px-4 text-sm font-semibold text-white transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={!canWrite}
          type="button"
          onClick={openCreateListDialog}
        >
          {copy.newList}
        </button>
      </div>

      <div className="rounded-md border border-slate-200 bg-white">
        {lists.length === 0 ? (
          <p className="px-4 py-6 text-sm text-slate-600">{copy.noLists}</p>
        ) : (
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="px-4 py-3 font-semibold text-slate-700">{copy.name}</th>
                <th className="px-4 py-3 font-semibold text-slate-700">{copy.notes}</th>
                <th className="w-24 px-4 py-3 font-semibold text-slate-700">{copy.items}</th>
                <th className="px-4 py-3 font-semibold text-slate-700">{copy.actions}</th>
              </tr>
            </thead>
            <tbody>
              {lists.map((list) => (
                <tr
                  key={list.id}
                  className={`border-b border-slate-100 last:border-b-0 ${selectedListId === list.id ? "bg-[var(--color-accent-soft)]" : ""}`}
                >
                  <td className="px-4 py-3 font-medium text-slate-900">{list.name}</td>
                  <td className="px-4 py-3 text-slate-600">{list.notes ?? "—"}</td>
                  <td className="px-4 py-3 text-slate-600">
                    {list.itemCount} {list.itemCount === 1 ? copy.items : copy.itemsPlural}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button
                        className="min-h-9 rounded-md border border-slate-300 px-3 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                        type="button"
                        onClick={() => setSelectedListId(list.id === selectedListId ? null : list.id)}
                      >
                        {copy.openList}
                      </button>
                      <button
                        className="min-h-9 rounded-md border border-slate-300 px-3 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                        type="button"
                        disabled={!canWrite}
                        onClick={() => openEditListDialog(list)}
                      >
                        {copy.edit}
                      </button>
                      <button
                        className="min-h-9 rounded-md border border-[var(--color-error-border)] px-3 text-sm font-medium text-[var(--color-error)] transition hover:bg-[var(--color-error-soft)] disabled:cursor-not-allowed disabled:opacity-60"
                        type="button"
                        disabled={!canWrite || deleteListMutation.isPending}
                        onClick={() => setListPendingDelete(list)}
                      >
                        {copy.delete}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Items panel */}
      {selectedListId ? (
        <div className="flex min-h-0 flex-1 flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-700">
              {lists.find((l) => l.id === selectedListId)?.name ?? copy.listItems}
            </h2>
            <div className="flex items-center gap-2">
              {selectedItemIds.size > 0 ? (
                <button
                  className="min-h-9 rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                  type="button"
                  disabled={!canWrite || organizations.length === 0}
                  onClick={openConvertDialog}
                >
                  {copy.convertToOrder} ({selectedItemIds.size})
                </button>
              ) : null}
              <button
                className="inline-flex min-h-9 items-center rounded-md bg-[var(--color-accent)] px-3 text-sm font-semibold text-white transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
                type="button"
                disabled={!canWrite}
                onClick={openCreateItemDialog}
              >
                {copy.addItem}
              </button>
            </div>
          </div>
          <div className="rounded-md border border-slate-200 bg-white">
            {items.length === 0 ? (
              <p className="px-4 py-6 text-sm text-slate-600">{copy.noItems}</p>
            ) : (
              <table className="w-full border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    <th className="w-10 px-4 py-3" />
                    <th className="px-4 py-3 font-semibold text-slate-700">{copy.part}</th>
                    <th className="px-4 py-3 font-semibold text-slate-700">{copy.quantity}</th>
                    <th className="px-4 py-3 font-semibold text-slate-700">{copy.notes}</th>
                    <th className="px-4 py-3 font-semibold text-slate-700">{copy.actions}</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.id} className="border-b border-slate-100 last:border-b-0">
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          aria-label={`Select ${item.partCatalogNumber}`}
                          checked={selectedItemIds.has(item.id)}
                          onChange={() => toggleItemSelection(item.id)}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-slate-900">{item.partCatalogNumber}</span>
                          <span className="text-slate-500">{item.manufacturerName}</span>
                          {item.orderedInPurchaseOrderId ? (
                            <span className="rounded-full bg-[var(--color-success-soft)] px-2 py-0.5 text-xs font-medium text-[var(--color-success)]">
                              {copy.orderedBadge}
                            </span>
                          ) : null}
                        </div>
                        {item.partDescription ? (
                          <p className="text-xs text-slate-500">{item.partDescription}</p>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-slate-700">{item.quantity}</td>
                      <td className="px-4 py-3 text-slate-600">{item.notes ?? "—"}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <button
                            className="min-h-9 rounded-md border border-slate-300 px-3 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                            type="button"
                            disabled={!canWrite}
                            onClick={() => openEditItemDialog(item)}
                          >
                            {copy.edit}
                          </button>
                          <button
                            className="min-h-9 rounded-md border border-[var(--color-error-border)] px-3 text-sm font-medium text-[var(--color-error)] transition hover:bg-[var(--color-error-soft)] disabled:cursor-not-allowed disabled:opacity-60"
                            type="button"
                            disabled={!canWrite || removeItemMutation.isPending}
                            onClick={() => setItemPendingRemove(item)}
                          >
                            {copy.delete}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      ) : null}

      {/* Add/edit list dialog */}
      <DialogShell
        ref={listDialogRef}
        closeLabel={copy.close}
        title={listDialogMode === "create" ? copy.newListTitle : copy.editListTitle}
        titleId="list-dialog-title"
        widthClassName="w-[min(32rem,calc(100vw-3rem))]"
        onClose={closeListDialog}
      >
        {listDialogMode ? (
          <form key={dialogFormKey} action={handleListSubmit} className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <DialogBody className="grid gap-4">
              <div className="grid gap-2">
                <LabelWithError error={listFormErrors.name} htmlFor="list-name">
                  {copy.name}
                </LabelWithError>
                <input
                  id="list-name"
                  name="name"
                  placeholder={copy.namePlaceholder}
                  defaultValue={editingList?.name ?? ""}
                  className={getFieldInputClassName(
                    "min-h-10 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-950 outline-none transition hover:border-slate-400 focus:border-slate-500 focus:ring-2 focus:ring-slate-200",
                    Boolean(listFormErrors.name)
                  )}
                />
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-medium text-slate-700" htmlFor="list-notes">
                  {copy.notes}
                </label>
                <input
                  id="list-notes"
                  name="notes"
                  placeholder={copy.notesPlaceholder}
                  defaultValue={editingList?.notes ?? ""}
                  className="min-h-10 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-950 outline-none transition hover:border-slate-400 focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                />
              </div>
            </DialogBody>
            <DialogFooter className="justify-end gap-2">
              <button className="min-h-10 rounded-md border border-slate-300 px-3 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50" type="button" onClick={closeListDialog}>
                {copy.cancel}
              </button>
              <button
                className="min-h-10 rounded-md bg-[var(--color-accent)] px-4 text-sm font-semibold text-white transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
                type="submit"
                disabled={isMutating}
              >
                {listDialogMode === "create" ? copy.createList : copy.saveChanges}
              </button>
            </DialogFooter>
            {listFormErrors.submit ? <ErrorBubble>{listFormErrors.submit}</ErrorBubble> : null}
          </form>
        ) : null}
      </DialogShell>

      {/* Add/edit item dialog */}
      <DialogShell
        ref={itemDialogRef}
        closeLabel={copy.close}
        title={itemDialogMode === "create" ? copy.addItem : copy.editItem}
        titleId="item-dialog-title"
        widthClassName="w-[min(36rem,calc(100vw-3rem))]"
        onClose={closeItemDialog}
      >
        {itemDialogMode ? (
          <form key={dialogFormKey} action={handleItemSubmit} className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <DialogBody className="grid gap-4">
              {/* Part picker (create mode only) */}
              {itemDialogMode === "create" ? (
                <div className="grid gap-2">
                  <LabelWithError error={itemFormErrors.part}>
                    {copy.part}
                  </LabelWithError>
                  <input
                    type="text"
                    placeholder={copy.searchPartsPlaceholder}
                    value={partSearchQuery}
                    onChange={(e) => {
                      setPartSearchQuery(e.target.value);
                      setSelectedPartId(null);
                    }}
                    className="min-h-10 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-950 outline-none transition hover:border-slate-400 focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                  />
                  {partsSearchResult && partsSearchResult.length > 0 ? (
                    <div className="max-h-48 overflow-auto rounded-md border border-slate-200 bg-white">
                      {partsSearchResult.map((part) => (
                        <button
                          key={part.id}
                          type="button"
                          className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition hover:bg-slate-50 ${selectedPartId === part.id ? "bg-[var(--color-accent-soft)] font-medium" : ""}`}
                          onClick={() => {
                            setSelectedPartId(part.id);
                            setPartSearchQuery(`${part.catalogNumber} — ${part.manufacturerName}`);
                          }}
                        >
                          <span className="font-medium text-slate-900">{part.catalogNumber}</span>
                          <span className="text-slate-500">{part.manufacturerName}</span>
                        </button>
                      ))}
                    </div>
                  ) : partSearchQuery && partsSearchResult?.length === 0 ? (
                    <p className="text-xs text-slate-500">{copy.noMatchingParts}</p>
                  ) : null}
                  {selectedPartId ? (
                    <p className="text-xs text-[var(--color-success)]">✓ Part selected</p>
                  ) : null}
                </div>
              ) : (
                <div className="grid gap-1">
                  <p className="text-sm font-medium text-slate-700">{copy.part}</p>
                  <p className="text-sm text-slate-900">
                    {editingItem?.partCatalogNumber} — {editingItem?.manufacturerName}
                  </p>
                </div>
              )}

              <div className="grid gap-2">
                <LabelWithError error={itemFormErrors.quantity} htmlFor="item-quantity">
                  {copy.quantity}
                </LabelWithError>
                <input
                  id="item-quantity"
                  name="quantity"
                  type="text"
                  inputMode="decimal"
                  defaultValue={editingItem?.quantity ?? ""}
                  placeholder="1"
                  className={getFieldInputClassName(
                    "min-h-10 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-950 outline-none transition hover:border-slate-400 focus:border-slate-500 focus:ring-2 focus:ring-slate-200",
                    Boolean(itemFormErrors.quantity)
                  )}
                />
              </div>

              <div className="grid gap-2">
                <label className="text-sm font-medium text-slate-700" htmlFor="item-notes">
                  {copy.notes}
                </label>
                <input
                  id="item-notes"
                  name="notes"
                  defaultValue={editingItem?.notes ?? ""}
                  className="min-h-10 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-950 outline-none transition hover:border-slate-400 focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                />
              </div>
            </DialogBody>
            <DialogFooter className="justify-end gap-2">
              <button className="min-h-10 rounded-md border border-slate-300 px-3 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50" type="button" onClick={closeItemDialog}>
                {copy.cancel}
              </button>
              <button
                className="min-h-10 rounded-md bg-[var(--color-accent)] px-4 text-sm font-semibold text-white transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
                type="submit"
                disabled={isMutating}
              >
                {itemDialogMode === "create" ? copy.addItem : copy.saveChanges}
              </button>
            </DialogFooter>
            {itemFormErrors.submit ? <ErrorBubble>{itemFormErrors.submit}</ErrorBubble> : null}
          </form>
        ) : null}
      </DialogShell>

      {/* Convert to order dialog */}
      <DialogShell
        ref={convertDialogRef}
        closeLabel={copy.close}
        title={copy.convertToOrderTitle}
        titleId="convert-dialog-title"
        description={copy.convertToOrderBody}
        widthClassName="w-[min(32rem,calc(100vw-3rem))]"
        onClose={closeConvertDialog}
      >
        {convertDialogOpen ? (
          <form key={dialogFormKey} action={handleConvertSubmit} className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <DialogBody className="grid gap-4">
              <div className="grid gap-2">
                <LabelWithError error={convertFormErrors.supplier} htmlFor="convert-supplier">
                  {copy.supplier}
                </LabelWithError>
                {organizations.length === 0 ? (
                  <p className="text-sm text-slate-500">{copy.noSuppliers}</p>
                ) : (
                  <select
                    id="convert-supplier"
                    name="supplierId"
                    defaultValue=""
                    className="min-h-10 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-950 outline-none transition hover:border-slate-400 focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                  >
                    <option value="" disabled>{copy.chooseSupplier}</option>
                    {organizations.map((org) => (
                      <option key={org.id} value={org.id}>{org.name}</option>
                    ))}
                  </select>
                )}
              </div>
              <div className="grid gap-2">
                <p className="text-sm font-medium text-slate-700">{copy.selectedItems}</p>
                <p className="text-sm text-slate-600">
                  {selectedItemIds.size} {selectedItemIds.size === 1 ? copy.items : copy.itemsPlural} selected
                </p>
                {convertFormErrors.items ? (
                  <p className="text-xs text-[var(--color-error)]">{convertFormErrors.items}</p>
                ) : null}
              </div>
            </DialogBody>
            <DialogFooter className="justify-end gap-2">
              <button className="min-h-10 rounded-md border border-slate-300 px-3 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50" type="button" onClick={closeConvertDialog}>
                {copy.cancel}
              </button>
              <button
                className="min-h-10 rounded-md bg-[var(--color-accent)] px-4 text-sm font-semibold text-white transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
                type="submit"
                disabled={isMutating || organizations.length === 0}
              >
                {copy.convert}
              </button>
            </DialogFooter>
            {convertFormErrors.submit ? <ErrorBubble>{convertFormErrors.submit}</ErrorBubble> : null}
          </form>
        ) : null}
      </DialogShell>

      {/* Delete list confirmation */}
      <DeleteConfirmationDialog
        body={copy.deleteConfirmationBody}
        cancelLabel={copy.cancelDelete}
        closeLabel={copy.close}
        confirmLabel={copy.confirmDelete}
        deleteLabel={copy.deleteList}
        isPending={deleteListMutation.isPending}
        itemName={listPendingDelete?.name ?? ""}
        open={Boolean(listPendingDelete)}
        onCancel={() => setListPendingDelete(null)}
        onConfirm={() => {
          if (listPendingDelete) {
            deleteListMutation.mutate({ workspaceSlug, listId: listPendingDelete.id });
          }
        }}
      />

      {/* Remove item confirmation */}
      <DeleteConfirmationDialog
        body={copy.removeItemConfirmBody}
        cancelLabel={copy.cancelDelete}
        closeLabel={copy.close}
        confirmLabel={copy.confirmDelete}
        deleteLabel={copy.removeItem}
        isPending={removeItemMutation.isPending}
        itemName={itemPendingRemove?.partCatalogNumber ?? ""}
        open={Boolean(itemPendingRemove)}
        onCancel={() => setItemPendingRemove(null)}
        onConfirm={() => {
          if (itemPendingRemove && selectedListId) {
            removeItemMutation.mutate({
              workspaceSlug,
              listId: selectedListId,
              itemId: itemPendingRemove.id
            });
          }
        }}
      />

      <ToastNotice messages={toastMessages} onDismiss={(id) => setToastMessages((msgs) => msgs.filter((m) => m.id !== id))} />
    </section>
  );
}

function getString(formData: FormData, name: string) {
  const v = formData.get(name);
  return typeof v === "string" ? v.trim() : "";
}

function getErrorMsg(copy: Copy, error: string) {
  if (error === "workspace-permission-denied") return copy.permissionDenied;
  if (error === "database-unavailable") return copy.databaseUnavailable;
  return copy.invalidInput;
}
