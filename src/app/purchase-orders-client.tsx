"use client";

import {
  type KeyboardEvent as ReactKeyboardEvent,
  useMemo,
  useRef,
  useState
} from "react";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable
} from "@tanstack/react-table";
import {
  keepPreviousData,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient
} from "@tanstack/react-query";

import {
  addOrderItemForWorkspace,
  deletePurchaseOrderForWorkspace,
  getPurchaseOrderDetailForWorkspace,
  getPurchaseOrdersForWorkspace,
  markOrderedForWorkspace,
  receiveItemsForWorkspace,
  removeOrderItemForWorkspace,
  revertOrderToDraftForWorkspace,
  saveManualExchangeRateForWorkspace,
  updateOrderItemForWorkspace,
  updatePurchaseOrderForWorkspace
} from "@/server/purchase-orders/purchaseOrderActions";
import { CreatePurchaseOrderDialog } from "@/app/create-purchase-order-dialog";
import { SupplierPickerCombobox } from "@/app/supplier-picker-combobox";
import { PartPickerCombobox, type PartPickerOption } from "@/app/part-picker-combobox";
import type {
  PurchaseOrderDetail,
  PurchaseOrderItem,
  PurchaseOrderSummary
} from "@/server/purchase-orders/purchaseOrderMutations";
import type { PurchaseOrderSortBy } from "@/server/purchase-orders/purchaseOrderMutations";
import type { ListPage } from "@/server/pagination";
import {
  closeDialog,
  DeleteConfirmationDialog,
  DialogActions,
  DialogBody,
  DialogShell,
  getFieldInputClassName,
  LabelWithError,
  openDialog
} from "@/app/dialog-shell";
import { getNextToastId, ToastNotice, type ToastMessage } from "@/app/toast-notice";
import type { StorageLocationListItem } from "@/server/inventory/locationMutations";
import { buildTree } from "@/app/tree-picker-utils";
import { LocationTreeSelect } from "@/app/location-tree-select";
import { InfiniteListViewport } from "@/app/infinite-list";
import {
  useListTableConfiguration,
  type ListColumnDefinition
} from "@/app/list-table-config";
import { ListPageToolbar, ListTableHeaderCell, useColumnDragReorder, useColumnResizeCursor } from "@/app/list-page-toolbar";
import { DetailPanel, useDetailsPanelWidth } from "@/app/detail-panel";
import { EmptyCell } from "@/app/list-table-cell";
import { MultiAddToPODialog, type MultiAddToPOCopy } from "@/app/multi-add-to-po-dialog";
import { PartLink } from "@/app/entity-links";
import { PinnedFilterBanner } from "@/app/pinned-filter-banner";

function roundDisplay(n: number): string {
  return n.toFixed(2);
}

function getEffectiveTaxRate(
  itemTaxRate: string | null | undefined,
  orderTaxRate: string | null | undefined,
  orderSupplierDefaultTaxRate: string | null | undefined,
  workspaceDefaultTaxRate: string | null | undefined
): number {
  return (
    parseFloat(itemTaxRate ?? "") ||
    parseFloat(orderTaxRate ?? "") ||
    parseFloat(orderSupplierDefaultTaxRate ?? "") ||
    parseFloat(workspaceDefaultTaxRate ?? "") ||
    0
  );
}

type InlinePriceSaveVars = {
  workspaceSlug: string;
  orderId: string;
  itemId: string;
  quantity: string;
  supplierSku?: string | null;
  unitPrice?: string | null;
  currency?: string | null;
  taxRate?: string | null;
  notes?: string | null;
};

function InlinePriceCell({
  item,
  isGrossMode,
  orderTaxRate,
  orderSupplierDefaultTaxRate,
  workspaceDefaultTaxRate,
  orderId,
  workspaceSlug,
  canWrite,
  isReceived,
  isPending,
  onSave,
  noAttributeLabel,
}: {
  item: PurchaseOrderItem;
  isGrossMode: boolean;
  orderTaxRate: string | null | undefined;
  orderSupplierDefaultTaxRate: string | null | undefined;
  workspaceDefaultTaxRate: string | null | undefined;
  orderId: string;
  workspaceSlug: string;
  canWrite: boolean;
  isReceived: boolean;
  isPending: boolean;
  onSave: (vars: InlinePriceSaveVars) => void;
  noAttributeLabel: string;
}) {
  const [editing, setEditing] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const cancelledRef = useRef(false);

  const effectiveTaxRate = getEffectiveTaxRate(
    item.taxRate,
    orderTaxRate,
    orderSupplierDefaultTaxRate,
    workspaceDefaultTaxRate
  );

  const displayPrice =
    item.unitPrice != null
      ? isGrossMode
        ? roundDisplay(parseFloat(item.unitPrice) * (1 + effectiveTaxRate / 100))
        : roundDisplay(parseFloat(item.unitPrice))
      : null;

  function startEditing() {
    if (!canWrite || isReceived || isPending) return;
    setInputValue(displayPrice ?? "");
    setEditing(true);
    cancelledRef.current = false;
    requestAnimationFrame(() => {
      inputRef.current?.select();
    });
  }

  function commit() {
    if (cancelledRef.current) {
      cancelledRef.current = false;
      setEditing(false);
      return;
    }
    const val = inputValue.trim().replace(",", ".");
    const num = parseFloat(val);
    if (isNaN(num) || num < 0) {
      setEditing(false);
      return;
    }
    const netPrice = isGrossMode ? num / (1 + effectiveTaxRate / 100) : num;
    onSave({
      workspaceSlug,
      orderId,
      itemId: item.id,
      quantity: item.quantity,
      supplierSku: item.supplierSku,
      unitPrice: netPrice.toFixed(10),
      currency: item.currency ?? null,
      taxRate: item.taxRate ?? null,
      notes: item.notes ?? null,
    });
    setEditing(false);
  }

  function handleKeyDown(e: ReactKeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      inputRef.current?.blur();
    } else if (e.key === "Escape") {
      cancelledRef.current = true;
      inputRef.current?.blur();
    }
  }

  const editable = canWrite && !isReceived;
  const displayText = displayPrice != null
    ? `${displayPrice}${item.currency ? ` ${item.currency}` : ""}`
    : noAttributeLabel;

  return (
    <td
      className={`relative px-3 py-2 text-right font-mono text-[var(--color-text-secondary)] whitespace-nowrap${editable && !editing ? " cursor-pointer" : ""}${isPending ? " opacity-60" : ""}`}
      onClick={!editing && editable ? startEditing : undefined}
    >
      {/* Invisible anchor — always reserves the column width */}
      <span
        aria-hidden={editing || undefined}
        className={editing ? "invisible pointer-events-none" : (editable ? "hover:underline decoration-dotted underline-offset-2" : undefined)}
        title={!editing && displayPrice != null ? `${item.unitPrice}${item.currency ? ` ${item.currency}` : ""}` : undefined}
      >
        {displayText}
      </span>
      {editing && (
        <input
          ref={inputRef}
          autoFocus
          type="text"
          inputMode="decimal"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={commit}
          className="absolute left-3 right-3 top-1/2 -translate-y-1/2 rounded border border-[var(--color-border-hover)] bg-[var(--color-bg-elevated)] px-1.5 py-0.5 text-sm text-right font-mono text-[var(--color-text-primary)] outline-none focus:border-[var(--color-border-hover)] focus:ring-1 focus:ring-[var(--color-ring)]"
        />
      )}
    </td>
  );
}

type Copy = {
  title: string;
  intro: string;
  newOrder: string;
  newOrderTitle: string;
  editOrderTitle: string;
  supplier: string;
  chooseSupplier: string;
  noSuppliers: string;
  loadingSuppliers: string;
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
  pinnedFilterLabel: string;
  clearPinnedFilter: string;
  loadError: string;
  loadingOrders: string;
  loadingMoreOrders: string;
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
  searchLocations: string;
  noMatchingLocations: string;
  expandLocation: string;
  collapseLocation: string;
  unitPrice: string;
  lineTotal: string;
  currency: string;
  chooseCurrency: string;
  taxRate: string;
  taxRateShort: string;
  taxRatePlaceholder: string;
  taxRateHelp: string;
  grossUnitPrice: string;
  grossLineTotal: string;
  addItem: string;
  editItem: string;
  removeItem: string;
  removeItemConfirmBody: string;
  noItems: string;
  searchParts: string;
  loadingParts: string;
  searchPartsPlaceholder: string;
  noMatchingParts: string;
  revertToDraft: string;
  revertToDraftConfirmTitle: string;
  revertToDraftConfirmBody: string;
  revertedToast: string;
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
  orderedAt: string;
  created: string;
  createdBy: string;
  supplierOrderNumber: string;
  supplierOrderNumberPlaceholder: string;
  noAttribute: string;
  totalNetValue: string;
  totalGrossValue: string;
  totalNetValuePrimary: string;
  totalGrossValuePrimary: string;
  orderTotals: string;
  configureList: string;
  configureListTitle: string;
  configureListBody: string;
  visibleColumns: string;
  moveUp: string;
  moveDown: string;
  columnWidthPx: string;
  sortingLabel: string;
  clearSorting: string;
  resetListConfiguration: string;
  orderCountSummary: string;
  priceEntryMode: string;
  priceEntryModeNet: string;
  priceEntryModeGross: string;
  exchangeRateUnavailableTitle: string;
  exchangeRateUnavailableBody: string;
  manualRateLabel: string;
  manualRateSubmit: string;
  multiAdd: MultiAddToPOCopy;
};

type PurchaseOrdersClientProps = {
  canWrite: boolean;
  canReadInventory: boolean;
  canReadShoppingLists: boolean;
  copy: Copy;
  initialPage: ListPage<PurchaseOrderSummary>;
  initialSelectedOrderId?: string;
  initialPinnedOrderId?: string;
  allLocations: StorageLocationListItem[];
  assignableLocations: StorageLocationListItem[];
  workspaceSlug: string;
  primaryCurrency: string;
  workspaceDefaultPriceEntryMode?: "net" | "gross";
  workspaceDefaultTaxRate?: string | null;
};

type ReceiveRowState = { quantity: string; locationId: string };

const columnHelper = createColumnHelper<PurchaseOrderSummary>();

