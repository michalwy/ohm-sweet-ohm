"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
  addShoppingListItemForWorkspace,
  convertShoppingListToOrderForWorkspace,
  createShoppingListForWorkspace,
  deleteShoppingListForWorkspace,
  getShoppingListDetailForWorkspace,
  getShoppingListsForWorkspace,
  removeShoppingListItemForWorkspace,
  updateShoppingListForWorkspace,
  updateShoppingListItemForWorkspace
} from "@/server/shopping-lists/shoppingListActions";
import { getDraftPurchaseOrdersForWorkspace } from "@/server/purchase-orders/purchaseOrderActions";
import type { DraftPurchaseOrderOption } from "@/server/purchase-orders/purchaseOrderMutations";
import type {
  ShoppingListDetail,
  ShoppingListItem,
  ShoppingListSummary
} from "@/server/shopping-lists/shoppingListMutations";
import type { ShoppingListSortBy } from "@/server/shopping-lists/shoppingListMutations";
import type { ListPage } from "@/server/pagination";
import { PartPickerCombobox } from "@/app/part-picker-combobox";
import {
  closeDialog,
  DeleteConfirmationDialog,
  DialogActions,
  DialogBody,
  DialogFooter,
  DialogPrimaryButton,
  DialogSecondaryButton,
  DialogShell,
  ErrorBubble,
  getFieldInputClassName,
  LabelWithError,
  openDialog
} from "@/app/dialog-shell";
import { getNextToastId, ToastNotice, type ToastMessage } from "@/app/toast-notice";
import { InfiniteListViewport } from "@/app/infinite-list";
import {
  useListTableConfiguration,
  type ListColumnDefinition
} from "@/app/list-table-config";
import { ListPageToolbar, ListTableHeaderCell, useColumnDragReorder, useColumnResizeCursor } from "@/app/list-page-toolbar";
import { EmptyCell } from "@/app/list-table-cell";
import { DetailPanel, useDetailsPanelWidth } from "@/app/detail-panel";
import { CreatePurchaseOrderDialog } from "@/app/create-purchase-order-dialog";
import { MultiAddToSLDialog, type MultiAddToSLCopy } from "@/app/multi-add-to-sl-dialog";
import { PartLink } from "@/app/entity-links";
import { PinnedFilterBanner } from "@/app/pinned-filter-banner";
import { DateDisplay } from "@/app/date-display";


type Copy = {
  title: string;
  intro: string;
  newList: string;
  newListTitle: string;
  editListTitle: string;
  name: string;
  description: string;
  namePlaceholder: string;
  descriptionPlaceholder: string;
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
  pinnedFilterLabel: string;
  clearPinnedFilter: string;
  loadError: string;
  loadingLists: string;
  loadingMoreLists: string;
  items: string;
  itemsPlural: string;
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
  loadingParts: string;
  noMatchingParts: string;
  orderedBadge: string;
  alreadyOnOrder: string;
  convertToOrder: string;
  convertToOrderTitle: string;
  convertToOrderBody: string;
  supplier: string;
  chooseSupplier: string;
  noSuppliers: string;
  loadingSuppliers: string;
  newOrder: string;
  newOrderTitle: string;
  noDraftOrders: string;
  noOrderSelected: string;
  addedToOrderToast: string;
  selectedItems: string;
  noItemsSelected: string;
  addToOrder: string;
  orderNumber: string;
  orderNumberPlaceholder: string;
  notes: string;
  notesPlaceholder: string;
  createOrder: string;
  created: string;
  createdBy: string;
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
  listCountSummary: string;
  multiAdd: MultiAddToSLCopy;
};

type ShoppingListsClientProps = {
  canWrite: boolean;
  copy: Copy;
  initialPage: ListPage<ShoppingListSummary>;
  initialSelectedListId?: string;
  initialPinnedListId?: string;
  workspaceSlug: string;
  primaryCurrency: string;
  workspaceDefaultPriceEntryMode?: "net" | "gross";
  workspaceDefaultTaxRate?: string | null;
};

const columnHelper = createColumnHelper<ShoppingListSummary>();

