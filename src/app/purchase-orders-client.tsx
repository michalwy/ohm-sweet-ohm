"use client";

import { useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";

import {
  addOrderItemForWorkspace,
  createPurchaseOrderForWorkspace,
  deletePurchaseOrderForWorkspace,
  getPurchaseOrderDetailForWorkspace,
  getPurchaseOrdersForWorkspace,
  lookupSupplierItemForWorkspace,
  markOrderedForWorkspace,
  receiveItemsForWorkspace,
  removeOrderItemForWorkspace,
  updateOrderItemForWorkspace,
  updatePurchaseOrderForWorkspace
} from "@/server/purchase-orders/purchaseOrderActions";
import type {
  PurchaseOrderDetail,
  PurchaseOrderItem,
  PurchaseOrderSummary
} from "@/server/purchase-orders/purchaseOrderMutations";
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
import type { StorageLocationListItem } from "@/server/inventory/locationMutations";

type Organization = { id: string; name: string };

type Copy = {
  title: string;
  intro: string;
  newOrder: string;
  newOrderTitle: string;
  editOrderTitle: string;
  supplier: string;
  chooseSupplier: string;
  noSuppliers: string;
  orderNumber: string;
  orderNumberPlaceholder: string;
  notes: string;
  notesPlaceholder: string;
  createOrder: string;
  saveChanges: string;
  edit: string;
  delete: string;
  close: string;
  cancel: string;
  cancelDelete: string;
  confirmDelete: string;
  deleteConfirmationBody: string;
  deleteOrder: string;
  noOrders: string;
  openOrder: string;
  status: string;
  statusDraft: string;
  statusOrdered: string;
  statusReceived: string;
  markOrdered: string;
  markOrderedConfirmTitle: string;
  markOrderedConfirmBody: string;
  confirm: string;
  receiveItems: string;
  receiveItemsTitle: string;
  receiveItemsBody: string;
  items: string;
  itemsPlural: string;
  ordered: string;
  received: string;
  remaining: string;
  part: string;
  quantity: string;
  receivedQty: string;
  location: string;
  chooseLocation: string;
  noLocations: string;
  supplierSku: string;
  unitPrice: string;
  currency: string;
  lookupSku: string;
  skuFound: string;
  skuNotFound: string;
  addItem: string;
  editItem: string;
  removeItem: string;
  removeItemConfirmBody: string;
  noItems: string;
  searchParts: string;
  searchPartsPlaceholder: string;
  noMatchingParts: string;
  createdToast: string;
  updatedToast: string;
  deletedToast: string;
  orderedToast: string;
  itemAddedToast: string;
  itemUpdatedToast: string;
  itemRemovedToast: string;
  receivedToast: string;
  nameRequired: string;
  quantityRequired: string;
  partRequired: string;
  locationRequired: string;
  invalidInput: string;
  permissionDenied: string;
  databaseUnavailable: string;
  actions: string;
  orderedAt: string;
  noAttribute: string;
};

type PurchaseOrdersClientProps = {
  canWrite: boolean;
  copy: Copy;
  initialOrders: PurchaseOrderSummary[];
  organizations: Organization[];
  assignableLocations: StorageLocationListItem[];
  workspaceSlug: string;
};

type ReceiveRowState = { quantity: string; locationId: string };

export function PurchaseOrdersClient({
  canWrite,
  copy,
  initialOrders,
  organizations,
  assignableLocations,
  workspaceSlug
}: PurchaseOrdersClientProps) {
  const [orders, setOrders] = useState(initialOrders);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [orderDialogMode, setOrderDialogMode] = useState<"create" | "edit" | null>(null);
  const [editingOrder, setEditingOrder] = useState<PurchaseOrderSummary | null>(null);
  const [orderPendingDelete, setOrderPendingDelete] = useState<PurchaseOrderSummary | null>(null);
  const [markOrderedPending, setMarkOrderedPending] = useState(false);
  const [itemDialogMode, setItemDialogMode] = useState<"create" | "edit" | null>(null);
  const [editingItem, setEditingItem] = useState<PurchaseOrderItem | null>(null);
  const [itemPendingRemove, setItemPendingRemove] = useState<PurchaseOrderItem | null>(null);
  const [receiveDialogOpen, setReceiveDialogOpen] = useState(false);
  const [receiveRows, setReceiveRows] = useState<Map<string, ReceiveRowState>>(new Map());
  const [partSearchQuery, setPartSearchQuery] = useState("");
  const [selectedPartId, setSelectedPartId] = useState<string | null>(null);
  const [lookupState, setLookupState] = useState<"idle" | "loading" | "found" | "not-found">("idle");
  const [orderFormErrors, setOrderFormErrors] = useState<Record<string, string>>({});
  const [itemFormErrors, setItemFormErrors] = useState<Record<string, string>>({});
  const [receiveFormErrors, setReceiveFormErrors] = useState<Record<string, string>>({});
  const [dialogFormKey, setDialogFormKey] = useState(0);
  const [toastMessages, setToastMessages] = useState<ToastMessage[]>([]);
  const nextToastIdRef = useRef(0);
  const orderDialogRef = useRef<HTMLDialogElement>(null);
  const itemDialogRef = useRef<HTMLDialogElement>(null);
  const receiveDialogRef = useRef<HTMLDialogElement>(null);
  const markOrderedDialogRef = useRef<HTMLDialogElement>(null);

  const { data: orderDetail, refetch: refetchDetail } = useQuery({
    queryKey: ["purchase-order-detail", workspaceSlug, selectedOrderId],
    queryFn: async () => {
      if (!selectedOrderId) return null;
      const result = await getPurchaseOrderDetailForWorkspace({
        workspaceSlug,
        orderId: selectedOrderId
      });
      return result.ok ? result.data : null;
    },
    enabled: Boolean(selectedOrderId)
  });

  const { data: partsSearchResult } = useQuery({
    queryKey: ["parts-search-po", workspaceSlug, partSearchQuery],
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

  const createOrderMutation = useMutation({
    mutationFn: createPurchaseOrderForWorkspace,
    onSuccess: (result) => {
      if (!result.ok) { setOrderFormErrors({ submit: getErrorMsg(copy, result.error) }); return; }
      closeOrderDialog();
      addToast(copy.createdToast);
      setSelectedOrderId(result.data.orderId);
      void reloadOrders();
    }
  });

  const updateOrderMutation = useMutation({
    mutationFn: updatePurchaseOrderForWorkspace,
    onSuccess: (result) => {
      if (!result.ok) { setOrderFormErrors({ submit: getErrorMsg(copy, result.error) }); return; }
      closeOrderDialog();
      addToast(copy.updatedToast);
      void reloadOrders();
    }
  });

  const deleteOrderMutation = useMutation({
    mutationFn: deletePurchaseOrderForWorkspace,
    onSuccess: (result) => {
      if (!result.ok) { addToast(getErrorMsg(copy, result.error)); return; }
      if (selectedOrderId === orderPendingDelete?.id) setSelectedOrderId(null);
      setOrderPendingDelete(null);
      addToast(copy.deletedToast);
      void reloadOrders();
    }
  });

  const markOrderedMutation = useMutation({
    mutationFn: markOrderedForWorkspace,
    onSuccess: (result) => {
      if (!result.ok) { addToast(getErrorMsg(copy, result.error)); return; }
      setMarkOrderedPending(false);
      closeDialog(markOrderedDialogRef.current);
      addToast(copy.orderedToast);
      void refetchDetail();
      void reloadOrders();
    }
  });

  const addItemMutation = useMutation({
    mutationFn: addOrderItemForWorkspace,
    onSuccess: (result) => {
      if (!result.ok) { setItemFormErrors({ submit: getErrorMsg(copy, result.error) }); return; }
      closeItemDialog();
      addToast(copy.itemAddedToast);
      void refetchDetail();
      void reloadOrders();
    }
  });

  const updateItemMutation = useMutation({
    mutationFn: updateOrderItemForWorkspace,
    onSuccess: (result) => {
      if (!result.ok) { setItemFormErrors({ submit: getErrorMsg(copy, result.error) }); return; }
      closeItemDialog();
      addToast(copy.itemUpdatedToast);
      void refetchDetail();
    }
  });

  const removeItemMutation = useMutation({
    mutationFn: removeOrderItemForWorkspace,
    onSuccess: (result) => {
      if (!result.ok) { addToast(getErrorMsg(copy, result.error)); return; }
      setItemPendingRemove(null);
      addToast(copy.itemRemovedToast);
      void refetchDetail();
      void reloadOrders();
    }
  });

  const receiveItemsMutation = useMutation({
    mutationFn: receiveItemsForWorkspace,
    onSuccess: (result) => {
      if (!result.ok) { setReceiveFormErrors({ submit: getErrorMsg(copy, result.error) }); return; }
      closeReceiveDialog();
      addToast(copy.receivedToast);
      void refetchDetail();
      void reloadOrders();
    }
  });

  async function reloadOrders() {
    const result = await getPurchaseOrdersForWorkspace({ workspaceSlug });
    if (result.ok) setOrders(result.data);
  }

  function openCreateOrderDialog() {
    setEditingOrder(null);
    setOrderDialogMode("create");
    setOrderFormErrors({});
    setDialogFormKey((k) => k + 1);
    window.requestAnimationFrame(() => openDialog(orderDialogRef.current));
  }

  function openEditOrderDialog(order: PurchaseOrderSummary) {
    setEditingOrder(order);
    setOrderDialogMode("edit");
    setOrderFormErrors({});
    setDialogFormKey((k) => k + 1);
    window.requestAnimationFrame(() => openDialog(orderDialogRef.current));
  }

  function closeOrderDialog() {
    closeDialog(orderDialogRef.current);
    setOrderDialogMode(null);
    setEditingOrder(null);
    setOrderFormErrors({});
  }

  function openCreateItemDialog() {
    setEditingItem(null);
    setItemDialogMode("create");
    setItemFormErrors({});
    setSelectedPartId(null);
    setPartSearchQuery("");
    setLookupState("idle");
    setDialogFormKey((k) => k + 1);
    window.requestAnimationFrame(() => openDialog(itemDialogRef.current));
  }

  function openEditItemDialog(item: PurchaseOrderItem) {
    setEditingItem(item);
    setItemDialogMode("edit");
    setItemFormErrors({});
    setSelectedPartId(item.partId);
    setPartSearchQuery("");
    setLookupState("idle");
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
    setLookupState("idle");
  }

  function openReceiveDialog() {
    const detail = orderDetail as PurchaseOrderDetail | null | undefined;
    if (!detail) return;
    const rows = new Map<string, ReceiveRowState>();
    for (const item of detail.items) {
      const remaining = (parseFloat(item.quantity) - parseFloat(item.receivedQuantity)).toString();
      if (parseFloat(remaining) > 0) {
        rows.set(item.id, { quantity: remaining, locationId: assignableLocations[0]?.id ?? "" });
      }
    }
    setReceiveRows(rows);
    setReceiveFormErrors({});
    setDialogFormKey((k) => k + 1);
    setReceiveDialogOpen(true);
    window.requestAnimationFrame(() => openDialog(receiveDialogRef.current));
  }

  function closeReceiveDialog() {
    closeDialog(receiveDialogRef.current);
    setReceiveDialogOpen(false);
    setReceiveFormErrors({});
  }

  function handleOrderSubmit(formData: FormData) {
    const supplierId = getString(formData, "supplierId");
    if (!supplierId) { setOrderFormErrors({ supplier: copy.nameRequired }); return; }

    if (orderDialogMode === "create") {
      createOrderMutation.mutate({
        workspaceSlug,
        supplierId,
        orderNumber: getString(formData, "orderNumber") || null,
        notes: getString(formData, "notes") || null
      });
    } else if (editingOrder) {
      updateOrderMutation.mutate({
        workspaceSlug,
        orderId: editingOrder.id,
        supplierId,
        orderNumber: getString(formData, "orderNumber") || null,
        notes: getString(formData, "notes") || null
      });
    }
  }

  async function handleLookupSku() {
    if (!selectedPartId && !editingItem?.partId) return;
    const partId = selectedPartId ?? editingItem!.partId;
    setLookupState("loading");
    const result = await lookupSupplierItemForWorkspace({ workspaceSlug, partId });
    if (!result.ok) { setLookupState("not-found"); return; }
    if (result.data.ok) {
      const skuInput = document.getElementById("item-supplier-sku") as HTMLInputElement | null;
      if (skuInput) skuInput.value = result.data.supplierSku;
      setLookupState("found");
    } else {
      setLookupState("not-found");
    }
  }

  function handleItemSubmit(formData: FormData) {
    const quantity = getString(formData, "quantity");
    const partId = selectedPartId ?? editingItem?.partId ?? null;

    if (!partId && itemDialogMode === "create") { setItemFormErrors({ part: copy.partRequired }); return; }
    if (!quantity) { setItemFormErrors({ quantity: copy.quantityRequired }); return; }

    if (itemDialogMode === "create" && selectedOrderId && partId) {
      addItemMutation.mutate({
        workspaceSlug,
        orderId: selectedOrderId,
        partId,
        quantity,
        supplierSku: getString(formData, "supplierSku") || null,
        unitPrice: getString(formData, "unitPrice") || null,
        currency: getString(formData, "currency") || null,
        notes: getString(formData, "notes") || null
      });
    } else if (editingItem && selectedOrderId) {
      updateItemMutation.mutate({
        workspaceSlug,
        orderId: selectedOrderId,
        itemId: editingItem.id,
        quantity,
        supplierSku: getString(formData, "supplierSku") || null,
        unitPrice: getString(formData, "unitPrice") || null,
        currency: getString(formData, "currency") || null,
        notes: getString(formData, "notes") || null
      });
    }
  }

  function handleReceiveSubmit() {
    if (!selectedOrderId) return;
    const itemsToReceive: Array<{ itemId: string; quantity: string; locationId: string }> = [];

    for (const [itemId, row] of receiveRows) {
      if (!row.quantity || parseFloat(row.quantity) <= 0) continue;
      if (!row.locationId) { setReceiveFormErrors({ submit: copy.locationRequired }); return; }
      itemsToReceive.push({ itemId, quantity: row.quantity, locationId: row.locationId });
    }

    if (itemsToReceive.length === 0) { setReceiveFormErrors({ submit: copy.quantityRequired }); return; }

    receiveItemsMutation.mutate({ workspaceSlug, orderId: selectedOrderId, items: itemsToReceive });
  }

  function addToast(message: string) {
    setToastMessages((msgs) => [...msgs, { id: getNextToastId(nextToastIdRef), message }]);
  }

  const detail = orderDetail as PurchaseOrderDetail | null | undefined;
  const detailItems = detail?.items ?? [];
  const unreceived = detailItems.filter(
    (item) => parseFloat(item.receivedQuantity) < parseFloat(item.quantity)
  );
  const isMutating =
    createOrderMutation.isPending ||
    updateOrderMutation.isPending ||
    addItemMutation.isPending ||
    updateItemMutation.isPending ||
    receiveItemsMutation.isPending ||
    markOrderedMutation.isPending;

  function statusLabel(status: "DRAFT" | "ORDERED" | "RECEIVED") {
    if (status === "DRAFT") return copy.statusDraft;
    if (status === "ORDERED") return copy.statusOrdered;
    return copy.statusReceived;
  }

  function statusBadgeClass(status: "DRAFT" | "ORDERED" | "RECEIVED") {
    if (status === "DRAFT") return "bg-slate-100 text-slate-700";
    if (status === "ORDERED") return "bg-amber-100 text-amber-800";
    return "bg-[var(--color-success-soft)] text-[var(--color-success)]";
  }

  return (
    <section className="flex min-h-0 flex-1 flex-col gap-4">
      {/* Orders table */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-700">{copy.title}</h2>
        <button
          className="inline-flex min-h-9 items-center rounded-md bg-[var(--color-accent)] px-4 text-sm font-semibold text-white transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={!canWrite || organizations.length === 0}
          type="button"
          onClick={openCreateOrderDialog}
        >
          {copy.newOrder}
        </button>
      </div>

      {organizations.length === 0 ? (
        <p className="text-sm text-amber-700">{copy.noSuppliers}</p>
      ) : null}

      <div className="rounded-md border border-slate-200 bg-white">
        {orders.length === 0 ? (
          <p className="px-4 py-6 text-sm text-slate-600">{copy.noOrders}</p>
        ) : (
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="px-4 py-3 font-semibold text-slate-700">{copy.supplier}</th>
                <th className="px-4 py-3 font-semibold text-slate-700">{copy.orderNumber}</th>
                <th className="px-4 py-3 font-semibold text-slate-700">{copy.status}</th>
                <th className="w-24 px-4 py-3 font-semibold text-slate-700">{copy.items}</th>
                <th className="px-4 py-3 font-semibold text-slate-700">{copy.actions}</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr
                  key={order.id}
                  className={`border-b border-slate-100 last:border-b-0 ${selectedOrderId === order.id ? "bg-[var(--color-accent-soft)]" : ""}`}
                >
                  <td className="px-4 py-3 font-medium text-slate-900">{order.supplierName}</td>
                  <td className="px-4 py-3 text-slate-600">{order.orderNumber ?? copy.noAttribute}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusBadgeClass(order.status)}`}>
                      {statusLabel(order.status)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {order.itemCount} {order.itemCount === 1 ? copy.items : copy.itemsPlural}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button
                        className="min-h-9 rounded-md border border-slate-300 px-3 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
                        type="button"
                        onClick={() => setSelectedOrderId(order.id === selectedOrderId ? null : order.id)}
                      >
                        {copy.openOrder}
                      </button>
                      <button
                        className="min-h-9 rounded-md border border-slate-300 px-3 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                        type="button"
                        disabled={!canWrite || order.status === "RECEIVED"}
                        onClick={() => openEditOrderDialog(order)}
                      >
                        {copy.edit}
                      </button>
                      <button
                        className="min-h-9 rounded-md border border-[var(--color-error-border)] px-3 text-sm font-medium text-[var(--color-error)] transition hover:bg-[var(--color-error-soft)] disabled:cursor-not-allowed disabled:opacity-60"
                        type="button"
                        disabled={!canWrite || order.status !== "DRAFT" || deleteOrderMutation.isPending}
                        onClick={() => setOrderPendingDelete(order)}
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

      {/* Order detail panel */}
      {selectedOrderId && detail ? (
        <div className="flex min-h-0 flex-1 flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h2 className="text-sm font-semibold text-slate-700">
                {detail.supplierName}
                {detail.orderNumber ? ` · ${detail.orderNumber}` : ""}
              </h2>
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusBadgeClass(detail.status)}`}>
                {statusLabel(detail.status)}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {detail.status === "DRAFT" ? (
                <button
                  className="min-h-9 rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                  type="button"
                  disabled={!canWrite || detailItems.length === 0}
                  onClick={() => {
                    setMarkOrderedPending(true);
                    window.requestAnimationFrame(() => openDialog(markOrderedDialogRef.current));
                  }}
                >
                  {copy.markOrdered}
                </button>
              ) : null}
              {detail.status === "ORDERED" && unreceived.length > 0 ? (
                <button
                  className="min-h-9 rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                  type="button"
                  disabled={!canWrite || assignableLocations.length === 0}
                  onClick={openReceiveDialog}
                >
                  {copy.receiveItems}
                </button>
              ) : null}
              {detail.status !== "RECEIVED" ? (
                <button
                  className="inline-flex min-h-9 items-center rounded-md bg-[var(--color-accent)] px-3 text-sm font-semibold text-white transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
                  type="button"
                  disabled={!canWrite}
                  onClick={openCreateItemDialog}
                >
                  {copy.addItem}
                </button>
              ) : null}
            </div>
          </div>

          <div className="rounded-md border border-slate-200 bg-white">
            {detailItems.length === 0 ? (
              <p className="px-4 py-6 text-sm text-slate-600">{copy.noItems}</p>
            ) : (
              <table className="w-full border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    <th className="px-4 py-3 font-semibold text-slate-700">{copy.part}</th>
                    <th className="px-4 py-3 font-semibold text-slate-700">{copy.quantity}</th>
                    <th className="px-4 py-3 font-semibold text-slate-700">{copy.received}</th>
                    <th className="px-4 py-3 font-semibold text-slate-700">{copy.supplierSku}</th>
                    <th className="px-4 py-3 font-semibold text-slate-700">{copy.unitPrice}</th>
                    {detail.status !== "RECEIVED" ? (
                      <th className="px-4 py-3 font-semibold text-slate-700">{copy.actions}</th>
                    ) : null}
                  </tr>
                </thead>
                <tbody>
                  {detailItems.map((item) => {
                    const isFullyReceived = parseFloat(item.receivedQuantity) >= parseFloat(item.quantity);
                    return (
                      <tr key={item.id} className={`border-b border-slate-100 last:border-b-0 ${isFullyReceived ? "opacity-60" : ""}`}>
                        <td className="px-4 py-3">
                          <div className="font-medium text-slate-900">{item.partCatalogNumber}</div>
                          <div className="text-xs text-slate-500">{item.manufacturerName}</div>
                        </td>
                        <td className="px-4 py-3 text-slate-700">{item.quantity}</td>
                        <td className="px-4 py-3 text-slate-700">
                          {item.receivedQuantity}
                          {isFullyReceived ? (
                            <span className="ml-2 text-xs text-[var(--color-success)]">✓</span>
                          ) : null}
                        </td>
                        <td className="px-4 py-3 font-mono text-slate-600">{item.supplierSku ?? copy.noAttribute}</td>
                        <td className="px-4 py-3 text-slate-600">
                          {item.unitPrice ? `${item.unitPrice}${item.currency ? ` ${item.currency}` : ""}` : copy.noAttribute}
                        </td>
                        {detail.status !== "RECEIVED" ? (
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
                        ) : null}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      ) : null}

      {/* Create/edit order dialog */}
      <DialogShell
        ref={orderDialogRef}
        closeLabel={copy.close}
        title={orderDialogMode === "create" ? copy.newOrderTitle : copy.editOrderTitle}
        titleId="order-dialog-title"
        widthClassName="w-[min(32rem,calc(100vw-3rem))]"
        onClose={closeOrderDialog}
      >
        {orderDialogMode ? (
          <form key={dialogFormKey} action={handleOrderSubmit} className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <DialogBody className="grid gap-4">
              <div className="grid gap-2">
                <LabelWithError error={orderFormErrors.supplier} htmlFor="order-supplier">
                  {copy.supplier}
                </LabelWithError>
                {organizations.length === 0 ? (
                  <p className="text-sm text-slate-500">{copy.noSuppliers}</p>
                ) : (
                  <select
                    id="order-supplier"
                    name="supplierId"
                    defaultValue={editingOrder?.supplierId ?? ""}
                    className={getFieldInputClassName(
                      "min-h-10 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-950 outline-none transition hover:border-slate-400 focus:border-slate-500 focus:ring-2 focus:ring-slate-200",
                      Boolean(orderFormErrors.supplier)
                    )}
                  >
                    <option value="" disabled>{copy.chooseSupplier}</option>
                    {organizations.map((org) => (
                      <option key={org.id} value={org.id}>{org.name}</option>
                    ))}
                  </select>
                )}
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-medium text-slate-700" htmlFor="order-number">
                  {copy.orderNumber}
                </label>
                <input
                  id="order-number"
                  name="orderNumber"
                  placeholder={copy.orderNumberPlaceholder}
                  defaultValue={editingOrder?.orderNumber ?? ""}
                  className="min-h-10 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-950 outline-none transition hover:border-slate-400 focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                />
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-medium text-slate-700" htmlFor="order-notes">
                  {copy.notes}
                </label>
                <input
                  id="order-notes"
                  name="notes"
                  placeholder={copy.notesPlaceholder}
                  className="min-h-10 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-950 outline-none transition hover:border-slate-400 focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                />
              </div>
            </DialogBody>
            <DialogFooter className="justify-end gap-2">
              <button className="min-h-10 rounded-md border border-slate-300 px-3 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50" type="button" onClick={closeOrderDialog}>
                {copy.cancel}
              </button>
              <button
                className="min-h-10 rounded-md bg-[var(--color-accent)] px-4 text-sm font-semibold text-white transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
                type="submit"
                disabled={isMutating}
              >
                {orderDialogMode === "create" ? copy.createOrder : copy.saveChanges}
              </button>
            </DialogFooter>
            {orderFormErrors.submit ? <ErrorBubble>{orderFormErrors.submit}</ErrorBubble> : null}
          </form>
        ) : null}
      </DialogShell>

      {/* Add/edit item dialog */}
      <DialogShell
        ref={itemDialogRef}
        closeLabel={copy.close}
        title={itemDialogMode === "create" ? copy.addItem : copy.editItem}
        titleId="po-item-dialog-title"
        widthClassName="w-[min(40rem,calc(100vw-3rem))]"
        onClose={closeItemDialog}
      >
        {itemDialogMode ? (
          <form key={dialogFormKey} action={handleItemSubmit} className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <DialogBody className="grid gap-4">
              {itemDialogMode === "create" ? (
                <div className="grid gap-2">
                  <LabelWithError error={itemFormErrors.part}>{copy.part}</LabelWithError>
                  <input
                    type="text"
                    placeholder={copy.searchPartsPlaceholder}
                    value={partSearchQuery}
                    onChange={(e) => { setPartSearchQuery(e.target.value); setSelectedPartId(null); setLookupState("idle"); }}
                    className="min-h-10 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-950 outline-none transition hover:border-slate-400 focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                  />
                  {partsSearchResult && partsSearchResult.length > 0 ? (
                    <div className="max-h-40 overflow-auto rounded-md border border-slate-200 bg-white">
                      {partsSearchResult.map((part) => (
                        <button
                          key={part.id}
                          type="button"
                          className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition hover:bg-slate-50 ${selectedPartId === part.id ? "bg-[var(--color-accent-soft)] font-medium" : ""}`}
                          onClick={() => { setSelectedPartId(part.id); setPartSearchQuery(`${part.catalogNumber} — ${part.manufacturerName}`); setLookupState("idle"); }}
                        >
                          <span className="font-medium text-slate-900">{part.catalogNumber}</span>
                          <span className="text-slate-500">{part.manufacturerName}</span>
                        </button>
                      ))}
                    </div>
                  ) : partSearchQuery && partsSearchResult?.length === 0 ? (
                    <p className="text-xs text-slate-500">{copy.noMatchingParts}</p>
                  ) : null}
                </div>
              ) : (
                <div className="grid gap-1">
                  <p className="text-sm font-medium text-slate-700">{copy.part}</p>
                  <p className="text-sm text-slate-900">{editingItem?.partCatalogNumber} — {editingItem?.manufacturerName}</p>
                </div>
              )}

              <div className="grid gap-2">
                <LabelWithError error={itemFormErrors.quantity} htmlFor="po-item-quantity">{copy.quantity}</LabelWithError>
                <input
                  id="po-item-quantity"
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
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-slate-700" htmlFor="item-supplier-sku">{copy.supplierSku}</label>
                  <button
                    type="button"
                    className="text-xs font-medium text-[var(--color-accent)] disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={!selectedPartId && !editingItem?.partId || lookupState === "loading"}
                    onClick={() => void handleLookupSku()}
                  >
                    {lookupState === "loading" ? "…" : lookupState === "found" ? copy.skuFound : lookupState === "not-found" ? copy.skuNotFound : copy.lookupSku}
                  </button>
                </div>
                <input
                  id="item-supplier-sku"
                  name="supplierSku"
                  defaultValue={editingItem?.supplierSku ?? ""}
                  className="min-h-10 rounded-md border border-slate-300 bg-white px-3 py-1.5 font-mono text-sm text-slate-950 outline-none transition hover:border-slate-400 focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-2">
                  <label className="text-sm font-medium text-slate-700" htmlFor="po-item-price">{copy.unitPrice}</label>
                  <input
                    id="po-item-price"
                    name="unitPrice"
                    type="text"
                    inputMode="decimal"
                    defaultValue={editingItem?.unitPrice ?? ""}
                    className="min-h-10 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-950 outline-none transition hover:border-slate-400 focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                  />
                </div>
                <div className="grid gap-2">
                  <label className="text-sm font-medium text-slate-700" htmlFor="po-item-currency">{copy.currency}</label>
                  <input
                    id="po-item-currency"
                    name="currency"
                    defaultValue={editingItem?.currency ?? ""}
                    placeholder="USD"
                    className="min-h-10 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-950 outline-none transition hover:border-slate-400 focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                  />
                </div>
              </div>

              <div className="grid gap-2">
                <label className="text-sm font-medium text-slate-700" htmlFor="po-item-notes">{copy.notes}</label>
                <input
                  id="po-item-notes"
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

      {/* Receive items dialog */}
      <DialogShell
        ref={receiveDialogRef}
        closeLabel={copy.close}
        title={copy.receiveItemsTitle}
        titleId="receive-dialog-title"
        description={copy.receiveItemsBody}
        widthClassName="w-[min(44rem,calc(100vw-3rem))]"
        onClose={closeReceiveDialog}
      >
        {receiveDialogOpen ? (
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <DialogBody className="grid gap-4">
              {assignableLocations.length === 0 ? (
                <p className="text-sm text-amber-700">{copy.noLocations}</p>
              ) : (
                <div className="overflow-auto rounded-md border border-slate-200">
                  <table className="w-full border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50">
                        <th className="px-3 py-2 text-left font-semibold text-slate-700">{copy.part}</th>
                        <th className="px-3 py-2 text-left font-semibold text-slate-700">{copy.remaining}</th>
                        <th className="px-3 py-2 text-left font-semibold text-slate-700">{copy.receivedQty}</th>
                        <th className="px-3 py-2 text-left font-semibold text-slate-700">{copy.location}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {unreceived.map((item) => {
                        const row = receiveRows.get(item.id) ?? { quantity: "", locationId: "" };
                        const remaining = parseFloat(item.quantity) - parseFloat(item.receivedQuantity);
                        return (
                          <tr key={item.id} className="border-b border-slate-100 last:border-b-0">
                            <td className="px-3 py-2">
                              <div className="font-medium text-slate-900">{item.partCatalogNumber}</div>
                              <div className="text-xs text-slate-500">{item.manufacturerName}</div>
                            </td>
                            <td className="px-3 py-2 text-slate-600">{remaining}</td>
                            <td className="px-3 py-2">
                              <input
                                type="text"
                                inputMode="decimal"
                                value={row.quantity}
                                onChange={(e) => setReceiveRows((prev) => {
                                  const next = new Map(prev);
                                  next.set(item.id, { ...row, quantity: e.target.value });
                                  return next;
                                })}
                                className="w-24 rounded-md border border-slate-300 bg-white px-2 py-1 text-sm text-slate-950 outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                              />
                            </td>
                            <td className="px-3 py-2">
                              <select
                                value={row.locationId}
                                onChange={(e) => setReceiveRows((prev) => {
                                  const next = new Map(prev);
                                  next.set(item.id, { ...row, locationId: e.target.value });
                                  return next;
                                })}
                                className="rounded-md border border-slate-300 bg-white px-2 py-1 text-sm text-slate-950 outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                              >
                                <option value="" disabled>{copy.chooseLocation}</option>
                                {assignableLocations.map((loc) => (
                                  <option key={loc.id} value={loc.id}>{loc.name}</option>
                                ))}
                              </select>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </DialogBody>
            <DialogFooter className="justify-end gap-2">
              <button className="min-h-10 rounded-md border border-slate-300 px-3 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50" type="button" onClick={closeReceiveDialog}>
                {copy.cancel}
              </button>
              <button
                className="min-h-10 rounded-md bg-[var(--color-accent)] px-4 text-sm font-semibold text-white transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
                type="button"
                disabled={isMutating || assignableLocations.length === 0}
                onClick={handleReceiveSubmit}
              >
                {copy.receiveItems}
              </button>
            </DialogFooter>
            {receiveFormErrors.submit ? <ErrorBubble>{receiveFormErrors.submit}</ErrorBubble> : null}
          </div>
        ) : null}
      </DialogShell>

      {/* Mark as ordered confirmation dialog */}
      <DialogShell
        ref={markOrderedDialogRef}
        closeLabel={copy.close}
        title={copy.markOrderedConfirmTitle}
        titleId="mark-ordered-dialog-title"
        widthClassName="w-[min(28rem,calc(100vw-3rem))]"
        onClose={() => setMarkOrderedPending(false)}
      >
        {markOrderedPending ? (
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <DialogBody>
              <p className="text-sm leading-6 text-slate-600">{copy.markOrderedConfirmBody}</p>
            </DialogBody>
            <DialogFooter className="justify-end gap-2">
              <button
                className="min-h-10 rounded-md border border-slate-300 px-3 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
                type="button"
                onClick={() => { closeDialog(markOrderedDialogRef.current); setMarkOrderedPending(false); }}
              >
                {copy.cancel}
              </button>
              <button
                className="min-h-10 rounded-md bg-[var(--color-accent)] px-4 text-sm font-semibold text-white transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
                type="button"
                disabled={isMutating}
                onClick={() => {
                  if (selectedOrderId) markOrderedMutation.mutate({ workspaceSlug, orderId: selectedOrderId });
                }}
              >
                {copy.confirm}
              </button>
            </DialogFooter>
          </div>
        ) : null}
      </DialogShell>

      {/* Delete order confirmation */}
      <DeleteConfirmationDialog
        body={copy.deleteConfirmationBody}
        cancelLabel={copy.cancelDelete}
        closeLabel={copy.close}
        confirmLabel={copy.confirmDelete}
        deleteLabel={copy.deleteOrder}
        isPending={deleteOrderMutation.isPending}
        itemName={orderPendingDelete ? `${orderPendingDelete.supplierName}${orderPendingDelete.orderNumber ? ` · ${orderPendingDelete.orderNumber}` : ""}` : ""}
        open={Boolean(orderPendingDelete)}
        onCancel={() => setOrderPendingDelete(null)}
        onConfirm={() => {
          if (orderPendingDelete) deleteOrderMutation.mutate({ workspaceSlug, orderId: orderPendingDelete.id });
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
          if (itemPendingRemove && selectedOrderId) {
            removeItemMutation.mutate({ workspaceSlug, orderId: selectedOrderId, itemId: itemPendingRemove.id });
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