export function PurchaseOrdersClient({
  canWrite,
  canReadInventory,
  canReadShoppingLists,
  copy,
  initialPage,
  initialSelectedOrderId,
  initialPinnedOrderId,
  allLocations,
  assignableLocations,
  workspaceSlug,
  primaryCurrency,
  workspaceDefaultPriceEntryMode = "net",
  workspaceDefaultTaxRate = null
}: PurchaseOrdersClientProps) {
  const queryClient = useQueryClient();

  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(
    initialSelectedOrderId ?? null
  );
  const [pinnedOrderId, setPinnedOrderId] = useState<string | null>(
    initialPinnedOrderId ?? null
  );
  const [hoveredOrderId, setHoveredOrderId] = useState<string | null>(null);
  const [orderDialogMode, setOrderDialogMode] = useState<"edit" | null>(null);
  const [createOrderDialogOpen, setCreateOrderDialogOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState<PurchaseOrderSummary | null>(null);
  const [orderPendingDelete, setOrderPendingDelete] = useState<PurchaseOrderSummary | null>(null);
  const [markOrderedPending, setMarkOrderedPending] = useState(false);
  const [revertToDraftPending, setRevertToDraftPending] = useState(false);
  const [itemDialogMode, setItemDialogMode] = useState<"create" | "edit" | null>(null);
  const [editingItem, setEditingItem] = useState<PurchaseOrderItem | null>(null);
  const [itemPendingRemove, setItemPendingRemove] = useState<PurchaseOrderItem | null>(null);
  const [receiveDialogOpen, setReceiveDialogOpen] = useState(false);
  const [receiveRows, setReceiveRows] = useState<Map<string, ReceiveRowState>>(new Map());
  const [partSearchQuery, setPartSearchQuery] = useState("");
  const [selectedPartId, setSelectedPartId] = useState<string | null>(null);
  const [orderFormErrors, setOrderFormErrors] = useState<Record<string, string>>({});
  const [itemFormErrors, setItemFormErrors] = useState<Record<string, string>>({});
  const [, setReceiveFormErrors] = useState<Record<string, string>>({});
  const [receiveMissingLocationIds, setReceiveMissingLocationIds] = useState<Set<string>>(new Set());
  const [itemUnitPrice, setItemUnitPrice] = useState("");
  const [itemLineTotal, setItemLineTotal] = useState("");
  const [itemQuantity, setItemQuantity] = useState("1");
  const [itemTaxRate, setItemTaxRate] = useState("");
  const [itemCurrency, setItemCurrency] = useState("");
  const [dialogFormKey, setDialogFormKey] = useState(0);
  const [multiAddPOOpen, setMultiAddPOOpen] = useState(false);
  const { isResizingColumn, setIsResizingColumn, containerClassName } = useColumnResizeCursor();
  const [toastMessages, setToastMessages] = useState<ToastMessage[]>([]);
  const nextToastIdRef = useRef(0);
  const orderDialogRef = useRef<HTMLDialogElement>(null);
  const createOrderDialogRef = useRef<HTMLDialogElement>(null);
  const itemDialogRef = useRef<HTMLDialogElement>(null);
  const receiveDialogRef = useRef<HTMLDialogElement>(null);
  const markOrderedDialogRef = useRef<HTMLDialogElement>(null);
  const revertToDraftDialogRef = useRef<HTMLDialogElement>(null);

  const locationTree = useMemo(() => buildTree(allLocations), [allLocations]);

  // --- Column configuration ---

  const orderColumns = useMemo<ListColumnDefinition[]>(
    () => [
      { id: "supplierName", label: copy.supplier, group: "base", defaultWidth: 200, minWidth: 100, sortable: true },
      { id: "orderNumber", label: copy.orderNumber, group: "base", defaultWidth: 160, minWidth: 80 },
      { id: "status", label: copy.status, group: "base", defaultWidth: 120, minWidth: 80, sortable: true },
      { id: "itemCount", label: copy.items, group: "base", defaultWidth: 100, minWidth: 64, sortable: true, align: "right" as const },
      { id: "supplierOrderNumber", label: copy.supplierOrderNumber, group: "base", defaultWidth: 160, minWidth: 80, defaultVisible: false },
      { id: "createdAt", label: copy.created, group: "base", defaultWidth: 160, minWidth: 100, defaultVisible: false, sortable: true },
      { id: "createdBy", label: copy.createdBy, group: "base", defaultWidth: 160, minWidth: 100, defaultVisible: false },
      { id: "orderedAt", label: copy.orderedAt, group: "base", defaultWidth: 160, minWidth: 100, defaultVisible: false },
      { id: "currency", label: copy.currency, group: "base", defaultWidth: 90, minWidth: 64, defaultVisible: false },
      { id: "totalNetValue", label: copy.totalNetValue, group: "base", defaultWidth: 150, minWidth: 100, defaultVisible: false, align: "right" as const, sortable: true },
      { id: "totalGrossValue", label: copy.totalGrossValue, group: "base", defaultWidth: 150, minWidth: 100, defaultVisible: false, align: "right" as const, sortable: true },
      { id: "totalNetValuePrimary", label: copy.totalNetValuePrimary.replace("{currency}", primaryCurrency), group: "base", defaultWidth: 170, minWidth: 100, defaultVisible: false, align: "right" as const, sortable: true },
      { id: "totalGrossValuePrimary", label: copy.totalGrossValuePrimary.replace("{currency}", primaryCurrency), group: "base", defaultWidth: 170, minWidth: 100, defaultVisible: false, align: "right" as const, sortable: true }
    ],
    [copy, primaryCurrency]
  );
  const fixedOrderColumnIds = useMemo(() => ["actions"], []);

  const {
    columnSizing,
    columnVisibility,
    configurableColumns,
    setColumnWidth,
    setColumnSorting,
    setColumnVisible,
    setColumnOrder,
    setColumnSizing,
    setColumnVisibility,
    setSorting,
    sorting,
    columnOrder: persistedColumnOrder,
    isLoaded: isOrderConfigLoaded
  } = useListTableConfiguration({
    storageKey: `oso:list-config:purchase-orders:${workspaceSlug}`,
    columns: orderColumns,
    fixedColumnIds: fixedOrderColumnIds
  });

  // --- Orders data ---

  const activeSorting = sorting[0] ?? null;

  const ordersQuery = useInfiniteQuery({
    queryKey: ["purchase-orders", workspaceSlug, { sorting, pinnedOrderId }] as const,
    enabled: isOrderConfigLoaded,
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam }) => {
      const result = await getPurchaseOrdersForWorkspace({
        workspaceSlug,
        cursor: pageParam,
        sortBy: (activeSorting?.id ?? null) as PurchaseOrderSortBy | null,
        sortDirection: activeSorting ? (activeSorting.desc ? "desc" : "asc") : null,
        pinnedId: pinnedOrderId
      });
      if (!result.ok) throw new Error(result.error);
      return result.data;
    },
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    placeholderData: keepPreviousData,
    initialData:
      sorting.length === 0 && !pinnedOrderId
        ? { pages: [initialPage], pageParams: [null] }
        : undefined
  });

  const orders = useMemo(
    () => ordersQuery.data?.pages.flatMap((p) => p.items) ?? [],
    [ordersQuery.data]
  );

  function reloadOrders() {
    void queryClient.invalidateQueries({ queryKey: ["purchase-orders", workspaceSlug] });
  }

  function refreshDetail(orderId: string) {
    void getPurchaseOrderDetailForWorkspace({ workspaceSlug, orderId }).then((result) => {
      if (result.ok) {
        queryClient.setQueryData(["purchase-order-detail", workspaceSlug, orderId], result.data);
      }
    });
  }

  // --- Detail query ---

  const { data: orderDetail } = useQuery({
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

  const [rateRequiredState, setRateRequiredState] = useState<{
    from: string;
    to: string;
    date: string;
    retryFn: () => void;
  } | null>(null);
  const [rateRequiredValue, setRateRequiredValue] = useState("");
  const [rateRequiredError, setRateRequiredError] = useState("");
  const rateRequiredDialogRef = useRef<HTMLDialogElement>(null);

  // --- Mutations ---

  function openRateDialog(details: { from: string; to: string; date: string }, retryFn: () => void) {
    setRateRequiredState({ ...details, retryFn });
    setRateRequiredValue("");
    setRateRequiredError("");
    window.requestAnimationFrame(() => openDialog(rateRequiredDialogRef.current));
  }

  const saveManualRateMutation = useMutation({
    mutationFn: saveManualExchangeRateForWorkspace,
    onSuccess: (result) => {
      if (!result.ok) { setRateRequiredError(getErrorMsg(copy, result.error)); return; }
      closeDialog(rateRequiredDialogRef.current);
      const retry = rateRequiredState?.retryFn;
      setRateRequiredState(null);
      retry?.();
    }
  });

  const updateOrderMutation = useMutation({
    mutationFn: updatePurchaseOrderForWorkspace,
    onSuccess: (result, variables) => {
      if (!result.ok) {
        if (result.error === "exchange-rate-unavailable" && result.errorDetails) {
          openRateDialog(result.errorDetails, () => updateOrderMutation.mutate(variables));
          return;
        }
        setOrderFormErrors({ submit: getErrorMsg(copy, result.error) });
        return;
      }
      closeOrderDialog();
      addToast(copy.updatedToast);
      reloadOrders();
    }
  });

  const deleteOrderMutation = useMutation({
    mutationFn: deletePurchaseOrderForWorkspace,
    onSuccess: (result) => {
      if (!result.ok) { addToast(getErrorMsg(copy, result.error)); return; }
      if (selectedOrderId === orderPendingDelete?.id) closeOrderDetails();
      setOrderPendingDelete(null);
      addToast(copy.deletedToast);
      reloadOrders();
    }
  });

  const markOrderedMutation = useMutation({
    mutationFn: markOrderedForWorkspace,
    onSuccess: (result, variables) => {
      if (!result.ok) {
        if (result.error === "exchange-rate-unavailable" && result.errorDetails) {
          closeDialog(markOrderedDialogRef.current);
          setMarkOrderedPending(false);
          openRateDialog(result.errorDetails, () => markOrderedMutation.mutate(variables));
          return;
        }
        addToast(getErrorMsg(copy, result.error));
        return;
      }
      setMarkOrderedPending(false);
      closeDialog(markOrderedDialogRef.current);
      addToast(copy.orderedToast);
      refreshDetail(variables.orderId);
      reloadOrders();
    }
  });

  const revertToDraftMutation = useMutation({
    mutationFn: revertOrderToDraftForWorkspace,
    onSuccess: (result, variables) => {
      if (!result.ok) { addToast(getErrorMsg(copy, result.error)); return; }
      setRevertToDraftPending(false);
      closeDialog(revertToDraftDialogRef.current);
      addToast(copy.revertedToast);
      refreshDetail(variables.orderId);
      reloadOrders();
    }
  });

  const addItemMutation = useMutation({
    mutationFn: addOrderItemForWorkspace,
    onSuccess: (result, variables) => {
      if (!result.ok) {
        if (result.error === "exchange-rate-unavailable" && result.errorDetails) {
          openRateDialog(result.errorDetails, () => addItemMutation.mutate(variables));
          return;
        }
        setItemFormErrors({ submit: getErrorMsg(copy, result.error) });
        return;
      }
      closeItemDialog();
      addToast(copy.itemAddedToast);
      refreshDetail(variables.orderId);
      reloadOrders();
    }
  });

  const updateItemMutation = useMutation({
    mutationFn: updateOrderItemForWorkspace,
    onSuccess: (result, variables) => {
      if (!result.ok) {
        if (result.error === "exchange-rate-unavailable" && result.errorDetails) {
          openRateDialog(result.errorDetails, () => updateItemMutation.mutate(variables));
          return;
        }
        setItemFormErrors({ submit: getErrorMsg(copy, result.error) });
        return;
      }
      closeItemDialog();
      addToast(copy.itemUpdatedToast);
      refreshDetail(variables.orderId);
      reloadOrders();
    }
  });

  const updateItemPriceMutation = useMutation({
    mutationFn: updateOrderItemForWorkspace,
    onSuccess: (result, variables) => {
      if (!result.ok) {
        if (result.error === "exchange-rate-unavailable" && result.errorDetails) {
          openRateDialog(result.errorDetails, () => updateItemPriceMutation.mutate(variables));
          return;
        }
        addToast(getErrorMsg(copy, result.error));
        return;
      }
      addToast(copy.itemUpdatedToast);
      refreshDetail(variables.orderId);
      reloadOrders();
    }
  });

  const removeItemMutation = useMutation({
    mutationFn: removeOrderItemForWorkspace,
    onSuccess: (result, variables) => {
      if (!result.ok) { addToast(getErrorMsg(copy, result.error)); return; }
      setItemPendingRemove(null);
      addToast(copy.itemRemovedToast);
      refreshDetail(variables.orderId);
      reloadOrders();
    }
  });

  const receiveItemsMutation = useMutation({
    mutationFn: receiveItemsForWorkspace,
    onSuccess: (result, variables) => {
      if (!result.ok) { setReceiveFormErrors({ submit: getErrorMsg(copy, result.error) }); return; }
      closeReceiveDialog();
      addToast(copy.receivedToast);
      refreshDetail(variables.orderId);
      reloadOrders();
    }
  });

  // --- URL sync & panel ---

  function openOrderDetails(orderId: string) {
    setSelectedOrderId(orderId);
    const url = new URL(window.location.href);
    url.searchParams.set("selectedOrderId", orderId);
    window.history.replaceState(null, "", url.toString());
  }

  function closeOrderDetails() {
    setSelectedOrderId(null);
    const url = new URL(window.location.href);
    url.searchParams.delete("selectedOrderId");
    window.history.replaceState(null, "", url.toString());
  }

  const {
    width: detailsPanelWidth,
    hasLoaded: hasLoadedDetailsPanelWidth,
    startResizing: startResizingDetailsPanel
  } = useDetailsPanelWidth(`oso:purchase-orders-details-panel-width:${workspaceSlug}`, 400);

  const selectedOrder = selectedOrderId
    ? (orders.find((o) => o.id === selectedOrderId) ?? null)
    : null;

  // --- Dialog helpers ---

  function openCreateOrderDialog() {
    setCreateOrderDialogOpen(true);
    window.requestAnimationFrame(() => openDialog(createOrderDialogRef.current));
  }

  function closeCreateOrderDialog() {
    closeDialog(createOrderDialogRef.current);
    setCreateOrderDialogOpen(false);
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
    setItemUnitPrice("");
    setItemLineTotal("");
    setItemQuantity("1");
    setItemTaxRate(orderDetail?.taxRate ?? selectedOrder?.taxRate ?? "");
    setItemCurrency(orderDetail?.currency ?? selectedOrder?.currency ?? "");
    setDialogFormKey((k) => k + 1);
    window.requestAnimationFrame(() => openDialog(itemDialogRef.current));
  }

  function openEditItemDialog(item: PurchaseOrderItem) {
    setEditingItem(item);
    setItemDialogMode("edit");
    setItemFormErrors({});
    setSelectedPartId(item.partId);
    setPartSearchQuery("");
    const qty = item.quantity ?? "1";
    const netPrice = item.unitPrice ?? "";
    const editTaxRate = item.taxRate ?? "";
    setItemQuantity(qty);
    setItemTaxRate(editTaxRate);
    setItemCurrency(item.currency ?? "");

    // In gross mode, show gross value in the input (net is stored, gross = net * (1 + rate/100))
    const currentMode = detail?.priceEntryMode ?? selectedOrder?.priceEntryMode ?? "net";
    let displayPrice = netPrice;
    if (currentMode === "gross" && netPrice) {
      const editEffectiveTaxRate =
        parseFloat(editTaxRate) ||
        parseFloat(detail?.taxRate ?? "") ||
        parseFloat(detail?.supplierDefaultTaxRate ?? "") ||
        parseFloat(workspaceDefaultTaxRate ?? "") ||
        0;
      const grossVal = parseFloat(netPrice) * (1 + editEffectiveTaxRate / 100);
      displayPrice = isNaN(grossVal) ? netPrice : roundDisplay(grossVal);
    }

    setItemUnitPrice(displayPrice);
    // Use stored line total to avoid rounding drift (e.g. 10/3 * 3 = 9.99).
    // roundDisplay normalises any legacy high-precision strings (e.g. "9.999999999984" → "10.00").
    if (currentMode === "gross") {
      const rawGross = item.lineGrossValue ? parseFloat(item.lineGrossValue) : NaN;
      setItemLineTotal(!isNaN(rawGross) ? roundDisplay(rawGross) : "");
    } else {
      const rawNet = item.lineNetValue ? parseFloat(item.lineNetValue) : NaN;
      setItemLineTotal(!isNaN(rawNet) ? roundDisplay(rawNet) : "");
    }
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
    setItemUnitPrice("");
    setItemLineTotal("");
    setItemQuantity("1");
  }

  function openReceiveDialog() {
    const detail = orderDetail as PurchaseOrderDetail | null | undefined;
    if (!detail) return;
    const rows = new Map<string, ReceiveRowState>();
    for (const item of detail.items) {
      const remaining = (parseFloat(item.quantity) - parseFloat(item.receivedQuantity)).toString();
      if (parseFloat(remaining) > 0) {
        const defaultLoc = item.partDefaultLocationId
          ? assignableLocations.find((l) => l.id === item.partDefaultLocationId)
          : undefined;
        rows.set(item.id, {
          quantity: remaining,
          locationId: defaultLoc?.id ?? ""
        });
      }
    }
    setReceiveRows(rows);
    setReceiveFormErrors({});
    setReceiveMissingLocationIds(new Set());
    setDialogFormKey((k) => k + 1);
    setReceiveDialogOpen(true);
    window.requestAnimationFrame(() => openDialog(receiveDialogRef.current));
  }

  function closeReceiveDialog() {
    closeDialog(receiveDialogRef.current);
    setReceiveDialogOpen(false);
    setReceiveFormErrors({});
    setReceiveMissingLocationIds(new Set());
  }

  // --- Form handlers ---

  function handleOrderSubmit(formData: FormData) {
    const supplierId = getString(formData, "supplierId");
    if (!supplierId) { setOrderFormErrors({ supplier: copy.nameRequired }); return; }

    if (editingOrder) {
      updateOrderMutation.mutate({
        workspaceSlug,
        orderId: editingOrder.id,
        supplierId,
        orderNumber: getString(formData, "orderNumber") || null,
        supplierOrderNumber: getString(formData, "supplierOrderNumber") || null,
        currency: getString(formData, "currency") || null,
        taxRate: getString(formData, "taxRate") || null,
        orderedAt: editingOrder.status === "ORDERED" ? (getString(formData, "orderedAt") || null) : undefined,
        notes: getString(formData, "notes") || null
      });
    }
  }

  function handleItemSubmit(formData: FormData) {
    const quantity = getString(formData, "quantity");
    const partId = selectedPartId ?? editingItem?.partId ?? null;

    if (!partId && itemDialogMode === "create") { setItemFormErrors({ part: copy.partRequired }); return; }
    if (!quantity) { setItemFormErrors({ quantity: copy.quantityRequired }); return; }

    // In gross mode the hidden unitPrice input already has net (back-calculated)
    const unitPrice = getString(formData, "unitPrice") || null;
    // lineNetTotal bypasses unitPrice * quantity computation to prevent rounding drift
    const lineNetTotal = getString(formData, "lineNetTotal") || null;

    if (itemDialogMode === "create" && selectedOrderId && partId) {
      addItemMutation.mutate({
        workspaceSlug,
        orderId: selectedOrderId,
        partId,
        quantity,
        unitPrice,
        lineNetTotal,
        currency: getString(formData, "currency") || null,
        taxRate: getString(formData, "taxRate") || null,
        notes: getString(formData, "notes") || null
      });
    } else if (editingItem && selectedOrderId) {
      updateItemMutation.mutate({
        workspaceSlug,
        orderId: selectedOrderId,
        itemId: editingItem.id,
        quantity,
        unitPrice,
        lineNetTotal,
        currency: getString(formData, "currency") || null,
        taxRate: getString(formData, "taxRate") || null,
        notes: getString(formData, "notes") || null
      });
    }
  }

  function handleReceiveSubmit() {
    if (!selectedOrderId) return;
    const itemsToReceive: Array<{ itemId: string; quantity: string; locationId: string }> = [];

    const missingLocations = new Set<string>();
    for (const [itemId, row] of receiveRows) {
      if (!row.quantity || parseFloat(row.quantity) <= 0) continue;
      if (!row.locationId) { missingLocations.add(itemId); continue; }
      itemsToReceive.push({ itemId, quantity: row.quantity, locationId: row.locationId });
    }

    if (missingLocations.size > 0) {
      setReceiveMissingLocationIds(missingLocations);
      setReceiveFormErrors({ submit: copy.locationRequired });
      return;
    }

    setReceiveMissingLocationIds(new Set());
    if (itemsToReceive.length === 0) { setReceiveFormErrors({ submit: copy.quantityRequired }); return; }

    receiveItemsMutation.mutate({ workspaceSlug, orderId: selectedOrderId, items: itemsToReceive });
  }

  function addToast(message: string) {
    setToastMessages((msgs) => [...msgs, { id: getNextToastId(nextToastIdRef), message }]);
  }

  // --- Derived values ---

  const detail = orderDetail as PurchaseOrderDetail | null | undefined;
  const detailItems = useMemo(() => detail?.items ?? [], [detail]);
  const existingParts = useMemo(
    () => new Map(detailItems.map((item) => [item.partId, item.quantity])),
    [detailItems]
  );
  const unreceived = detailItems.filter(
    (item) => parseFloat(item.receivedQuantity) < parseFloat(item.quantity)
  );

  const isGrossMode = (detail?.priceEntryMode ?? selectedOrder?.priceEntryMode ?? "net") === "gross";
  const itemEffectiveTaxRate =
    parseFloat(itemTaxRate) ||
    parseFloat(detail?.taxRate ?? "") ||
    parseFloat(detail?.supplierDefaultTaxRate ?? "") ||
    parseFloat(workspaceDefaultTaxRate ?? "") ||
    0;
  const itemPriceFactor = 1 + itemEffectiveTaxRate / 100;
  const _activeUnitNum = parseFloat(itemUnitPrice);
  const _activeLineNum = parseFloat(itemLineTotal);
  const itemComputedOppositeUnit =
    !isNaN(_activeUnitNum) && _activeUnitNum > 0
      ? roundDisplay(isGrossMode ? _activeUnitNum / itemPriceFactor : _activeUnitNum * itemPriceFactor)
      : "";
  const itemComputedOppositeLine =
    !isNaN(_activeLineNum) && _activeLineNum > 0
      ? roundDisplay(isGrossMode ? _activeLineNum / itemPriceFactor : _activeLineNum * itemPriceFactor)
      : "";

  const isMutating =
    updateOrderMutation.isPending ||
    addItemMutation.isPending ||
    updateItemMutation.isPending ||
    receiveItemsMutation.isPending ||
    markOrderedMutation.isPending ||
    revertToDraftMutation.isPending ||
    saveManualRateMutation.isPending;

  function statusLabel(status: "DRAFT" | "ORDERED" | "RECEIVED") {
    if (status === "DRAFT") return copy.statusDraft;
    if (status === "ORDERED") return copy.statusOrdered;
    return copy.statusReceived;
  }

  function statusBadgeClass(status: "DRAFT" | "ORDERED" | "RECEIVED") {
    if (status === "DRAFT") return "bg-[var(--color-bg-muted)] text-[var(--color-text-secondary)]";
    if (status === "ORDERED") return "bg-amber-100 text-amber-800";
    return "bg-[var(--color-success-soft)] text-[var(--color-success)]";
  }

  // --- TanStack Table ---

  const columns = useMemo(
    () => [
      columnHelper.accessor("supplierName", {
        header: copy.supplier,
        size: 200,
        minSize: 100,
        cell: ({ getValue }) => (
          <span className="font-medium text-[var(--color-text-primary)]">{getValue()}</span>
        )
      }),
      columnHelper.accessor("orderNumber", {
        header: copy.orderNumber,
        size: 160,
        minSize: 80,
        cell: ({ getValue }) => {
          const v = getValue();
          return v
            ? <span className="text-[var(--color-text-secondary)]">{v}</span>
            : <EmptyCell />;
        }
      }),
      columnHelper.accessor("status", {
        header: copy.status,
        size: 120,
        minSize: 80,
        cell: ({ getValue }) => {
          const s = getValue();
          return (
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusBadgeClass(s)}`}>
              {statusLabel(s)}
            </span>
          );
        }
      }),
      columnHelper.accessor("itemCount", {
        header: () => <span className="block text-right">{copy.items}</span>,
        size: 100,
        minSize: 64,
        cell: ({ getValue }) => (
          <span className="block text-right text-[var(--color-text-secondary)]">{getValue()}</span>
        )
      }),
      columnHelper.accessor("supplierOrderNumber", {
        id: "supplierOrderNumber",
        header: copy.supplierOrderNumber,
        size: 160,
        minSize: 80,
        cell: ({ getValue }) => {
          const v = getValue();
          return v
            ? <span className="text-[var(--color-text-secondary)]">{v}</span>
            : <EmptyCell />;
        }
      }),
      columnHelper.accessor("createdAt", {
        id: "createdAt",
        header: copy.created,
        size: 160,
        minSize: 100,
        cell: ({ getValue }) => (
          <span className="text-[var(--color-text-secondary)]">{new Date(getValue()).toLocaleDateString()}</span>
        )
      }),
      columnHelper.accessor("createdByName", {
        id: "createdBy",
        header: copy.createdBy,
        size: 160,
        minSize: 100,
        cell: ({ getValue }) => {
          const v = getValue();
          return v
            ? <span className="text-[var(--color-text-secondary)]">{v}</span>
            : <EmptyCell />;
        }
      }),
      columnHelper.accessor("orderedAt", {
        id: "orderedAt",
        header: copy.orderedAt,
        size: 160,
        minSize: 100,
        cell: ({ getValue }) => {
          const v = getValue();
          return v
            ? <span className="text-[var(--color-text-secondary)]">{new Date(v).toLocaleDateString()}</span>
            : <EmptyCell />;
        }
      }),
      columnHelper.accessor("currency", {
        id: "currency",
        header: copy.currency,
        size: 90,
        minSize: 64,
        cell: ({ getValue }) => {
          const v = getValue();
          return v
            ? <span className="text-[var(--color-text-secondary)]">{v}</span>
            : <EmptyCell />;
        }
      }),
      columnHelper.accessor("totalNetValue", {
        id: "totalNetValue",
        header: () => <span className="block text-right">{copy.totalNetValue}</span>,
        size: 150,
        minSize: 100,
        cell: ({ getValue, row }) => {
          const v = getValue();
          const cur = row.original.currency;
          return v
            ? <span className="block text-right font-mono text-[var(--color-text-secondary)]">{v}{cur ? ` ${cur}` : ""}</span>
            : <span className="block text-right"><EmptyCell /></span>;
        }
      }),
      columnHelper.accessor("totalGrossValue", {
        id: "totalGrossValue",
        header: () => <span className="block text-right">{copy.totalGrossValue}</span>,
        size: 150,
        minSize: 100,
        cell: ({ getValue, row }) => {
          const v = getValue();
          const cur = row.original.currency;
          return v
            ? <span className="block text-right font-mono text-[var(--color-text-secondary)]">{v}{cur ? ` ${cur}` : ""}</span>
            : <span className="block text-right"><EmptyCell /></span>;
        }
      }),
      columnHelper.accessor("totalNetValuePrimary", {
        id: "totalNetValuePrimary",
        header: () => <span className="block text-right">{copy.totalNetValuePrimary.replace("{currency}", primaryCurrency)}</span>,
        size: 170,
        minSize: 100,
        cell: ({ getValue }) => {
          const v = getValue();
          return v
            ? <span className="block text-right font-mono text-[var(--color-text-secondary)]">{v} {primaryCurrency}</span>
            : <span className="block text-right"><EmptyCell /></span>;
        }
      }),
      columnHelper.accessor("totalGrossValuePrimary", {
        id: "totalGrossValuePrimary",
        header: () => <span className="block text-right">{copy.totalGrossValuePrimary.replace("{currency}", primaryCurrency)}</span>,
        size: 170,
        minSize: 100,
        cell: ({ getValue }) => {
          const v = getValue();
          return v
            ? <span className="block text-right font-mono text-[var(--color-text-secondary)]">{v} {primaryCurrency}</span>
            : <span className="block text-right"><EmptyCell /></span>;
        }
      }),
      columnHelper.display({
        id: "actions",
        header: "",
        size: 104,
        minSize: 104,
        maxSize: 104,
        enableResizing: false,
        cell: ({ row }) => (
          <div className="flex justify-end gap-2">
            <button
              aria-label={copy.edit}
              className="min-h-8 rounded-md border border-[var(--color-border-strong)] bg-[var(--color-bg-elevated)] px-2.5 py-1 text-sm font-medium text-[var(--color-text-secondary)] transition hover:border-[var(--color-border-hover)] hover:bg-[var(--color-bg-subtle)] focus:outline-none focus:ring-2 focus:ring-[var(--color-ring-strong)] focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-[var(--color-bg-subtle)] disabled:text-[var(--color-text-placeholder)]"
              disabled={!canWrite || row.original.status === "RECEIVED"}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                openEditOrderDialog(row.original);
              }}
            >
              <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                <path d="M13.9 3.3a1.5 1.5 0 0 1 2.1 0l.7.7a1.5 1.5 0 0 1 0 2.1l-8.4 8.4-3.3.8.8-3.3 8.4-8.4Z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
              </svg>
            </button>
            <button
              aria-label={copy.delete}
              className="min-h-8 rounded-md border border-[var(--color-error-border)] bg-[var(--color-bg-elevated)] px-2.5 py-1 text-sm font-medium text-[var(--color-error)] transition hover:bg-[var(--color-error-soft)] focus:outline-none focus:ring-2 focus:ring-[var(--color-error-border)] focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-[var(--color-bg-subtle)] disabled:text-[var(--color-text-placeholder)]"
              disabled={!canWrite || row.original.status === "RECEIVED" || deleteOrderMutation.isPending}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setOrderPendingDelete(row.original);
              }}
            >
              <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                <path d="M5.5 6h9m-7.5 0V4.75A1.75 1.75 0 0 1 8.75 3h2.5A1.75 1.75 0 0 1 13 4.75V6m-6.5 0 .6 9.1A1.75 1.75 0 0 0 8.84 16.75h2.32a1.75 1.75 0 0 0 1.74-1.65L13.5 6M8.75 8.5v5m2.5-5v5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
              </svg>
            </button>
          </div>
        )
      })
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [canWrite, copy, deleteOrderMutation.isPending]
  );

  const { draggedColumnId, onDragEnd, onStartDrag, onDropOnto } = useColumnDragReorder(setColumnOrder);

  const tableColumnOrder = useMemo(() => persistedColumnOrder, [persistedColumnOrder]);

  // eslint-disable-next-line react-hooks/incompatible-library
  const ordersTable = useReactTable({
    data: orders,
    columns,
    state: {
      columnVisibility,
      columnOrder: tableColumnOrder,
      sorting,
      columnSizing
    },
    onColumnVisibilityChange: setColumnVisibility,
    onColumnOrderChange: setColumnOrder,
    onSortingChange: setSorting,
    onColumnSizingChange: setColumnSizing,
    columnResizeMode: "onChange",
    enableColumnResizing: true,
    manualSorting: true,
    getCoreRowModel: getCoreRowModel()
  });

  return (
    <>
      <div
        className={`flex min-h-0 flex-1 gap-4 ${containerClassName}`}
      >
        {/* Main list */}
        <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elevated)] shadow-sm">
          {/* Toolbar */}
          <ListPageToolbar
            columnVisibility={columnVisibility}
            configurableColumns={configurableColumns}
            configureListLabel={copy.configureList}
            filteredCount={ordersQuery.data?.pages[0]?.filteredCount}
            formatCount={(visible, total) =>
              copy.orderCountSummary
                .replace("{visible}", String(visible))
                .replace("{total}", String(total))
            }
            totalCount={ordersQuery.data?.pages[0]?.totalCount}
            visibleColumnsLabel={copy.visibleColumns}
            setColumnVisible={setColumnVisible}
            primaryAction={
              <button
                className="inline-flex min-h-9 items-center rounded-md bg-[var(--color-accent)] px-4 text-sm font-semibold text-white transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={!canWrite}
                type="button"
                onClick={openCreateOrderDialog}
              >
                {copy.newOrder}
              </button>
            }
          />
          {pinnedOrderId ? (
            <PinnedFilterBanner
              label={copy.pinnedFilterLabel}
              clearLabel={copy.clearPinnedFilter}
              onClear={() => {
                setPinnedOrderId(null);
                setSelectedOrderId(null);
                const url = new URL(window.location.href);
                url.searchParams.delete("selectedOrderId");
                url.searchParams.delete("pinnedId");
                window.history.replaceState(null, "", url.toString());
              }}
            />
          ) : null}

          <InfiniteListViewport
            emptyState={
              <p className="px-4 py-10 text-sm text-[var(--color-text-muted)]">{copy.noOrders}</p>
            }
            errorState={
              <p className="px-4 py-10 text-sm text-[var(--color-error)]">{copy.loadError}</p>
            }
            hasNextPage={ordersQuery.hasNextPage}
            isEmpty={orders.length === 0}
            isError={ordersQuery.isError}
            isFetchingNextPage={ordersQuery.isFetchingNextPage}
            isInitialLoading={!isOrderConfigLoaded || ordersQuery.isLoading || ordersQuery.isPlaceholderData}
            loadMore={() => void ordersQuery.fetchNextPage()}
            loadingLabel={copy.loadingOrders}
            loadingMoreLabel={copy.loadingMoreOrders}
          >
            <table
              className="table-fixed border-separate border-spacing-0 text-left text-sm"
              style={{ width: ordersTable.getTotalSize() }}
            >
              <colgroup>
                {ordersTable.getVisibleLeafColumns().map((col) => (
                  <col key={col.id} style={{ width: col.getSize() }} />
                ))}
              </colgroup>
              <thead className="sticky top-0 z-10 bg-[var(--color-bg-subtle)]">
                {ordersTable.getHeaderGroups().map((headerGroup) => (
                  <tr key={headerGroup.id}>
                    {headerGroup.headers.map((header) => (
                      <ListTableHeaderCell
                        key={header.id}
                        columnDefs={orderColumns}
                        draggedColumnId={draggedColumnId}
                        header={header}
                        isResizingColumn={isResizingColumn}
                        setColumnSorting={setColumnSorting}
                        setColumnWidth={setColumnWidth}
                        setIsResizingColumn={setIsResizingColumn}
                        onDragEnd={onDragEnd}
                        onDropOnto={onDropOnto}
                        onStartDrag={onStartDrag}
                      />
                    ))}
                  </tr>
                ))}
              </thead>
              <tbody className="bg-[var(--color-bg-elevated)]">
                {ordersTable.getRowModel().rows.map((row) => (
                  <tr
                    key={row.id}
                    className={`border-b border-[var(--color-border)] ${
                      row.original.id === selectedOrderId
                        ? "bg-[var(--color-bg-muted)]"
                        : row.original.id === hoveredOrderId
                          ? "bg-[var(--color-bg-subtle)]"
                          : ""
                    }`}
                    role="button"
                    tabIndex={0}
                    onClick={() => openOrderDetails(row.original.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        openOrderDetails(row.original.id);
                      }
                    }}
                    onMouseEnter={() => setHoveredOrderId(row.original.id)}
                    onMouseLeave={() =>
                      setHoveredOrderId((cur) =>
                        cur === row.original.id ? null : cur
                      )
                    }
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td
                        key={cell.id}
                        className={`overflow-hidden border-b border-[var(--color-border)] px-2 py-2 text-[var(--color-text-secondary)] ${
                          cell.column.id === "actions"
                            ? row.original.id === selectedOrderId
                              ? "sticky right-0 z-10 bg-[var(--color-bg-muted)] px-1 py-1.5"
                              : row.original.id === hoveredOrderId
                                ? "sticky right-0 z-10 bg-[var(--color-bg-subtle)] px-1 py-1.5"
                                : "sticky right-0 z-10 bg-[var(--color-bg-elevated)] px-1 py-1.5"
                            : ""
                        }`}
                        style={{ width: cell.column.getSize() }}
                      >
                        <div className="overflow-hidden text-ellipsis">
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </div>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </InfiniteListViewport>
        </section>

        {/* Detail panel */}
        {(() => {
          const panelOrder = detail ?? selectedOrder;
          if (!panelOrder || !hasLoadedDetailsPanelWidth) return null;
          return (
        <DetailPanel
            closeLabel={copy.close}
            subtitle={panelOrder.orderNumber ?? undefined}
            title={panelOrder.supplierName}
            width={detailsPanelWidth}
            onClose={closeOrderDetails}
            onStartResize={startResizingDetailsPanel}
          >
            {/* Status + actions */}
            <div className="flex flex-wrap items-center gap-2">
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusBadgeClass(panelOrder.status)}`}>
                {statusLabel(panelOrder.status)}
              </span>
              {detail?.status === "DRAFT" ? (
                <button
                  className="min-h-8 rounded-md border border-[var(--color-border-strong)] bg-[var(--color-bg-elevated)] px-3 text-sm font-medium text-[var(--color-text-secondary)] transition hover:border-[var(--color-border-hover)] hover:bg-[var(--color-bg-subtle)] disabled:cursor-not-allowed disabled:opacity-60"
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
              {detail?.status === "ORDERED" && unreceived.length > 0 ? (
                <button
                  className="min-h-8 rounded-md border border-[var(--color-border-strong)] bg-[var(--color-bg-elevated)] px-3 text-sm font-medium text-[var(--color-text-secondary)] transition hover:border-[var(--color-border-hover)] hover:bg-[var(--color-bg-subtle)] disabled:cursor-not-allowed disabled:opacity-60"
                  type="button"
                  disabled={!canWrite || assignableLocations.length === 0}
                  onClick={openReceiveDialog}
                >
                  {copy.receiveItems}
                </button>
              ) : null}
              {detail?.status === "ORDERED" ? (
                <button
                  className="min-h-8 rounded-md border border-[var(--color-border-strong)] bg-[var(--color-bg-elevated)] px-3 text-sm font-medium text-[var(--color-text-secondary)] transition hover:border-[var(--color-border-hover)] hover:bg-[var(--color-bg-subtle)] disabled:cursor-not-allowed disabled:opacity-60"
                  type="button"
                  disabled={!canWrite}
                  onClick={() => {
                    setRevertToDraftPending(true);
                    window.requestAnimationFrame(() => openDialog(revertToDraftDialogRef.current));
                  }}
                >
                  {copy.revertToDraft}
                </button>
              ) : null}
            </div>

            {/* Items section */}
            <section className="grid gap-2">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">{copy.items}</h3>
                {detail?.status !== "RECEIVED" ? (
                  <div className="flex items-center gap-2">
                    <button
                      className="inline-flex min-h-8 items-center rounded-md border border-[var(--color-border-strong)] bg-[var(--color-bg-elevated)] px-3 text-sm font-medium text-[var(--color-text-secondary)] transition hover:border-[var(--color-border-hover)] hover:bg-[var(--color-bg-subtle)] disabled:cursor-not-allowed disabled:opacity-60"
                      type="button"
                      disabled={!canWrite}
                      onClick={() => setMultiAddPOOpen(true)}
                    >
                      {copy.multiAdd.pickerTitle}
                    </button>
                    <button
                      className="inline-flex min-h-8 items-center rounded-md bg-[var(--color-accent)] px-3 text-sm font-semibold text-white transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
                      type="button"
                      disabled={!canWrite}
                      onClick={openCreateItemDialog}
                    >
                      {copy.addItem}
                    </button>
                  </div>
                ) : null}
              </div>

              {detailItems.length === 0 ? (
                <p className="rounded-md border border-[var(--color-border)] bg-[var(--color-bg-subtle)] px-3 py-2 text-sm text-[var(--color-text-secondary)]">
                  {copy.noItems}
                </p>
              ) : (
                <div className="overflow-x-auto rounded-md border border-[var(--color-border)]">
                  <table className="w-full min-w-max border-collapse text-left text-sm">
                    <thead>
                      <tr className="border-b border-[var(--color-border)] bg-[var(--color-bg-subtle)]">
                        <th className="px-3 py-2 font-semibold text-[var(--color-text-secondary)]">{copy.part}</th>
                        <th className="px-3 py-2 text-right font-semibold text-[var(--color-text-secondary)] whitespace-nowrap">
                          {isGrossMode ? copy.grossUnitPrice : copy.unitPrice}
                        </th>
                        <th className="px-3 py-2 text-right font-semibold text-[var(--color-text-secondary)] whitespace-nowrap">{copy.taxRateShort}</th>
                        <th className="px-3 py-2 text-right font-semibold text-[var(--color-text-secondary)] whitespace-nowrap">
                          {isGrossMode ? copy.grossLineTotal : copy.lineTotal}
                        </th>
                        <th className="px-3 py-2 text-right font-semibold text-[var(--color-text-secondary)] whitespace-nowrap">{copy.quantity}</th>
                        <th className="px-3 py-2 text-right font-semibold text-[var(--color-text-secondary)] whitespace-nowrap">{copy.received}</th>
                        {detail?.status !== "RECEIVED" ? (
                          <th className="px-3 py-2" />
                        ) : null}
                      </tr>
                    </thead>
                    <tbody>
                      {detailItems.map((item) => {
                        const isFullyReceived = parseFloat(item.receivedQuantity) >= parseFloat(item.quantity);
                        return (
                          <tr key={item.id} className={`group border-b border-[var(--color-border)] last:border-b-0 ${isFullyReceived ? "opacity-60" : ""}`}>
                            <td className="px-3 py-2">
                              <div className="font-medium text-[var(--color-text-primary)]">
                                <PartLink partId={item.partId} name={item.partCatalogNumber} />
                              </div>
                              <div className="text-xs text-[var(--color-text-muted)]">{item.manufacturerName}</div>
                            </td>
                            <InlinePriceCell
                              item={item}
                              isGrossMode={isGrossMode}
                              orderTaxRate={detail?.taxRate}
                              orderSupplierDefaultTaxRate={detail?.supplierDefaultTaxRate}
                              workspaceDefaultTaxRate={workspaceDefaultTaxRate}
                              orderId={detail?.id ?? ""}
                              workspaceSlug={workspaceSlug}
                              canWrite={canWrite}
                              isReceived={detail?.status === "RECEIVED"}
                              isPending={updateItemPriceMutation.isPending}
                              onSave={updateItemPriceMutation.mutate}
                              noAttributeLabel={copy.noAttribute}
                            />
                            <td className="px-3 py-2 text-right text-[var(--color-text-muted)] whitespace-nowrap">
                              {(() => {
                                const isExplicit = item.taxRate != null && item.taxRate !== "";
                                const rate = isExplicit
                                  ? item.taxRate
                                  : getEffectiveTaxRate(
                                      item.taxRate,
                                      detail?.taxRate,
                                      detail?.supplierDefaultTaxRate,
                                      workspaceDefaultTaxRate
                                    );
                                return `${rate}%`;
                              })()}
                            </td>
                            <td className="px-3 py-2 text-right font-mono text-[var(--color-text-secondary)] whitespace-nowrap">
                              {(() => {
                                const val = isGrossMode ? item.lineGrossValue : item.lineNetValue;
                                if (val == null) return copy.noAttribute;
                                return `${val}${item.currency ? ` ${item.currency}` : ""}`;
                              })()}
                            </td>
                            <td className="px-3 py-2 text-right text-[var(--color-text-secondary)] whitespace-nowrap">{item.quantity}</td>
                            <td className="px-3 py-2 text-right text-[var(--color-text-secondary)] whitespace-nowrap">
                              {item.receivedQuantity}
                              {isFullyReceived ? (
                                <span className="ml-1 text-xs text-[var(--color-success)]">✓</span>
                              ) : null}
                            </td>
                            {detail?.status !== "RECEIVED" ? (
                              <td className="px-3 py-2">
                                <div className="flex justify-end gap-1">
                                  <button
                                    aria-label={copy.editItem}
                                    className="min-h-7 rounded border border-[var(--color-border-strong)] bg-[var(--color-bg-elevated)] px-2 py-0.5 text-xs font-medium text-[var(--color-text-secondary)] transition hover:border-[var(--color-border-hover)] hover:bg-[var(--color-bg-subtle)] disabled:cursor-not-allowed disabled:opacity-60"
                                    disabled={!canWrite}
                                    type="button"
                                    onClick={() => openEditItemDialog(item)}
                                  >
                                    <svg aria-hidden="true" className="h-3.5 w-3.5" fill="none" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                                      <path d="M13.9 3.3a1.5 1.5 0 0 1 2.1 0l.7.7a1.5 1.5 0 0 1 0 2.1l-8.4 8.4-3.3.8.8-3.3 8.4-8.4Z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
                                    </svg>
                                  </button>
                                  <button
                                    aria-label={copy.removeItem}
                                    className="min-h-7 rounded border border-[var(--color-error-border)] bg-[var(--color-bg-elevated)] px-2 py-0.5 text-xs font-medium text-[var(--color-error)] transition hover:bg-[var(--color-error-soft)] disabled:cursor-not-allowed disabled:opacity-60"
                                    disabled={!canWrite || removeItemMutation.isPending}
                                    type="button"
                                    onClick={() => setItemPendingRemove(item)}
                                  >
                                    <svg aria-hidden="true" className="h-3.5 w-3.5" fill="none" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                                      <path d="M5.5 6h9m-7.5 0V4.75A1.75 1.75 0 0 1 8.75 3h2.5A1.75 1.75 0 0 1 13 4.75V6m-6.5 0 .6 9.1A1.75 1.75 0 0 0 8.84 16.75h2.32a1.75 1.75 0 0 0 1.74-1.65L13.5 6M8.75 8.5v5m2.5-5v5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
                                    </svg>
                                  </button>
                                </div>
                              </td>
                            ) : null}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {(() => {
                if (!detail) return null;
                const { totalNetValue, totalGrossValue, totalNetValuePrimary, totalGrossValuePrimary } = detail;
                if (!totalNetValue && !totalGrossValue) return null;
                const showPrimary =
                  totalNetValuePrimary != null &&
                  detail.currency != null &&
                  detail.currency !== primaryCurrency;
                return (
                  <div className="mt-3 rounded-md border border-[var(--color-border)] bg-[var(--color-bg-subtle)] px-3 py-2.5 grid gap-1.5 text-sm">
                    <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">{copy.orderTotals}</p>
                    <div className="flex justify-between gap-4">
                      <span className="text-[var(--color-text-secondary)]">{copy.totalNetValue}</span>
                      <div className="text-right">
                        <span className="font-mono text-[var(--color-text-primary)]">{totalNetValue}{detail.currency ? ` ${detail.currency}` : ""}</span>
                        {showPrimary ? <div className="font-mono text-xs text-[var(--color-text-placeholder)]">≈{totalNetValuePrimary} {primaryCurrency}</div> : null}
                      </div>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span className="text-[var(--color-text-secondary)]">{copy.totalGrossValue}</span>
                      <div className="text-right">
                        <span className="font-mono text-[var(--color-text-primary)]">{totalGrossValue}{detail.currency ? ` ${detail.currency}` : ""}</span>
                        {showPrimary ? <div className="font-mono text-xs text-[var(--color-text-placeholder)]">≈{totalGrossValuePrimary} {primaryCurrency}</div> : null}
                      </div>
                    </div>
                  </div>
                );
              })()}
            </section>
          </DetailPanel>
          );
        })()}
      </div>

      {/* Edit order dialog */}
      <DialogShell
        ref={orderDialogRef}
        closeLabel={copy.close}
        title={copy.editOrderTitle}
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
                <SupplierPickerCombobox
                  workspaceSlug={workspaceSlug}
                  inputId="order-supplier"
                  placeholder={copy.chooseSupplier}
                  noItemsLabel={copy.noSuppliers}
                  loadingLabel={copy.loadingSuppliers}
                  initialValue={editingOrder ? { id: editingOrder.supplierId, name: editingOrder.supplierName } : null}
                />
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-medium text-[var(--color-text-secondary)]" htmlFor="order-number">
                  {copy.orderNumber}
                </label>
                <input
                  id="order-number"
                  name="orderNumber"
                  placeholder={copy.orderNumberPlaceholder}
                  defaultValue={editingOrder?.orderNumber ?? ""}
                  className="min-h-10 rounded-md border border-[var(--color-border-strong)] bg-[var(--color-bg-elevated)] px-3 py-1.5 text-sm text-[var(--color-text-primary)] outline-none transition hover:border-[var(--color-border-hover)] focus:border-[var(--color-border-hover)] focus:ring-2 focus:ring-[var(--color-ring)]"
                />
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-medium text-[var(--color-text-secondary)]" htmlFor="order-supplier-order-number">
                  {copy.supplierOrderNumber}
                </label>
                <input
                  id="order-supplier-order-number"
                  name="supplierOrderNumber"
                  placeholder={copy.supplierOrderNumberPlaceholder}
                  defaultValue={editingOrder?.supplierOrderNumber ?? ""}
                  className="min-h-10 rounded-md border border-[var(--color-border-strong)] bg-[var(--color-bg-elevated)] px-3 py-1.5 text-sm text-[var(--color-text-primary)] outline-none transition hover:border-[var(--color-border-hover)] focus:border-[var(--color-border-hover)] focus:ring-2 focus:ring-[var(--color-ring)]"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-2">
                  <label className="text-sm font-medium text-[var(--color-text-secondary)]">
                    {copy.currency}
                  </label>
                  <input type="hidden" name="currency" value={editingOrder?.currency ?? ""} />
                  <div className="min-h-10 rounded-md border border-[var(--color-border)] bg-[var(--color-bg-subtle)] px-3 py-1.5 text-sm text-[var(--color-text-muted)] flex items-center">
                    {editingOrder?.currency || "—"}
                  </div>
                </div>
                <div className="grid gap-2">
                  <label className="text-sm font-medium text-[var(--color-text-secondary)]" htmlFor="order-tax-rate">
                    {copy.taxRate}
                  </label>
                  <input
                    id="order-tax-rate"
                    name="taxRate"
                    type="text"
                    inputMode="decimal"
                    placeholder={copy.taxRatePlaceholder}
                    defaultValue={editingOrder?.taxRate ?? ""}
                    className="min-h-10 rounded-md border border-[var(--color-border-strong)] bg-[var(--color-bg-elevated)] px-3 py-1.5 text-sm text-[var(--color-text-primary)] outline-none transition hover:border-[var(--color-border-hover)] focus:border-[var(--color-border-hover)] focus:ring-2 focus:ring-[var(--color-ring)]"
                  />
                </div>
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-medium text-[var(--color-text-secondary)]">
                  {copy.priceEntryMode}
                </label>
                <div className="min-h-10 rounded-md border border-[var(--color-border)] bg-[var(--color-bg-subtle)] px-3 py-1.5 text-sm text-[var(--color-text-muted)] flex items-center capitalize">
                  {editingOrder?.priceEntryMode === "gross" ? copy.priceEntryModeGross : copy.priceEntryModeNet}
                </div>
              </div>
              {editingOrder?.status === "ORDERED" ? (
                <div className="grid gap-2">
                  <label className="text-sm font-medium text-[var(--color-text-secondary)]" htmlFor="order-ordered-at">
                    {copy.orderedAt}
                  </label>
                  <input
                    type="datetime-local"
                    id="order-ordered-at"
                    name="orderedAt"
                    defaultValue={editingOrder.orderedAt ? new Date(editingOrder.orderedAt).toISOString().slice(0, 16) : ""}
                    className="min-h-10 rounded-md border border-[var(--color-border-strong)] bg-[var(--color-bg-elevated)] px-3 py-1.5 text-sm text-[var(--color-text-primary)] outline-none transition hover:border-[var(--color-border-hover)] focus:border-[var(--color-border-hover)] focus:ring-2 focus:ring-[var(--color-ring)]"
                  />
                </div>
              ) : null}
              <div className="grid gap-2">
                <label className="text-sm font-medium text-[var(--color-text-secondary)]" htmlFor="order-notes">
                  {copy.notes}
                </label>
                <textarea
                  id="order-notes"
                  name="notes"
                  rows={3}
                  placeholder={copy.notesPlaceholder}
                  defaultValue={editingOrder?.notes ?? ""}
                  className="rounded-md border border-[var(--color-border-strong)] bg-[var(--color-bg-elevated)] px-3 py-1.5 text-sm text-[var(--color-text-primary)] outline-none transition hover:border-[var(--color-border-hover)] focus:border-[var(--color-border-hover)] focus:ring-2 focus:ring-[var(--color-ring)] resize-none"
                />
              </div>
            </DialogBody>
            <DialogActions
              actionLabel={copy.saveChanges}
              disabled={isMutating}
              error={orderFormErrors.submit}
            />
          </form>
        ) : null}
      </DialogShell>

      {/* Create order dialog (shared component) */}
      <CreatePurchaseOrderDialog
        dialogRef={createOrderDialogRef}
        isOpen={createOrderDialogOpen}
        workspaceSlug={workspaceSlug}
        primaryCurrency={primaryCurrency}
        workspaceDefaultPriceEntryMode={workspaceDefaultPriceEntryMode}
        workspaceDefaultTaxRate={workspaceDefaultTaxRate}
        copy={{
          title: copy.newOrderTitle,
          supplier: copy.supplier,
          chooseSupplier: copy.chooseSupplier,
          noSuppliers: copy.noSuppliers,
          loadingSuppliers: copy.loadingSuppliers,
          orderNumber: copy.orderNumber,
          orderNumberPlaceholder: copy.orderNumberPlaceholder,
          currency: copy.currency,
          chooseCurrency: copy.chooseCurrency,
          taxRate: copy.taxRate,
          taxRatePlaceholder: copy.taxRatePlaceholder,
          taxRateHelp: copy.taxRateHelp,
          priceEntryMode: copy.priceEntryMode,
          priceEntryModeNet: copy.priceEntryModeNet,
          priceEntryModeGross: copy.priceEntryModeGross,
          notes: copy.notes,
          notesPlaceholder: copy.notesPlaceholder,
          createOrder: copy.createOrder,
          cancel: copy.cancel,
          close: copy.close,
          supplierRequired: copy.nameRequired,
          permissionDenied: copy.permissionDenied,
          databaseUnavailable: copy.databaseUnavailable,
          invalidInput: copy.invalidInput,
        }}
        onClose={closeCreateOrderDialog}
        onSuccess={(orderId) => {
          closeCreateOrderDialog();
          reloadOrders();
          openOrderDetails(orderId);
          addToast(copy.createdToast);
        }}
      />

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
                  <PartPickerCombobox
                    workspaceSlug={workspaceSlug}
                    inputValue={partSearchQuery}
                    selectedPartId={selectedPartId}
                    placeholder={copy.searchPartsPlaceholder}
                    loadingLabel={copy.loadingParts}
                    noMatchesLabel={copy.noMatchingParts}
                    onInputChange={(value) => { setPartSearchQuery(value); setSelectedPartId(null); }}
                    onSelect={(part: PartPickerOption) => { setSelectedPartId(part.id); setPartSearchQuery(`${part.catalogNumber} — ${part.manufacturerName}`); }}
                  />
                </div>
              ) : (
                <div className="grid gap-1">
                  <p className="text-sm font-medium text-[var(--color-text-secondary)]">{copy.part}</p>
                  <p className="text-sm text-[var(--color-text-primary)]">{editingItem?.partCatalogNumber} — {editingItem?.manufacturerName}</p>
                </div>
              )}

              <div className="grid gap-2">
                <LabelWithError error={itemFormErrors.quantity} htmlFor="po-item-quantity">{copy.quantity}</LabelWithError>
                <input
                  id="po-item-quantity"
                  name="quantity"
                  type="text"
                  inputMode="decimal"
                  value={itemQuantity}
                  onChange={(e) => {
                    const qty = e.target.value;
                    setItemQuantity(qty);
                    const q = parseFloat(qty);
                    const p = parseFloat(itemUnitPrice);
                    if (!isNaN(q) && q > 0 && !isNaN(p) && p >= 0) {
                      setItemLineTotal(roundDisplay(p * q));
                    } else {
                      setItemLineTotal("");
                    }
                  }}
                  placeholder="1"
                  className={getFieldInputClassName(
                    "min-h-10 rounded-md border border-[var(--color-border-strong)] bg-[var(--color-bg-elevated)] px-3 py-1.5 text-sm text-[var(--color-text-primary)] outline-none transition hover:border-[var(--color-border-hover)] focus:border-[var(--color-border-hover)] focus:ring-2 focus:ring-[var(--color-ring)]",
                    Boolean(itemFormErrors.quantity)
                  )}
                />
              </div>

              {/* Hidden unitPrice submits net regardless of entry mode */}
              <input
                type="hidden"
                name="unitPrice"
                value={
                  isGrossMode && itemUnitPrice
                    ? (parseFloat(itemUnitPrice) / (1 + itemEffectiveTaxRate / 100)).toFixed(10)
                    : itemUnitPrice
                }
              />
              {/* Hidden lineNetTotal submits exact net line total to avoid rounding drift */}
              <input
                type="hidden"
                name="lineNetTotal"
                value={
                  itemLineTotal
                    ? isGrossMode
                      ? (parseFloat(itemLineTotal) / (1 + itemEffectiveTaxRate / 100)).toFixed(10)
                      : itemLineTotal
                    : ""
                }
              />

              {/* Net price row */}
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-2">
                  <label className="text-sm font-medium text-[var(--color-text-secondary)]" htmlFor="po-item-net-price">
                    {copy.unitPrice}
                  </label>
                  {isGrossMode ? (
                    <div className="min-h-10 rounded-md border border-[var(--color-border)] bg-[var(--color-bg-subtle)] px-3 py-1.5 text-sm text-[var(--color-text-muted)] flex items-center">
                      {itemComputedOppositeUnit}
                    </div>
                  ) : (
                    <input
                      id="po-item-net-price"
                      type="text"
                      inputMode="decimal"
                      value={itemUnitPrice}
                      onChange={(e) => {
                        const price = e.target.value;
                        setItemUnitPrice(price);
                        const p = parseFloat(price);
                        const q = parseFloat(itemQuantity);
                        if (!isNaN(p) && p >= 0 && !isNaN(q) && q > 0) {
                          setItemLineTotal(roundDisplay(p * q));
                        } else {
                          setItemLineTotal("");
                        }
                      }}
                      className="min-h-10 rounded-md border border-[var(--color-border-strong)] bg-[var(--color-bg-elevated)] px-3 py-1.5 text-sm text-[var(--color-text-primary)] outline-none transition hover:border-[var(--color-border-hover)] focus:border-[var(--color-border-hover)] focus:ring-2 focus:ring-[var(--color-ring)]"
                    />
                  )}
                </div>
                <div className="grid gap-2">
                  <label className="text-sm font-medium text-[var(--color-text-secondary)]" htmlFor="po-item-net-line-total">
                    {copy.lineTotal}
                  </label>
                  {isGrossMode ? (
                    <div className="min-h-10 rounded-md border border-[var(--color-border)] bg-[var(--color-bg-subtle)] px-3 py-1.5 text-sm text-[var(--color-text-muted)] flex items-center">
                      {itemComputedOppositeLine}
                    </div>
                  ) : (
                    <input
                      id="po-item-net-line-total"
                      type="text"
                      inputMode="decimal"
                      value={itemLineTotal}
                      onChange={(e) => {
                        const total = e.target.value;
                        setItemLineTotal(total);
                        const t = parseFloat(total);
                        const q = parseFloat(itemQuantity);
                        if (!isNaN(t) && t >= 0 && !isNaN(q) && q > 0) {
                          setItemUnitPrice(roundDisplay(t / q));
                        } else {
                          setItemUnitPrice("");
                        }
                      }}
                      className="min-h-10 rounded-md border border-[var(--color-border-strong)] bg-[var(--color-bg-elevated)] px-3 py-1.5 text-sm text-[var(--color-text-primary)] outline-none transition hover:border-[var(--color-border-hover)] focus:border-[var(--color-border-hover)] focus:ring-2 focus:ring-[var(--color-ring)]"
                    />
                  )}
                </div>
              </div>

              {/* Gross price row */}
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-2">
                  <label className="text-sm font-medium text-[var(--color-text-secondary)]" htmlFor="po-item-gross-price">
                    {copy.grossUnitPrice}
                  </label>
                  {isGrossMode ? (
                    <input
                      id="po-item-gross-price"
                      type="text"
                      inputMode="decimal"
                      value={itemUnitPrice}
                      onChange={(e) => {
                        const price = e.target.value;
                        setItemUnitPrice(price);
                        const p = parseFloat(price);
                        const q = parseFloat(itemQuantity);
                        if (!isNaN(p) && p >= 0 && !isNaN(q) && q > 0) {
                          setItemLineTotal(roundDisplay(p * q));
                        } else {
                          setItemLineTotal("");
                        }
                      }}
                      className="min-h-10 rounded-md border border-[var(--color-border-strong)] bg-[var(--color-bg-elevated)] px-3 py-1.5 text-sm text-[var(--color-text-primary)] outline-none transition hover:border-[var(--color-border-hover)] focus:border-[var(--color-border-hover)] focus:ring-2 focus:ring-[var(--color-ring)]"
                    />
                  ) : (
                    <div className="min-h-10 rounded-md border border-[var(--color-border)] bg-[var(--color-bg-subtle)] px-3 py-1.5 text-sm text-[var(--color-text-muted)] flex items-center">
                      {itemComputedOppositeUnit}
                    </div>
                  )}
                </div>
                <div className="grid gap-2">
                  <label className="text-sm font-medium text-[var(--color-text-secondary)]" htmlFor="po-item-gross-line-total">
                    {copy.grossLineTotal}
                  </label>
                  {isGrossMode ? (
                    <input
                      id="po-item-gross-line-total"
                      type="text"
                      inputMode="decimal"
                      value={itemLineTotal}
                      onChange={(e) => {
                        const total = e.target.value;
                        setItemLineTotal(total);
                        const t = parseFloat(total);
                        const q = parseFloat(itemQuantity);
                        if (!isNaN(t) && t >= 0 && !isNaN(q) && q > 0) {
                          setItemUnitPrice(roundDisplay(t / q));
                        } else {
                          setItemUnitPrice("");
                        }
                      }}
                      className="min-h-10 rounded-md border border-[var(--color-border-strong)] bg-[var(--color-bg-elevated)] px-3 py-1.5 text-sm text-[var(--color-text-primary)] outline-none transition hover:border-[var(--color-border-hover)] focus:border-[var(--color-border-hover)] focus:ring-2 focus:ring-[var(--color-ring)]"
                    />
                  ) : (
                    <div className="min-h-10 rounded-md border border-[var(--color-border)] bg-[var(--color-bg-subtle)] px-3 py-1.5 text-sm text-[var(--color-text-muted)] flex items-center">
                      {itemComputedOppositeLine}
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-2">
                  <label className="text-sm font-medium text-[var(--color-text-secondary)]" htmlFor="po-item-tax-rate">{copy.taxRate}</label>
                  <input
                    id="po-item-tax-rate"
                    name="taxRate"
                    type="text"
                    inputMode="decimal"
                    value={itemTaxRate}
                    onChange={(e) => setItemTaxRate(e.target.value)}
                    placeholder={detail?.taxRate ?? copy.taxRatePlaceholder}
                    className="min-h-10 rounded-md border border-[var(--color-border-strong)] bg-[var(--color-bg-elevated)] px-3 py-1.5 text-sm text-[var(--color-text-primary)] outline-none transition hover:border-[var(--color-border-hover)] focus:border-[var(--color-border-hover)] focus:ring-2 focus:ring-[var(--color-ring)]"
                  />
                </div>
                <div className="grid gap-2">
                  <label className="text-sm font-medium text-[var(--color-text-secondary)]">{copy.currency}</label>
                  <input type="hidden" name="currency" value={itemCurrency} />
                  <div className="min-h-10 rounded-md border border-[var(--color-border)] bg-[var(--color-bg-subtle)] px-3 py-1.5 text-sm text-[var(--color-text-muted)] flex items-center">
                    {itemCurrency || detail?.currency || "—"}
                  </div>
                </div>
              </div>


              <div className="grid gap-2">
                <label className="text-sm font-medium text-[var(--color-text-secondary)]" htmlFor="po-item-notes">{copy.notes}</label>
                <input
                  id="po-item-notes"
                  name="notes"
                  defaultValue={editingItem?.notes ?? ""}
                  className="min-h-10 rounded-md border border-[var(--color-border-strong)] bg-[var(--color-bg-elevated)] px-3 py-1.5 text-sm text-[var(--color-text-primary)] outline-none transition hover:border-[var(--color-border-hover)] focus:border-[var(--color-border-hover)] focus:ring-2 focus:ring-[var(--color-ring)]"
                />
              </div>
            </DialogBody>
            <DialogActions
              actionLabel={itemDialogMode === "create" ? copy.addItem : copy.saveChanges}
              disabled={isMutating}
              error={itemFormErrors.submit}
            />
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
                <div className="overflow-auto rounded-md border border-[var(--color-border)]">
                  <table className="w-full border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-[var(--color-border)] bg-[var(--color-bg-subtle)]">
                        <th className="px-3 py-2 text-left font-semibold text-[var(--color-text-secondary)]">{copy.part}</th>
                        <th className="px-3 py-2 text-left font-semibold text-[var(--color-text-secondary)]">{copy.remaining}</th>
                        <th className="px-3 py-2 text-left font-semibold text-[var(--color-text-secondary)]">{copy.receivedQty}</th>
                        <th className="px-3 py-2 text-left font-semibold text-[var(--color-text-secondary)]">{copy.location}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {unreceived.map((item) => {
                        const row = receiveRows.get(item.id) ?? { quantity: "", locationId: "" };
                        const remaining = parseFloat(item.quantity) - parseFloat(item.receivedQuantity);
                        return (
                          <tr key={item.id} className="border-b border-[var(--color-border)] last:border-b-0">
                            <td className="px-3 py-2">
                              <div className="font-medium text-[var(--color-text-primary)]">{item.partCatalogNumber}</div>
                              <div className="text-xs text-[var(--color-text-muted)]">{item.manufacturerName}</div>
                            </td>
                            <td className="px-3 py-2 text-[var(--color-text-secondary)]">{remaining}</td>
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
                                className="w-24 rounded-md border border-[var(--color-border-strong)] bg-[var(--color-bg-elevated)] px-2 py-1 text-sm text-[var(--color-text-primary)] outline-none focus:border-[var(--color-border-hover)] focus:ring-2 focus:ring-[var(--color-ring)]"
                              />
                            </td>
                            <td className="px-3 py-2">
                              <LocationTreeSelect
                                locations={allLocations}
                                locationTree={locationTree}
                                copy={copy}
                                name={`location-${item.id}`}
                                selectedId={row.locationId}
                                buttonClassName={receiveMissingLocationIds.has(item.id)
                                  ? `flex-1 grid min-h-8 w-full grid-cols-[1fr_auto] items-center gap-2 rounded-md border bg-[var(--color-bg-elevated)] px-2 py-1 text-left text-sm text-[var(--color-text-primary)] outline-none transition border-[var(--color-error-border)] ring-1 ring-[var(--color-error-border)]`
                                  : undefined}
                                onSelectedIdChange={(locationId) => {
                                  setReceiveMissingLocationIds((prev) => {
                                    const next = new Set(prev);
                                    next.delete(item.id);
                                    return next;
                                  });
                                  setReceiveRows((prev) => {
                                    const next = new Map(prev);
                                    next.set(item.id, { ...row, locationId });
                                    return next;
                                  });
                                }}
                              />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </DialogBody>
            <DialogActions
              actionLabel={copy.receiveItems}
              disabled={isMutating || assignableLocations.length === 0}
              onAction={handleReceiveSubmit}
            />
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
              <p className="text-sm leading-6 text-[var(--color-text-secondary)]">{copy.markOrderedConfirmBody}</p>
            </DialogBody>
            <DialogActions
              actionLabel={copy.confirm}
              disabled={isMutating}
              onAction={() => {
                if (selectedOrderId) markOrderedMutation.mutate({ workspaceSlug, orderId: selectedOrderId });
              }}
            />
          </div>
        ) : null}
      </DialogShell>

      {/* Revert to draft confirmation */}
      <DialogShell
        ref={revertToDraftDialogRef}
        closeLabel={copy.close}
        title={copy.revertToDraftConfirmTitle}
        titleId="revert-to-draft-dialog-title"
        widthClassName="w-[min(28rem,calc(100vw-3rem))]"
        onClose={() => setRevertToDraftPending(false)}
      >
        {revertToDraftPending ? (
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <DialogBody>
              <p className="text-sm leading-6 text-[var(--color-text-secondary)]">{copy.revertToDraftConfirmBody}</p>
            </DialogBody>
            <DialogActions
              actionLabel={copy.confirm}
              disabled={isMutating}
              onAction={() => {
                if (selectedOrderId) revertToDraftMutation.mutate({ workspaceSlug, orderId: selectedOrderId });
              }}
            />
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

      {/* Manual exchange rate dialog */}
      <DialogShell
        ref={rateRequiredDialogRef}
        closeLabel={copy.close}
        title={copy.exchangeRateUnavailableTitle}
        titleId="rate-required-dialog-title"
        widthClassName="w-[min(28rem,calc(100vw-3rem))]"
        onClose={() => setRateRequiredState(null)}
      >
        {rateRequiredState ? (
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <DialogBody className="grid gap-4">
              <p className="text-sm leading-6 text-[var(--color-text-secondary)]">
                {copy.exchangeRateUnavailableBody
                  .replace("{from}", rateRequiredState.from)
                  .replace("{to}", rateRequiredState.to)
                  .replace("{date}", rateRequiredState.date)}
              </p>
              <div className="grid gap-2">
                <label className="text-sm font-medium text-[var(--color-text-secondary)]">
                  {copy.manualRateLabel.replace("{from}", rateRequiredState.from)} {rateRequiredState.to}
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={rateRequiredValue}
                  onChange={(e) => setRateRequiredValue(e.target.value)}
                  className="min-h-10 rounded-md border border-[var(--color-border-strong)] bg-[var(--color-bg-elevated)] px-3 py-1.5 text-sm text-[var(--color-text-primary)] outline-none transition hover:border-[var(--color-border-hover)] focus:border-[var(--color-border-hover)] focus:ring-2 focus:ring-[var(--color-ring)]"
                />
              </div>
            </DialogBody>
            <DialogActions
              actionLabel={copy.manualRateSubmit}
              disabled={saveManualRateMutation.isPending || !rateRequiredValue.trim()}
              error={rateRequiredError}
              onAction={() => {
                saveManualRateMutation.mutate({
                  workspaceSlug,
                  from: rateRequiredState.from,
                  to: rateRequiredState.to,
                  date: rateRequiredState.date,
                  rate: rateRequiredValue
                });
              }}
            />
          </div>
        ) : null}
      </DialogShell>

      {selectedOrderId ? (
        <MultiAddToPODialog
          workspaceSlug={workspaceSlug}
          orderId={selectedOrderId}
          existingParts={existingParts}
          open={multiAddPOOpen}
          copy={copy.multiAdd}
          canReadInventory={canReadInventory}
          canReadShoppingLists={canReadShoppingLists}
          canReadPurchaseOrders={true}
          onClose={() => setMultiAddPOOpen(false)}
          onSuccess={() => {
            refreshDetail(selectedOrderId);
            reloadOrders();
            addToast(copy.itemAddedToast);
          }}
        />
      ) : null}

      <ToastNotice messages={toastMessages} onDismiss={(id) => setToastMessages((msgs) => msgs.filter((m) => m.id !== id))} />
    </>
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