export function ShoppingListsClient({
  canWrite,
  copy,
  initialPage,
  initialSelectedListId,
  initialPinnedListId,
  workspaceSlug,
  primaryCurrency,
  workspaceDefaultPriceEntryMode = "net",
  workspaceDefaultTaxRate = null
}: ShoppingListsClientProps) {
  const queryClient = useQueryClient();

  const [selectedListId, setSelectedListId] = useState<string | null>(
    initialSelectedListId ?? null
  );
  const [pinnedListId, setPinnedListId] = useState<string | null>(
    initialPinnedListId ?? null
  );
  const [hoveredListId, setHoveredListId] = useState<string | null>(null);
  const [listDialogMode, setListDialogMode] = useState<"create" | "edit" | null>(null);
  const [editingList, setEditingList] = useState<ShoppingListSummary | null>(null);
  const [listPendingDelete, setListPendingDelete] = useState<ShoppingListSummary | null>(null);
  const [itemDialogMode, setItemDialogMode] = useState<"create" | "edit" | null>(null);
  const [editingItem, setEditingItem] = useState<ShoppingListItem | null>(null);
  const [itemPendingRemove, setItemPendingRemove] = useState<ShoppingListItem | null>(null);
  const [convertDialogOpen, setConvertDialogOpen] = useState(false);
  const [selectedOrderForConvert, setSelectedOrderForConvert] = useState<string | null>(null);
  const [createPODialogOpen, setCreatePODialogOpen] = useState(false);
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set());
  const [partSearchQuery, setPartSearchQuery] = useState("");
  const [selectedPartId, setSelectedPartId] = useState<string | null>(null);
  const [listFormErrors, setListFormErrors] = useState<Record<string, string>>({});
  const [itemFormErrors, setItemFormErrors] = useState<Record<string, string>>({});
  const [convertFormErrors, setConvertFormErrors] = useState<Record<string, string>>({});
  const [dialogFormKey, setDialogFormKey] = useState(0);
  const [multiAddSLOpen, setMultiAddSLOpen] = useState(false);
  const { isResizingColumn, setIsResizingColumn, containerClassName } = useColumnResizeCursor();
  const [toastMessages, setToastMessages] = useState<ToastMessage[]>([]);
  const nextToastIdRef = useRef(0);
  const listDialogRef = useRef<HTMLDialogElement>(null);
  const itemDialogRef = useRef<HTMLDialogElement>(null);
  const convertDialogRef = useRef<HTMLDialogElement>(null);
  const createPODialogRef = useRef<HTMLDialogElement>(null);
  const selectAllRef = useRef<HTMLInputElement>(null);

  // --- Column configuration ---

  const listColumns = useMemo<ListColumnDefinition[]>(
    () => [
      { id: "name", label: copy.name, group: "base", defaultWidth: 240, minWidth: 120, sortable: true },
      { id: "description", label: copy.description, group: "base", defaultWidth: 320, minWidth: 96 },
      { id: "itemCount", label: copy.items, group: "base", defaultWidth: 100, minWidth: 64, sortable: true, align: "right" as const },
      { id: "createdAt", label: copy.created, group: "base", defaultWidth: 160, minWidth: 100, defaultVisible: false, sortable: true },
      { id: "createdBy", label: copy.createdBy, group: "base", defaultWidth: 160, minWidth: 100, defaultVisible: false }
    ],
    [copy]
  );
  const fixedListColumnIds = useMemo(() => ["actions"], []);

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
    isLoaded: isListConfigLoaded
  } = useListTableConfiguration({
    storageKey: `oso:list-config:shopping-lists:${workspaceSlug}`,
    columns: listColumns,
    fixedColumnIds: fixedListColumnIds
  });

  // --- Lists data ---

  const activeSorting = sorting[0] ?? null;

  const listsQuery = useInfiniteQuery({
    queryKey: ["shopping-lists", workspaceSlug, { sorting, pinnedListId }] as const,
    enabled: isListConfigLoaded,
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam }) => {
      const result = await getShoppingListsForWorkspace({
        workspaceSlug,
        cursor: pageParam,
        sortBy: (activeSorting?.id ?? null) as ShoppingListSortBy | null,
        sortDirection: activeSorting ? (activeSorting.desc ? "desc" : "asc") : null,
        pinnedId: pinnedListId
      });
      if (!result.ok) throw new Error(result.error);
      return result.data;
    },
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    placeholderData: keepPreviousData,
    initialData:
      sorting.length === 0 && !pinnedListId
        ? { pages: [initialPage], pageParams: [null] }
        : undefined
  });

  const lists = useMemo(
    () => listsQuery.data?.pages.flatMap((p) => p.items) ?? [],
    [listsQuery.data]
  );

  function reloadLists() {
    void queryClient.invalidateQueries({ queryKey: ["shopping-lists", workspaceSlug] });
  }

  // --- Detail query ---

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

  // --- Mutations ---

  const createListMutation = useMutation({
    mutationFn: createShoppingListForWorkspace,
    onSuccess: (result) => {
      if (!result.ok) { setListFormErrors({ submit: getErrorMsg(copy, result.error) }); return; }
      closeListDialog();
      addToast(copy.createdToast);
      reloadLists();
    }
  });

  const updateListMutation = useMutation({
    mutationFn: updateShoppingListForWorkspace,
    onSuccess: (result) => {
      if (!result.ok) { setListFormErrors({ submit: getErrorMsg(copy, result.error) }); return; }
      closeListDialog();
      addToast(copy.updatedToast);
      reloadLists();
    }
  });

  const deleteListMutation = useMutation({
    mutationFn: deleteShoppingListForWorkspace,
    onSuccess: (result) => {
      if (!result.ok) { addToast(getErrorMsg(copy, result.error)); return; }
      if (selectedListId === listPendingDelete?.id) closeListDetails();
      setListPendingDelete(null);
      addToast(copy.deletedToast);
      reloadLists();
    }
  });

  const addItemMutation = useMutation({
    mutationFn: addShoppingListItemForWorkspace,
    onSuccess: (result) => {
      if (!result.ok) { setItemFormErrors({ submit: getErrorMsg(copy, result.error) }); return; }
      closeItemDialog();
      addToast(copy.itemAddedToast);
      void refetchDetail();
      reloadLists();
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
      reloadLists();
    }
  });

  const convertMutation = useMutation({
    mutationFn: convertShoppingListToOrderForWorkspace,
    onSuccess: (result) => {
      if (!result.ok) { setConvertFormErrors({ submit: getErrorMsg(copy, result.error) }); return; }
      closeConvertDialog();
      setSelectedItemIds(new Set());
      addToast(copy.addedToOrderToast);
      void refetchDetail();
    }
  });

  const draftOrdersQuery = useQuery({
    queryKey: ["draft-purchase-orders", workspaceSlug],
    queryFn: async () => {
      const result = await getDraftPurchaseOrdersForWorkspace({ workspaceSlug });
      return result.ok ? result.data : ([] as DraftPurchaseOrderOption[]);
    },
    enabled: convertDialogOpen
  });

  const { draggedColumnId, onDragEnd, onStartDrag, onDropOnto } = useColumnDragReorder(setColumnOrder);

  // --- URL sync & panel ---

  function openListDetails(list: ShoppingListSummary) {
    setSelectedListId(list.id);
    setSelectedItemIds(new Set());
    const url = new URL(window.location.href);
    url.searchParams.set("selectedListId", list.id);
    window.history.replaceState(null, "", url.toString());
  }

  function closeListDetails() {
    setSelectedListId(null);
    setSelectedItemIds(new Set());
    const url = new URL(window.location.href);
    url.searchParams.delete("selectedListId");
    window.history.replaceState(null, "", url.toString());
  }

  const {
    width: detailsPanelWidth,
    hasLoaded: hasLoadedDetailsPanelWidth,
    startResizing: startResizingDetailsPanel
  } = useDetailsPanelWidth(`oso:shopping-lists-details-panel-width:${workspaceSlug}`, 400);

  const selectedList = selectedListId
    ? (lists.find((l) => l.id === selectedListId) ?? null)
    : null;
  // Fall back to the independently fetched detail so the panel can render a
  // selected list that is not on the loaded list page (e.g. page refresh).
  const panelList =
    selectedList ?? (listDetail as ShoppingListDetail | null | undefined) ?? null;

  // --- Dialog helpers ---

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
    setSelectedOrderForConvert(null);
    setConvertDialogOpen(true);
    setDialogFormKey((k) => k + 1);
    window.requestAnimationFrame(() => openDialog(convertDialogRef.current));
  }

  function closeConvertDialog() {
    closeDialog(convertDialogRef.current);
    setConvertDialogOpen(false);
    setConvertFormErrors({});
    setSelectedOrderForConvert(null);
  }

  function openCreatePOFromConvert() {
    setCreatePODialogOpen(true);
    window.requestAnimationFrame(() => openDialog(createPODialogRef.current));
  }

  function closeCreatePODialog() {
    closeDialog(createPODialogRef.current);
    setCreatePODialogOpen(false);
  }

  function handleCreatePOSuccessFromConvert(newOrderId: string) {
    closeCreatePODialog();
    if (!selectedListId) return;
    convertMutation.mutate({
      workspaceSlug,
      listId: selectedListId,
      selectedItemIds: [...selectedItemIds],
      existingOrderId: newOrderId,
    });
  }

  // --- Form handlers ---

  function handleListSubmit(formData: FormData) {
    const name = getString(formData, "name");
    if (!name) { setListFormErrors({ name: copy.nameRequired }); return; }

    if (listDialogMode === "create") {
      createListMutation.mutate({ workspaceSlug, name, description: getString(formData, "description") || null });
    } else if (editingList) {
      updateListMutation.mutate({ workspaceSlug, listId: editingList.id, name, description: getString(formData, "description") || null });
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
        description: getString(formData, "description") || null
      });
    } else if (editingItem && selectedListId) {
      updateItemMutation.mutate({
        workspaceSlug,
        listId: selectedListId,
        itemId: editingItem.id,
        quantity,
        description: getString(formData, "description") || null
      });
    }
  }

  function handleConvertSubmit() {
    if (selectedItemIds.size === 0) { setConvertFormErrors({ items: copy.noItemsSelected }); return; }
    if (!selectedListId) return;
    if (!selectedOrderForConvert) { setConvertFormErrors({ order: copy.noOrderSelected }); return; }

    convertMutation.mutate({
      workspaceSlug,
      listId: selectedListId,
      selectedItemIds: [...selectedItemIds],
      existingOrderId: selectedOrderForConvert,
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

  // --- TanStack Table ---

  const columns = useMemo(
    () => [
      columnHelper.accessor("name", {
        header: copy.name,
        size: 240,
        minSize: 120,
        cell: ({ getValue }) => (
          <span className="font-medium text-[var(--color-text-primary)]">{getValue()}</span>
        )
      }),
      columnHelper.accessor("description", {
        header: copy.description,
        size: 320,
        minSize: 96,
        cell: ({ getValue }) => {
          const v = getValue();
          return v
            ? <span className="text-[var(--color-text-secondary)]">{v}</span>
            : <EmptyCell />;
        }
      }),
      columnHelper.accessor("itemCount", {
        header: copy.items,
        size: 100,
        minSize: 64,
        cell: ({ getValue }) => (
          <span className="block text-right text-[var(--color-text-secondary)]">{getValue()}</span>
        )
      }),
      columnHelper.accessor("createdAt", {
        header: copy.created,
        size: 160,
        minSize: 100,
        cell: ({ getValue }) => (
          <DateDisplay value={getValue()} className="text-[var(--color-text-secondary)]" />
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
              disabled={!canWrite}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                openEditListDialog(row.original);
              }}
            >
              <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                <path d="M13.9 3.3a1.5 1.5 0 0 1 2.1 0l.7.7a1.5 1.5 0 0 1 0 2.1l-8.4 8.4-3.3.8.8-3.3 8.4-8.4Z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
              </svg>
            </button>
            <button
              aria-label={copy.delete}
              className="min-h-8 rounded-md border border-[var(--color-error-border)] bg-[var(--color-bg-elevated)] px-2.5 py-1 text-sm font-medium text-[var(--color-error)] transition hover:bg-[var(--color-error-soft)] focus:outline-none focus:ring-2 focus:ring-[var(--color-error-border)] focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-[var(--color-bg-subtle)] disabled:text-[var(--color-text-placeholder)]"
              disabled={!canWrite || deleteListMutation.isPending}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setListPendingDelete(row.original);
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
    [canWrite, copy, deleteListMutation.isPending]
  );

  const tableColumnOrder = useMemo(() => persistedColumnOrder, [persistedColumnOrder]);

  // eslint-disable-next-line react-hooks/incompatible-library
  const listsTable = useReactTable({
    data: lists,
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

  const isMutating =
    createListMutation.isPending ||
    updateListMutation.isPending ||
    addItemMutation.isPending ||
    updateItemMutation.isPending ||
    convertMutation.isPending;

  const items = useMemo(
    () => (listDetail as ShoppingListDetail | null | undefined)?.items ?? [],
    [listDetail]
  );
  const existingParts = useMemo(
    () => new Map(items.map((item) => [item.partId, item.quantity])),
    [items]
  );
  const selectableItemIds = useMemo(
    () => items.filter((item) => !item.orderedInPurchaseOrderId).map((item) => item.id),
    [items]
  );
  const allSelectableSelected =
    selectableItemIds.length > 0 && selectableItemIds.every((id) => selectedItemIds.has(id));
  const someSelectableSelected =
    !allSelectableSelected && selectableItemIds.some((id) => selectedItemIds.has(id));

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = someSelectableSelected;
    }
  }, [someSelectableSelected]);

  function toggleSelectAll() {
    if (allSelectableSelected) {
      setSelectedItemIds((prev) => {
        const next = new Set(prev);
        selectableItemIds.forEach((id) => next.delete(id));
        return next;
      });
    } else {
      setSelectedItemIds((prev) => {
        const next = new Set(prev);
        selectableItemIds.forEach((id) => next.add(id));
        return next;
      });
    }
  }

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
            filteredCount={listsQuery.data?.pages[0]?.filteredCount}
            formatCount={(visible, total) =>
              copy.listCountSummary
                .replace("{visible}", String(visible))
                .replace("{total}", String(total))
            }
            totalCount={listsQuery.data?.pages[0]?.totalCount}
            visibleColumnsLabel={copy.visibleColumns}
            setColumnVisible={setColumnVisible}
            primaryAction={
              <button
                className="inline-flex min-h-9 items-center rounded-md bg-[var(--color-accent)] px-4 text-sm font-semibold text-white transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={!canWrite}
                type="button"
                onClick={openCreateListDialog}
              >
                {copy.newList}
              </button>
            }
          />
          {pinnedListId ? (
            <PinnedFilterBanner
              label={copy.pinnedFilterLabel}
              clearLabel={copy.clearPinnedFilter}
              onClear={() => {
                setPinnedListId(null);
                setSelectedListId(null);
                const url = new URL(window.location.href);
                url.searchParams.delete("selectedListId");
                url.searchParams.delete("pinnedId");
                window.history.replaceState(null, "", url.toString());
              }}
            />
          ) : null}

          <InfiniteListViewport
            emptyState={
              <p className="px-4 py-10 text-sm text-[var(--color-text-muted)]">{copy.noLists}</p>
            }
            errorState={
              <p className="px-4 py-10 text-sm text-[var(--color-error)]">{copy.loadError}</p>
            }
            hasNextPage={listsQuery.hasNextPage}
            isEmpty={lists.length === 0}
            isError={listsQuery.isError}
            isFetchingNextPage={listsQuery.isFetchingNextPage}
            isInitialLoading={!isListConfigLoaded || listsQuery.isLoading || listsQuery.isPlaceholderData}
            loadMore={() => void listsQuery.fetchNextPage()}
            loadingLabel={copy.loadingLists}
            loadingMoreLabel={copy.loadingMoreLists}
          >
            <table
              className="table-fixed border-separate border-spacing-0 text-left text-sm"
              style={{ width: listsTable.getTotalSize() }}
            >
              <colgroup>
                {listsTable.getVisibleLeafColumns().map((col) => (
                  <col key={col.id} style={{ width: col.getSize() }} />
                ))}
              </colgroup>
              <thead className="sticky top-0 z-10 bg-[var(--color-bg-subtle)]">
                {listsTable.getHeaderGroups().map((headerGroup) => (
                  <tr key={headerGroup.id}>
                    {headerGroup.headers.map((header) => (
                      <ListTableHeaderCell
                        key={header.id}
                        columnDefs={listColumns}
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
                {listsTable.getRowModel().rows.map((row) => (
                  <tr
                    key={row.id}
                    className={`border-b border-[var(--color-border)] ${
                      row.original.id === selectedListId
                        ? "bg-[var(--color-bg-muted)]"
                        : row.original.id === hoveredListId
                          ? "bg-[var(--color-bg-subtle)]"
                          : ""
                    }`}
                    role="button"
                    tabIndex={0}
                    onClick={() => openListDetails(row.original)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        openListDetails(row.original);
                      }
                    }}
                    onMouseEnter={() => setHoveredListId(row.original.id)}
                    onMouseLeave={() =>
                      setHoveredListId((cur) =>
                        cur === row.original.id ? null : cur
                      )
                    }
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td
                        key={cell.id}
                        className={`overflow-hidden border-b border-[var(--color-border)] px-2 py-2 text-[var(--color-text-secondary)] ${
                          cell.column.id === "actions"
                            ? row.original.id === selectedListId
                              ? "sticky right-0 z-10 bg-[var(--color-bg-muted)] px-1 py-1.5"
                              : row.original.id === hoveredListId
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
        {panelList && hasLoadedDetailsPanelWidth ? (
          <DetailPanel
            closeLabel={copy.close}
            subtitle={panelList.description ?? undefined}
            title={panelList.name}
            width={detailsPanelWidth}
            onClose={closeListDetails}
            onStartResize={startResizingDetailsPanel}
          >
            <section className="grid gap-2">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">{copy.listItems}</h3>
                <div className="flex items-center gap-2">
                  {selectedItemIds.size > 0 ? (
                    <button
                      className="min-h-8 rounded-md border border-[var(--color-border-strong)] bg-[var(--color-bg-elevated)] px-3 text-sm font-medium text-[var(--color-text-secondary)] transition hover:border-[var(--color-border-hover)] hover:bg-[var(--color-bg-subtle)] disabled:cursor-not-allowed disabled:opacity-60"
                      disabled={!canWrite}
                      type="button"
                      onClick={openConvertDialog}
                    >
                      {copy.convertToOrder} ({selectedItemIds.size})
                    </button>
                  ) : null}
                  <button
                    className="inline-flex min-h-8 items-center rounded-md border border-[var(--color-border-strong)] bg-[var(--color-bg-elevated)] px-3 text-sm font-medium text-[var(--color-text-secondary)] transition hover:border-[var(--color-border-hover)] hover:bg-[var(--color-bg-subtle)] disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={!canWrite}
                    type="button"
                    onClick={() => setMultiAddSLOpen(true)}
                  >
                    {copy.multiAdd.pickerTitle}
                  </button>
                  <button
                    className="inline-flex min-h-8 items-center rounded-md bg-[var(--color-accent)] px-3 text-sm font-semibold text-white transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={!canWrite}
                    type="button"
                    onClick={openCreateItemDialog}
                  >
                    {copy.addItem}
                  </button>
                </div>
              </div>

              {items.length === 0 ? (
                <p className="rounded-md border border-[var(--color-border)] bg-[var(--color-bg-subtle)] px-3 py-2 text-sm text-[var(--color-text-secondary)]">
                  {copy.noItems}
                </p>
              ) : (
                <div className="overflow-hidden rounded-md border border-[var(--color-border)]">
                  <table className="w-full border-collapse text-left text-sm">
                    <thead>
                      <tr className="border-b border-[var(--color-border)] bg-[var(--color-bg-subtle)]">
                        <th className="w-8 px-3 py-2">
                          <input
                            ref={selectAllRef}
                            aria-label="Select all items"
                            checked={allSelectableSelected}
                            disabled={selectableItemIds.length === 0}
                            type="checkbox"
                            onChange={toggleSelectAll}
                          />
                        </th>
                        <th className="px-3 py-2 font-semibold text-[var(--color-text-secondary)]">{copy.part}</th>
                        <th className="w-20 px-3 py-2 text-right font-semibold text-[var(--color-text-secondary)]">{copy.quantity}</th>
                        <th className="px-3 py-2 font-semibold text-[var(--color-text-secondary)]">{copy.description}</th>
                        <th className="w-20 px-3 py-2" />
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((item) => (
                        <tr key={item.id} className="group border-b border-[var(--color-border)] last:border-b-0">
                          <td className="px-3 py-2">
                            <input
                              aria-label={`Select ${item.partCatalogNumber}`}
                              checked={selectedItemIds.has(item.id)}
                              disabled={Boolean(item.orderedInPurchaseOrderId)}
                              title={item.orderedInPurchaseOrderId ? copy.alreadyOnOrder : undefined}
                              type="checkbox"
                              onChange={() => toggleItemSelection(item.id)}
                            />
                          </td>
                          <td className="px-3 py-2">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="font-medium text-[var(--color-text-primary)]">
                                <PartLink partId={item.partId} name={item.partCatalogNumber} />
                              </span>
                              <span className="text-[var(--color-text-muted)]">{item.manufacturerName}</span>
                              {item.orderedInPurchaseOrderId ? (
                                <span className="rounded-full bg-[var(--color-success-soft)] px-2 py-0.5 text-xs font-medium text-[var(--color-success)]">
                                  {item.orderedInPurchaseOrderNumber
                                    ? `${copy.orderedBadge}: #${item.orderedInPurchaseOrderNumber}`
                                    : item.orderedInPurchaseOrderSupplierName
                                      ? `${copy.orderedBadge} (${item.orderedInPurchaseOrderSupplierName})`
                                      : copy.orderedBadge}
                                </span>
                              ) : null}
                            </div>
                            {item.partDescription ? (
                              <p className="text-xs text-[var(--color-text-muted)]">{item.partDescription}</p>
                            ) : null}
                          </td>
                          <td className="w-20 px-3 py-2 text-right text-[var(--color-text-secondary)]">{item.quantity}</td>
                          <td className="px-3 py-2 text-[var(--color-text-secondary)]">{item.description ?? "—"}</td>
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
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </DetailPanel>
        ) : null}
      </div>

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
                  className={getFieldInputClassName(
                    "min-h-10 rounded-md border border-[var(--color-border-strong)] bg-[var(--color-bg-elevated)] px-3 py-1.5 text-sm text-[var(--color-text-primary)] outline-none transition hover:border-[var(--color-border-hover)] focus:border-[var(--color-border-hover)] focus:ring-2 focus:ring-[var(--color-ring)]",
                    Boolean(listFormErrors.name)
                  )}
                  defaultValue={editingList?.name ?? ""}
                  id="list-name"
                  name="name"
                  placeholder={copy.namePlaceholder}
                />
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-medium text-[var(--color-text-secondary)]" htmlFor="list-description">
                  {copy.description}
                </label>
                <textarea
                  className="rounded-md border border-[var(--color-border-strong)] bg-[var(--color-bg-elevated)] px-3 py-1.5 text-sm text-[var(--color-text-primary)] outline-none transition hover:border-[var(--color-border-hover)] focus:border-[var(--color-border-hover)] focus:ring-2 focus:ring-[var(--color-ring)] resize-none"
                  defaultValue={editingList?.description ?? ""}
                  id="list-description"
                  name="description"
                  placeholder={copy.descriptionPlaceholder}
                  rows={3}
                />
              </div>
            </DialogBody>
            <DialogActions
              actionLabel={listDialogMode === "create" ? copy.createList : copy.saveChanges}
              disabled={isMutating}
              error={listFormErrors.submit}
            />
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
              {itemDialogMode === "create" ? (
                <div className="grid gap-2">
                  <LabelWithError error={itemFormErrors.part}>
                    {copy.part}
                  </LabelWithError>
                  <PartPickerCombobox
                    workspaceSlug={workspaceSlug}
                    inputValue={partSearchQuery}
                    selectedPartId={selectedPartId}
                    placeholder={copy.searchPartsPlaceholder}
                    loadingLabel={copy.loadingParts}
                    noMatchesLabel={copy.noMatchingParts}
                    onInputChange={(q) => {
                      setPartSearchQuery(q);
                      setSelectedPartId(null);
                    }}
                    onSelect={(part) => {
                      setSelectedPartId(part.id);
                      setPartSearchQuery(`${part.catalogNumber} — ${part.manufacturerName}`);
                    }}
                  />
                </div>
              ) : (
                <div className="grid gap-1">
                  <p className="text-sm font-medium text-[var(--color-text-secondary)]">{copy.part}</p>
                  <p className="text-sm text-[var(--color-text-primary)]">
                    {editingItem?.partCatalogNumber} — {editingItem?.manufacturerName}
                  </p>
                </div>
              )}
              <div className="grid gap-2">
                <LabelWithError error={itemFormErrors.quantity} htmlFor="item-quantity">
                  {copy.quantity}
                </LabelWithError>
                <input
                  className={getFieldInputClassName(
                    "min-h-10 rounded-md border border-[var(--color-border-strong)] bg-[var(--color-bg-elevated)] px-3 py-1.5 text-sm text-[var(--color-text-primary)] outline-none transition hover:border-[var(--color-border-hover)] focus:border-[var(--color-border-hover)] focus:ring-2 focus:ring-[var(--color-ring)]",
                    Boolean(itemFormErrors.quantity)
                  )}
                  defaultValue={editingItem?.quantity ?? ""}
                  id="item-quantity"
                  inputMode="decimal"
                  name="quantity"
                  placeholder="1"
                  type="text"
                />
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-medium text-[var(--color-text-secondary)]" htmlFor="item-description">
                  {copy.description}
                </label>
                <textarea
                  className="rounded-md border border-[var(--color-border-strong)] bg-[var(--color-bg-elevated)] px-3 py-1.5 text-sm text-[var(--color-text-primary)] outline-none transition hover:border-[var(--color-border-hover)] focus:border-[var(--color-border-hover)] focus:ring-2 focus:ring-[var(--color-ring)] resize-none"
                  defaultValue={editingItem?.description ?? ""}
                  id="item-description"
                  name="description"
                  rows={3}
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

      {/* Convert to order dialog */}
      <DialogShell
        ref={convertDialogRef}
        closeLabel={copy.close}
        description={copy.convertToOrderBody}
        title={copy.convertToOrderTitle}
        titleId="convert-dialog-title"
        widthClassName="w-[min(36rem,calc(100vw-3rem))]"
        onClose={closeConvertDialog}
      >
        {convertDialogOpen ? (
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <DialogBody className="grid gap-3">
              {/* Draft orders list */}
              {draftOrdersQuery.isLoading ? (
                <p className="text-sm text-[var(--color-text-muted)]">{copy.loadingParts}</p>
              ) : !draftOrdersQuery.data?.length ? (
                <p className="rounded-md border border-[var(--color-border)] bg-[var(--color-bg-subtle)] px-3 py-3 text-sm text-[var(--color-text-secondary)]">
                  {copy.noDraftOrders}
                </p>
              ) : (
                <div className="overflow-hidden rounded-md border border-[var(--color-border)]">
                  {draftOrdersQuery.data.map((order) => {
                    const isSelected = selectedOrderForConvert === order.id;
                    return (
                      <button
                        key={order.id}
                        className={`flex w-full items-center gap-3 border-b border-[var(--color-border)] px-3 py-2.5 text-left text-sm last:border-b-0 transition hover:bg-[var(--color-bg-subtle)] ${isSelected ? "bg-[var(--color-accent-soft)]" : "bg-[var(--color-bg-elevated)]"}`}
                        type="button"
                        onClick={() => setSelectedOrderForConvert(order.id)}
                      >
                        <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 ${isSelected ? "border-[var(--color-accent)] bg-[var(--color-accent)]" : "border-[var(--color-border-strong)]"}`}>
                          {isSelected ? (
                            <span className="block h-1.5 w-1.5 rounded-full bg-[var(--color-bg-elevated)]" />
                          ) : null}
                        </span>
                        <span className="flex-1 font-medium text-[var(--color-text-primary)]">
                          {order.supplierName}
                          {order.orderNumber ? (
                            <span className="ml-1.5 text-[var(--color-text-muted)]">#{order.orderNumber}</span>
                          ) : null}
                        </span>
                        <span className="text-[var(--color-text-muted)]">
                          {order.itemCount} {order.itemCount === 1 ? copy.items : copy.itemsPlural}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}

              {convertFormErrors.order ? (
                <p className="text-xs text-[var(--color-error)]">{convertFormErrors.order}</p>
              ) : null}

              <div className="flex items-center gap-1.5 text-sm text-[var(--color-text-muted)]">
                <span>{selectedItemIds.size} {selectedItemIds.size === 1 ? copy.items : copy.itemsPlural} {copy.selectedItems}</span>
                {convertFormErrors.items ? (
                  <span className="text-[var(--color-error)]">— {convertFormErrors.items}</span>
                ) : null}
              </div>
            </DialogBody>
            <DialogFooter className="items-center justify-between gap-3">
              <DialogSecondaryButton onClick={openCreatePOFromConvert}>
                {copy.newOrder}
              </DialogSecondaryButton>
              <div className="flex gap-3">
                <DialogSecondaryButton onClick={closeConvertDialog}>
                  {copy.cancel}
                </DialogSecondaryButton>
                <DialogPrimaryButton
                  disabled={isMutating || !selectedOrderForConvert}
                  type="button"
                  onClick={handleConvertSubmit}
                >
                  {copy.addToOrder}
                </DialogPrimaryButton>
              </div>
            </DialogFooter>
            {convertFormErrors.submit ? <ErrorBubble>{convertFormErrors.submit}</ErrorBubble> : null}
          </div>
        ) : null}
      </DialogShell>

      {/* Create PO dialog (opened from convert flow) */}
      <CreatePurchaseOrderDialog
        dialogRef={createPODialogRef}
        isOpen={createPODialogOpen}
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
          notes: copy.notes,
          notesPlaceholder: copy.notesPlaceholder,
          createOrder: copy.createOrder,
          cancel: copy.cancel,
          close: copy.close,
          supplierRequired: copy.supplierRequired,
          permissionDenied: copy.permissionDenied,
          databaseUnavailable: copy.databaseUnavailable,
          invalidInput: copy.invalidInput,
          currency: "Currency",
          chooseCurrency: "— none —",
          taxRate: "Tax rate (%)",
          taxRatePlaceholder: "0",
          taxRateHelp: "Applied to all items unless overridden per item",
          priceEntryMode: "Price entry mode",
          priceEntryModeNet: "Net",
          priceEntryModeGross: "Gross",
        }}
        onClose={closeCreatePODialog}
        onSuccess={handleCreatePOSuccessFromConvert}
      />

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

      {selectedListId ? (
        <MultiAddToSLDialog
          workspaceSlug={workspaceSlug}
          listId={selectedListId}
          existingParts={existingParts}
          open={multiAddSLOpen}
          copy={copy.multiAdd}
          onClose={() => setMultiAddSLOpen(false)}
          onSuccess={() => {
            void queryClient.invalidateQueries({ queryKey: ["shopping-list-detail", workspaceSlug, selectedListId] });
            void queryClient.invalidateQueries({ queryKey: ["shopping-lists", workspaceSlug] });
            addToast(copy.itemAddedToast);
          }}
        />
      ) : null}

      <ToastNotice
        messages={toastMessages}
        onDismiss={(id) => setToastMessages((msgs) => msgs.filter((m) => m.id !== id))}
      />
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
