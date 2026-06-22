"use client";

import type {
  CSSProperties,
  FormEvent,
  KeyboardEvent as ReactKeyboardEvent,
  SetStateAction
} from "react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  keepPreviousData,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient
} from "@tanstack/react-query";
import {
  getCoreRowModel,
  useReactTable
} from "@tanstack/react-table";
import { createPortal } from "react-dom";

import { createPart, deletePart, updatePart } from "@/server/parts/createPart";
import {
  getSupplierPartAttributesForWorkspace,
  searchSupplierPartsForWorkspace
} from "@/server/integrations/supplierActions";
import { getSupplierMatchingSuggestionsForWorkspace } from "@/server/integrations/matching";
import { ManufacturerAutocomplete, type ManufacturerSuggestion } from "@/app/manufacturer-autocomplete";
import type { PartCategoryListItem } from "@/server/parts/categories";
import type { PartsListItem } from "@/server/parts/getParts";
import type { EffectiveCategoryAttribute } from "@/server/parts/attributes";
import type { AttributeListItem } from "@/server/parts/attributeMutations";
import type { SupplierProviderKey } from "@/server/integrations/types";
import type { UnitListItem } from "@/server/units/getUnits";
import { DetailPanel, useDetailsPanelWidth } from "@/app/detail-panel";
import {
  useListTableConfiguration
} from "@/app/list-table-config";
import { ListPageToolbar } from "@/app/list-page-toolbar";
import {
  getNextToastId,
  ToastNotice,
  type ToastMessage
} from "@/app/toast-notice";
import {
  DeleteConfirmationDialog,
  DialogBody,
  DialogFooter,
  DialogShell,
  ErrorBubble,
  LabelWithError,
  closeDialog,
  getFieldInputClassName,
  getDialogBodyHeightStyle,
  observeDialogContentHeight,
  openDialog
} from "@/app/dialog-shell";
import { PartStockDialog } from "@/app/part-stock-dialog";
import { QuickAddToPODialog } from "@/app/part-quick-add-po-dialog";
import { QuickAddToSLDialog } from "@/app/part-quick-add-sl-dialog";
import { useDebouncedValue } from "@/app/use-debounced-value";
import { usePartsListQuery } from "@/app/use-parts-list-query";
import { PartsListFilters } from "@/app/parts-list-filters";
import { buildPartsListColumnDefs, buildPartsListColumns } from "@/app/parts-list-columns";
import { PartsListTable } from "@/app/parts-list-table";
import { formatFilteredPartsSummary } from "@/app/parts-list-sort-utils";
import {
  CategoryTreeSelect,
  buildCategoryTree,
  getCreatePrimaryCategoryFromFilter,
  getFloatingPanelStyle,
  type CategoryTreeItem
} from "@/app/parts-category-tree-select";
import {
  getPartBalancesForWorkspace,
  getPartInventoryHistoryForWorkspace
} from "@/server/inventory/entryActions";
import { getLocationsForWorkspace } from "@/server/inventory/locationActions";
import type { StorageLocationListItem } from "@/server/inventory/locationMutations";
import { buildTree } from "@/app/tree-picker-utils";
import {
  LocationTreeSelect,
  formLocationSelectButtonClassName,
  type LocationTreeItem,
  type LocationTreeSelectCopy
} from "@/app/location-tree-select";
import { TreeSelectButton, TreeSelectPanel } from "@/app/tree-select";
import { getPartPurchaseOrderHistoryForWorkspace } from "@/server/purchase-orders/purchaseOrderActions";
import type { PartPurchaseOrderHistoryItem } from "@/server/purchase-orders/purchaseOrderMutations";
import { getPartShoppingListMembershipForWorkspace } from "@/server/shopping-lists/shoppingListActions";
import type { PartShoppingListMembershipItem } from "@/server/shopping-lists/shoppingListMutations";

type Copy = {
  title: string;
  detailsTab: string;
  attributesTab: string;
  catalogNumber: string;
  description: string;
  value: string;
  attributeValues: string;
  attributes: string;
  primaryAttributes: string;
  secondaryPrimaryAttributes: string;
  primaryCategoryAttributes: string;
  secondaryCategoryAttributes: string;
  categories: string;
  primaryCategory: string;
  secondaryCategory: string;
  noCategory: string;
  noSecondaryCategory: string;
  manufacturer: string;
  unit: string;
  unitPlaceholder: string;
  noMatchingManufacturers: string;
  supplierNoMatchingParts: string;
  supplierSearchError: string;
  supplierSuggestionLabel: string;
  matchingDialogTitle: string;
  matchingDialogBody: string;
  sourceCategoryLabel: string;
  sourceManufacturerLabel: string;
  targetManufacturerLabel: string;
  targetCategoryLabel: string;
  sourceAttributeLabel: string;
  sourceValueLabel: string;
  targetAttributeLabel: string;
  noAttribute: string;
  targetValueLabel: string;
  skipMatching: string;
  confirmSkipMatchingTitle: string;
  confirmSkipMatchingBody: string;
  noLearningSaved: string;
  keepMatching: string;
  skipAndContinue: string;
  reassignTitle: string;
  reassignBody: string;
  reassignAction: string;
  cancelAction: string;
  searchParts: string;
  searchPartsPlaceholder: string;
  filterByCategory: string;
  allCategories: string;
  filterByManufacturer: string;
  allManufacturers: string;
  clearFilters: string;
  configureList: string;
  configureListTitle: string;
  configureListBody: string;
  visibleColumns: string;
  attributeColumns: string;
  moveUp: string;
  moveDown: string;
  columnWidthPx: string;
  sortingLabel: string;
  clearSorting: string;
  resetListConfiguration: string;
  filteredPartsSummary: string;
  actions: string;
  stock: string;
  planned: string;
  onOrder: string;
  avgNetCost: string;
  avgGrossCost: string;
  newPartTitle: string;
  newPartBody: string;
  editPartTitle: string;
  editPartBody: string;
  catalogNumberPlaceholder: string;
  descriptionPlaceholder: string;
  manufacturerPlaceholder: string;
  categoryPlaceholder: string;
  searchCategories: string;
  noMatchingCategories: string;
  expandCategory: string;
  collapseCategory: string;
  defaultLocation: string;
  chooseDefaultLocation: string;
  searchLocations: string;
  noMatchingLocations: string;
  expandLocation: string;
  collapseLocation: string;
  createPart: string;
  editPart: string;
  deletePart: string;
  saveChanges: string;
  close: string;
  quantity: string;
  location: string;
  fromLocation: string;
  toLocation: string;
  note: string;
  addMovement: string;
  stockEntryType: string;
  receipt: string;
  issue: string;
  transfer: string;
  adjustment: string;
  noLocations: string;
  noBalances: string;
  currentStock: string;
  stockSaved: string;
  stockActionInvalid: string;
  cancelDelete: string;
  confirmDelete: string;
  deleteConfirmationBody: string;
  addPart: string;
  createdToast: string;
  updatedToast: string;
  deletedToast: string;
  missingRequiredFields: string;
  missingCatalogNumber: string;
  missingManufacturer: string;
  missingUnit: string;
  invalidCategory: string;
  secondaryWithoutPrimary: string;
  duplicateCategories: string;
  duplicatePart: string;
  invalidAttributeValue: string;
  invalidDefaultLocation: string;
  emptyTitle: string;
  emptyBody: string;
  noMatchingPartsTitle: string;
  noMatchingPartsBody: string;
  loadingParts: string;
  loadingMoreParts: string;
  databaseUnavailable: string;
  locationsAndStock: string;
  noAttributes: string;
  movementHistory: string;
  noHistory: string;
  historyColType: string;
  historyColQuantity: string;
  historyColLocation: string;
  historyColDate: string;
  poHistory: string;
  noPurchaseOrders: string;
  poHistoryColOrder: string;
  poHistoryColSupplier: string;
  poHistoryColStatus: string;
  poHistoryColDate: string;
  poHistoryColQty: string;
  poHistoryColUnitPriceNet: string;
  poHistoryColUnitPriceGross: string;
  shoppingLists: string;
  noShoppingLists: string;
  slMembershipColList: string;
  slMembershipColQty: string;
  slMembershipColNotes: string;
  addToPurchaseOrder: string;
  addToShoppingList: string;
  quickAddPOTitle: string;
  quickAddSLTitle: string;
  choosePO: string;
  noPoAvailable: string;
  createNewPO: string;
  chooseSupplier: string;
  noSuppliers: string;
  loadingLabel: string;
  chooseSL: string;
  noSLAvailable: string;
  createNewSL: string;
  slName: string;
  slNamePlaceholder: string;
  notes: string;
  notesPlaceholder: string;
  orderNumber: string;
  orderNumberPlaceholder: string;
  addedToPoToast: string;
  addedToSlToast: string;
  quickAddError: string;
  missingQuantity: string;
  missingList: string;
  missingSLName: string;
  missingSupplier: string;
};

type ListPage<TItem> = {
  items: TItem[];
  nextCursor: string | null;
  totalCount: number;
  filteredCount: number;
};

type PartDialogTab = "details" | "attributes";
type PartFormField = "catalogNumber" | "manufacturerName" | "unitId" | "primaryCategoryId" | "secondaryCategoryId" | "submit" | "delete";
type PartFormErrors = Partial<Record<PartFormField, string>>;
type MatchingDialogState = {
  provider: SupplierProviderKey;
  sourceManufacturerName: string;
  targetManufacturerName: string;
  sourceCategory: string | null;
  sourceCategoryKey: string;
  targetCategoryId: string;
  rows: Array<{
    sourceAttribute: string;
    sourceAttributeName: string;
    sourceUnit: string | null;
    sourceAttributeKey: string;
    sourceValue: string;
    targetAttributeId: string;
    targetValue: string;
  }>;
};

type PartsListClientProps = {
  copy: Copy;
  isDatabaseAvailable: boolean;
  partDialogOpen: boolean;
  partEditDialog?: string;
  partCategories: PartCategoryListItem[];
  units: UnitListItem[];
  categoryAttributesByCategoryId: Record<string, EffectiveCategoryAttribute[]>;
  manufacturerSuggestions: ManufacturerSuggestion[];
  workspaceAttributes: AttributeListItem[];
  globalWorkspaceAttributesForMatching: AttributeListItem[];
  initialPage: ListPage<PartsListItem>;
  workspaceSlug: string;
  activeSupplierProvider: SupplierProviderKey | null;
  canReadInventory: boolean;
  canWriteInventory: boolean;
  canReadShoppingLists: boolean;
  canReadPurchaseOrders: boolean;
  canWriteShoppingLists: boolean;
  canWritePurchaseOrders: boolean;
  primaryCurrency: string;
  initialSelectedPartId?: string;
};

export function PartsListClient({
  copy,
  isDatabaseAvailable,
  partDialogOpen,
  partEditDialog,
  partCategories,
  units,
  categoryAttributesByCategoryId,
  manufacturerSuggestions,
  workspaceAttributes,
  globalWorkspaceAttributesForMatching,
  initialPage,
  workspaceSlug,
  activeSupplierProvider,
  canReadInventory,
  canWriteInventory,
  canReadShoppingLists,
  canReadPurchaseOrders,
  canWriteShoppingLists,
  canWritePurchaseOrders,
  primaryCurrency,
  initialSelectedPartId
}: PartsListClientProps) {
  const queryClient = useQueryClient();
  const createDialogRef = useRef<HTMLDialogElement>(null);
  const editDialogRef = useRef<HTMLDialogElement>(null);
  const matchingDialogRef = useRef<HTMLDialogElement>(null);
  const createDetailsContentRef = useRef<HTMLDivElement>(null);
  const editDetailsContentRef = useRef<HTMLDivElement>(null);
  const nextToastIdRef = useRef(0);
  const categoryTree = buildCategoryTree(partCategories);
  const [currentManufacturerSuggestions, setCurrentManufacturerSuggestions] =
    useState(manufacturerSuggestions);
  const [toastMessages, setToastMessages] = useState<ToastMessage[]>([]);
  const [createCatalogNumber, setCreateCatalogNumber] = useState("");
  const [createDescription, setCreateDescription] = useState("");
  const [createManufacturerName, setCreateManufacturerName] = useState("");
  const [createUnitId, setCreateUnitId] = useState("");
  const [createPrimaryCategoryId, setCreatePrimaryCategoryId] = useState("");
  const [createSecondaryCategoryId, setCreateSecondaryCategoryId] =
    useState("");
  const [createDefaultLocationId, setCreateDefaultLocationId] = useState("");
  const [createActiveTab, setCreateActiveTab] = useState<PartDialogTab>("details");
  const [createDetailsContentHeight, setCreateDetailsContentHeight] =
    useState<number | null>(null);
  const [createAttributeValues, setCreateAttributeValues] = useState<
    Record<string, string>
  >({});
  const [createFieldErrors, setCreateFieldErrors] = useState<PartFormErrors>(
    {}
  );
  const [createSupplierMatchingPayload, setCreateSupplierMatchingPayload] =
    useState("");
  const [matchingState, setMatchingState] = useState<MatchingDialogState | null>(
    null
  );
  const [matchingRowPendingReassign, setMatchingRowPendingReassign] = useState<{
    nextRowIndex: number;
    nextTargetAttributeId: string;
    previousRowIndex: number;
  } | null>(null);
  const [skipMatchingPendingConfirmation, setSkipMatchingPendingConfirmation] =
    useState(false);
  const [createFormResetKey, setCreateFormResetKey] = useState(0);
  const [editCatalogNumber, setEditCatalogNumber] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editManufacturerName, setEditManufacturerName] = useState("");
  const [editUnitId, setEditUnitId] = useState("");
  const [editPrimaryCategoryId, setEditPrimaryCategoryId] = useState("");
  const [editSecondaryCategoryId, setEditSecondaryCategoryId] = useState("");
  const [editDefaultLocationId, setEditDefaultLocationId] = useState("");
  const [editActiveTab, setEditActiveTab] = useState<PartDialogTab>("details");
  const [editDetailsContentHeight, setEditDetailsContentHeight] =
    useState<number | null>(null);
  const [editAttributeValues, setEditAttributeValues] = useState<
    Record<string, string>
  >({});
  const [editFieldErrors, setEditFieldErrors] = useState<PartFormErrors>({});
  const [editingPart, setEditingPart] = useState<PartsListItem | null>(null);
  const [partPendingDelete, setPartPendingDelete] =
    useState<PartsListItem | null>(null);
  const [partForStockDialog, setPartForStockDialog] = useState<PartsListItem | null>(
    null
  );
  const [partForPODialog, setPartForPODialog] = useState<PartsListItem | null>(null);
  const [partForSLDialog, setPartForSLDialog] = useState<PartsListItem | null>(null);
  const [selectedPartId, setSelectedPartId] = useState<string | null>(
    initialSelectedPartId ?? null
  );
  const {
    width: detailsPanelWidth,
    hasLoaded: hasLoadedDetailsPanelWidth,
    startResizing: startResizingDetailsPanel
  } = useDetailsPanelWidth(`oso:parts-details-panel-width:${workspaceSlug}`, 384);
  const listColumns = useMemo(
    () =>
      buildPartsListColumnDefs({
        copy: {
          categories: copy.categories,
          manufacturer: copy.manufacturer,
          catalogNumber: copy.catalogNumber,
          description: copy.description,
          value: copy.value,
          stock: copy.stock,
          planned: copy.planned,
          onOrder: copy.onOrder,
          avgNetCost: copy.avgNetCost,
          avgGrossCost: copy.avgGrossCost,
          defaultLocation: copy.defaultLocation
        },
        canReadInventory,
        canReadShoppingLists,
        canReadPurchaseOrders,
        workspaceAttributes
      }),
    [canReadInventory, canReadShoppingLists, canReadPurchaseOrders, copy, workspaceAttributes]
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
    isLoaded: isListConfigurationLoaded
  } = useListTableConfiguration({
    storageKey: `oso:list-config:parts:${workspaceSlug}`,
    columns: listColumns,
    fixedColumnIds: fixedListColumnIds
  });
  const {
    currentParts,
    partsCounts,
    hasActiveFilters,
    isLoading: partsQueryIsLoading,
    isError: partsQueryIsError,
    isFetchingNextPage: partsQueryIsFetchingNextPage,
    hasNextPage: partsQueryHasNextPage,
    fetchNextPage: partsQueryFetchNextPage,
    searchQuery,
    setSearchQuery,
    categoryFilterId,
    setCategoryFilterId,
    manufacturerFilter,
    setManufacturerFilter,
    clearFilters
  } = usePartsListQuery({
    workspaceSlug,
    sorting,
    initialPage,
    enabled: isDatabaseAvailable
  });

  const createHasAttributesTab =
    getPartAttributeGroups({
      categoryAttributesByCategoryId,
      copy,
      partCategories,
      selectedPrimaryCategoryId: createPrimaryCategoryId,
      selectedSecondaryCategoryId: createSecondaryCategoryId
    }).attributes.length > 0;
  const editHasAttributesTab =
    getPartAttributeGroups({
      categoryAttributesByCategoryId,
      copy,
      partCategories,
      selectedPrimaryCategoryId: editPrimaryCategoryId,
      selectedSecondaryCategoryId: editSecondaryCategoryId
    }).attributes.length > 0;
  const currentPartsById = useMemo(
    () => new Map(currentParts.map((part) => [part.id, part])),
    [currentParts]
  );
  const selectedPart = selectedPartId
    ? currentPartsById.get(selectedPartId) ?? null
    : null;
  async function refreshPartsLists() {
    await queryClient.invalidateQueries({
      queryKey: ["parts-list", workspaceSlug]
    });
  }

  async function getSuggestionSourceAttributesForMatching(input: {
    catalogNumber: string;
    sourceAttributes: Array<{ name: string; value: string; unit: string | null }>;
  }) {
    const result = await getSupplierPartAttributesForWorkspace({
      workspaceSlug,
      catalogNumber: input.catalogNumber
    });

    if (!result.ok) {
      return input.sourceAttributes;
    }

    return result.sourceAttributes;
  }
  const createPartMutation = useMutation({
    mutationFn: createPart,
    onError: () => {
      setCreateFieldErrors({
        submit: getPartFormErrorMessage(copy, "database-unavailable")
      });
    },
    onSuccess: async (result) => {
      if (!result.ok) {
        const nextErrors = getPartFormErrors(copy, result.error);
        setCreateFieldErrors(nextErrors);
        const firstErrorTab = getFirstTabWithErrors(nextErrors);

        if (firstErrorTab) {
          setCreateActiveTab(firstErrorTab);
        }

        return;
      }

      await refreshPartsLists();
      addManufacturerSuggestion(result.part.manufacturerName);
      setCreateCatalogNumber("");
      setCreateDescription("");
      setCreateManufacturerName("");
      setCreatePrimaryCategoryId("");
      setCreateSecondaryCategoryId("");
      setCreateActiveTab("details");
      setCreateAttributeValues({});
      setCreateSupplierMatchingPayload("");
      setCreateFieldErrors({});
      setCreateFormResetKey((currentKey) => currentKey + 1);
      addToastMessage({
        id: getNextToastId(nextToastIdRef),
        message: getPartSuccessMessage(copy.createdToast, result.part)
      });
      closeDialog(createDialogRef.current);
    }
  });
  const updatePartMutation = useMutation({
    mutationFn: updatePart,
    onError: () => {
      setEditFieldErrors({
        submit: getPartFormErrorMessage(copy, "database-unavailable")
      });
    },
    onSuccess: async (result) => {
      if (!result.ok) {
        const nextErrors = getPartFormErrors(copy, result.error);
        setEditFieldErrors(nextErrors);
        const firstErrorTab = getFirstTabWithErrors(nextErrors);

        if (firstErrorTab) {
          setEditActiveTab(firstErrorTab);
        }

        setPartPendingDelete(null);
        return;
      }

      await refreshPartsLists();
      addManufacturerSuggestion(result.part.manufacturerName);
      setEditingPart(result.part);
      setEditDescription(result.part.description ?? "");
      setEditManufacturerName(result.part.manufacturerName);
      setEditActiveTab("details");
      setEditAttributeValues(getPartAttributeValueState(result.part));
      setEditFieldErrors({});
      addToastMessage({
        id: getNextToastId(nextToastIdRef),
        message: getPartSuccessMessage(copy.updatedToast, result.part)
      });
      closeDialog(editDialogRef.current);
    }
  });
  const deletePartMutation = useMutation({
    mutationFn: deletePart,
    onError: () => {
      setEditFieldErrors({
        delete: getPartFormErrorMessage(copy, "database-unavailable")
      });
    },
    onSuccess: async (result) => {
      if (!result.ok) {
        setEditFieldErrors({ delete: getPartFormErrorMessage(copy, result.error) });
        return;
      }

      const deletedPart =
        currentPartsById.get(result.id) ?? partPendingDelete ?? editingPart;
      await refreshPartsLists();
      setEditingPart(null);
      setPartPendingDelete(null);
      setEditFieldErrors({});

      if (deletedPart) {
        addToastMessage({
          id: getNextToastId(nextToastIdRef),
          message: getPartSuccessMessage(copy.deletedToast, deletedPart)
        });
      }

      closeDialog(editDialogRef.current);
    }
  });
  const columns = useMemo(() => buildPartsListColumns({
    mode: "full",
    copy: {
      noCategory: copy.noCategory,
      categories: copy.categories,
      manufacturer: copy.manufacturer,
      catalogNumber: copy.catalogNumber,
      description: copy.description,
      value: copy.value,
      stock: copy.stock,
      planned: copy.planned,
      onOrder: copy.onOrder,
      avgNetCost: copy.avgNetCost,
      avgGrossCost: copy.avgGrossCost,
      defaultLocation: copy.defaultLocation,
      editPart: copy.editPart,
      deletePart: copy.deletePart,
      addToPurchaseOrder: copy.addToPurchaseOrder,
      addToShoppingList: copy.addToShoppingList
    },
    canReadInventory,
    canReadShoppingLists,
    canReadPurchaseOrders,
    workspaceAttributes,
    isDatabaseAvailable,
    isDeletePending: deletePartMutation.isPending,
    canWriteShoppingLists,
    canWritePurchaseOrders,
    onEditPart: openEditDialog,
    onDeletePart: handleDeletePart,
    onAddToPO: canWritePurchaseOrders ? (part) => setPartForPODialog(part) : undefined,
    onAddToSL: canWriteShoppingLists ? (part) => setPartForSLDialog(part) : undefined
  }), [
    canReadInventory,
    canReadShoppingLists,
    canReadPurchaseOrders,
    canWriteShoppingLists,
    canWritePurchaseOrders,
    copy,
    deletePartMutation.isPending,
    isDatabaseAvailable,
    workspaceAttributes
  ]);
  const tableColumnOrder = useMemo(
    () => persistedColumnOrder,
    [persistedColumnOrder]
  );
  // TanStack Table intentionally returns dynamic helpers that React Compiler cannot memoize.
  // eslint-disable-next-line react-hooks/incompatible-library
  const partsTable = useReactTable({
    data: currentParts,
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
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: undefined
  });

  useEffect(() => {
    if (!createHasAttributesTab && createActiveTab === "attributes") {
      setCreateActiveTab("details");
    }
  }, [createActiveTab, createHasAttributesTab]);

  useEffect(() => {
    if (!editHasAttributesTab && editActiveTab === "attributes") {
      setEditActiveTab("details");
    }
  }, [editActiveTab, editHasAttributesTab]);

  useLayoutEffect(() => {
    if (createActiveTab !== "details") {
      return undefined;
    }

    return observeDialogContentHeight(
      createDetailsContentRef.current,
      setCreateDetailsContentHeight
    );
  }, [createActiveTab]);

  useLayoutEffect(() => {
    if (editActiveTab !== "details") {
      return undefined;
    }

    return observeDialogContentHeight(
      editDetailsContentRef.current,
      setEditDetailsContentHeight
    );
  }, [editActiveTab, editingPart]);

  useEffect(() => {
    if (!selectedPartId || currentPartsById.has(selectedPartId)) {
      return;
    }

    setSelectedPartId(null);
    syncSelectedPartInUrl(null);
  }, [currentPartsById, selectedPartId]);

  useEffect(() => {
    if (partDialogOpen) {
      openDialog(createDialogRef.current);
    }
  }, [partDialogOpen]);

  useEffect(() => {
    if (!partEditDialog) {
      return;
    }

    const part = currentParts.find(
      (currentPart) => currentPart.id === partEditDialog
    );

    if (!part) {
      return;
    }

    window.requestAnimationFrame(() => {
      setEditingPart(part);
      setEditCatalogNumber(part.catalogNumber);
      setEditDescription(part.description ?? "");
      setEditManufacturerName(part.manufacturerName);
      setEditUnitId(part.unitId);
      setEditPrimaryCategoryId(part.primaryCategoryId ?? "");
      setEditSecondaryCategoryId(part.secondaryCategoryId ?? "");
      setEditDefaultLocationId(part.defaultLocationId ?? "");
      setEditAttributeValues(getPartAttributeValueState(part));
      setEditActiveTab("details");
      openDialog(editDialogRef.current);
    });
  }, [partEditDialog, currentParts]);

  function openEditDialog(part: PartsListItem) {
    setEditingPart(part);
    setEditCatalogNumber(part.catalogNumber);
    setEditDescription(part.description ?? "");
    setEditManufacturerName(part.manufacturerName);
    setEditUnitId(part.unitId);
    setEditPrimaryCategoryId(part.primaryCategoryId ?? "");
    setEditSecondaryCategoryId(part.secondaryCategoryId ?? "");
    setEditDefaultLocationId(part.defaultLocationId ?? "");
    setEditAttributeValues(getPartAttributeValueState(part));
    setEditActiveTab("details");
    setEditFieldErrors({});
    window.requestAnimationFrame(() => openDialog(editDialogRef.current));
  }

  function openCreateDialog() {
    const defaultPrimaryCategoryId = getCreatePrimaryCategoryFromFilter({
      categories: partCategories,
      categoryFilterId
    });

    setCreateCatalogNumber("");
    setCreateDescription("");
    setCreateManufacturerName("");
    setCreateUnitId("");
    setCreatePrimaryCategoryId(defaultPrimaryCategoryId);
    setCreateSecondaryCategoryId("");
    setCreateDefaultLocationId("");
    setCreateActiveTab("details");
    setCreateAttributeValues({});
    setCreateSupplierMatchingPayload("");
    setCreateFieldErrors({});
    setCreateFormResetKey((currentKey) => currentKey + 1);
    openDialog(createDialogRef.current);
  }

  function closeEditPartDialog() {
    closeDialog(editDialogRef.current);
    setEditingPart(null);
    setEditFieldErrors({});
  }

  function syncSelectedPartInUrl(nextPartId: string | null) {
    const url = new URL(window.location.href);
    if (nextPartId) {
      url.searchParams.set("selectedPartId", nextPartId);
    } else {
      url.searchParams.delete("selectedPartId");
    }
    window.history.replaceState(null, "", url.toString());
  }

  function openPartDetails(part: PartsListItem) {
    setSelectedPartId(part.id);
    syncSelectedPartInUrl(part.id);
  }

  function closePartDetails() {
    setSelectedPartId(null);
    syncSelectedPartInUrl(null);
  }

  const selectedPartBalancesQuery = useQuery({
    queryKey: ["part-balances", workspaceSlug, selectedPartId, "details-panel"],
    enabled: Boolean(selectedPartId) && canReadInventory,
    queryFn: async () => {
      const result = await getPartBalancesForWorkspace({
        workspaceSlug,
        partId: selectedPartId as string
      });

      if (!result.ok) {
        throw new Error(result.error);
      }

      return result.data;
    }
  });

  const partInventoryHistoryQuery = useQuery({
    queryKey: ["part-inventory-history", workspaceSlug, selectedPartId],
    enabled: Boolean(selectedPartId) && canReadInventory,
    queryFn: async () => {
      const result = await getPartInventoryHistoryForWorkspace({
        workspaceSlug,
        partId: selectedPartId as string
      });

      if (!result.ok) {
        throw new Error(result.error);
      }

      return result.data;
    }
  });

  const partPurchaseOrderHistoryQuery = useQuery({
    queryKey: ["part-po-history", workspaceSlug, selectedPartId],
    enabled: Boolean(selectedPartId) && canReadPurchaseOrders,
    queryFn: async () => {
      const result = await getPartPurchaseOrderHistoryForWorkspace({
        workspaceSlug,
        partId: selectedPartId as string
      });
      if (!result.ok) throw new Error(result.error);
      return result.data;
    }
  });

  const partShoppingListMembershipQuery = useQuery({
    queryKey: ["part-sl-membership", workspaceSlug, selectedPartId],
    enabled: Boolean(selectedPartId) && canReadShoppingLists,
    queryFn: async () => {
      const result = await getPartShoppingListMembershipForWorkspace({
        workspaceSlug,
        partId: selectedPartId as string
      });
      if (!result.ok) throw new Error(result.error);
      return result.data;
    }
  });

  const dialogLocationsQuery = useQuery({
    queryKey: ["locations-all", workspaceSlug, "part-dialog"],
    queryFn: async () => {
      const result = await getLocationsForWorkspace({ workspaceSlug });
      if (!result.ok) throw new Error(result.error);
      return result.data;
    }
  });
  const dialogLocations = useMemo(
    () => (dialogLocationsQuery.data ?? []).filter((l) => !l.isArchived),
    [dialogLocationsQuery.data]
  );
  const dialogLocationTree = useMemo(() => buildTree(dialogLocations), [dialogLocations]);

  const detailsPanelLocationsQuery = useQuery({
    queryKey: ["locations-all", workspaceSlug, "details-panel"],
    enabled: Boolean(selectedPartId) && canReadInventory,
    queryFn: async () => {
      const result = await getLocationsForWorkspace({ workspaceSlug });

      if (!result.ok) {
        throw new Error(result.error);
      }

      return result.data;
    }
  });

  const selectedPartLocationRows = useMemo(() => {
    const locationNameById = new Map(
      (detailsPanelLocationsQuery.data ?? []).map((location) => [
        location.id,
        location.name
      ])
    );

    return (selectedPartBalancesQuery.data ?? [])
      .map((row) => ({
        locationId: row.locationId,
        locationName: locationNameById.get(row.locationId) ?? row.locationId,
        quantity: row.quantity
      }))
      .sort((left, right) =>
        left.locationName.localeCompare(right.locationName, "en")
      );
  }, [detailsPanelLocationsQuery.data, selectedPartBalancesQuery.data]);

  async function openMatchingDialogFromSupplierResult(input: {
    provider: SupplierProviderKey;
    sourceManufacturerName: string;
    sourceCategory: string | null;
    sourceAttributes: Array<{ name: string; value: string; unit: string | null }>;
  }) {
    const hasDataToMap =
      Boolean(input.sourceCategory?.trim()) ||
      input.sourceAttributes.some((attribute) => attribute.value.trim().length > 0);

    if (!hasDataToMap) {
      return;
    }

    try {
      const initialResult = await getSupplierMatchingSuggestionsForWorkspace({
        workspaceSlug,
        provider: input.provider,
        sourceManufacturerName: input.sourceManufacturerName,
        sourceCategory: input.sourceCategory,
        sourceAttributes: input.sourceAttributes.map((attribute) => ({
          sourceAttribute: attribute.name,
          sourceValue: attribute.value,
          sourceUnit: attribute.unit
        })),
        targetCategoryId: null
      });

      if (!initialResult.ok) {
        return;
      }

      const targetCategoryId = initialResult.payload.suggestedTargetCategoryId ?? "";
      let attributeRows = initialResult.payload.attributeRows;

      if (targetCategoryId) {
        const scopedResult = await getSupplierMatchingSuggestionsForWorkspace({
          workspaceSlug,
          provider: input.provider,
          sourceManufacturerName: input.sourceManufacturerName,
          sourceCategory: input.sourceCategory,
          sourceAttributes: input.sourceAttributes.map((attribute) => ({
            sourceAttribute: attribute.name,
            sourceValue: attribute.value,
            sourceUnit: attribute.unit
          })),
          targetCategoryId
        });

        if (scopedResult.ok) {
          attributeRows = scopedResult.payload.attributeRows;
        }
      }

      const rows = attributeRows.map((row) => ({
        sourceAttribute: row.sourceAttribute,
        sourceAttributeName: row.sourceAttributeName,
        sourceUnit: row.sourceUnit,
        sourceAttributeKey: row.sourceAttributeKey,
        sourceValue: row.sourceValue,
        targetAttributeId: row.suggestedTargetAttributeId ?? "",
        targetValue: row.sourceValue
      }));

      const filteredRows = applySuggestedTargetAttributes({
        categoryAttributesByCategoryId,
        globalWorkspaceAttributesForMatching,
        targetCategoryId,
        rows
      });

      setMatchingState({
        provider: input.provider,
        sourceManufacturerName: input.sourceManufacturerName,
        targetManufacturerName:
          initialResult.payload.suggestedTargetManufacturerName ??
          input.sourceManufacturerName,
        sourceCategory: input.sourceCategory,
        sourceCategoryKey: initialResult.payload.sourceCategoryKey,
        targetCategoryId,
        rows: filteredRows
      });
      setSkipMatchingPendingConfirmation(false);
      window.requestAnimationFrame(() => openDialog(matchingDialogRef.current));
    } catch {
      // Keep supplier autofill behavior even when suggestions fail.
    }
  }

  async function handleMatchingTargetCategoryChange(targetCategoryId: string) {
    if (!matchingState) {
      return;
    }

    try {
      const suggestionResult = await getSupplierMatchingSuggestionsForWorkspace({
        workspaceSlug,
        provider: matchingState.provider,
        sourceManufacturerName: matchingState.sourceManufacturerName,
        sourceCategory: matchingState.sourceCategory,
        sourceAttributes: matchingState.rows.map((row) => ({
          sourceAttribute: row.sourceAttributeName,
          sourceValue: row.sourceValue,
          sourceUnit: row.sourceUnit
        })),
        targetCategoryId: targetCategoryId || null
      });

      if (!suggestionResult.ok) {
        return;
      }

      const suggestedByKey = new Map(
        suggestionResult.payload.attributeRows
          .filter((row) => row.suggestedTargetAttributeId)
          .map((row) => [row.sourceAttributeKey, row.suggestedTargetAttributeId!])
      );

      setMatchingState((current) => {
        if (!current) {
          return current;
        }

        const nextRows = applySuggestedTargetAttributes({
          categoryAttributesByCategoryId,
          globalWorkspaceAttributesForMatching,
          targetCategoryId,
          rows: current.rows.map((row) => ({
            ...row,
            targetAttributeId:
              suggestedByKey.get(row.sourceAttributeKey) ??
              row.targetAttributeId,
            targetValue: row.sourceValue
          }))
        });

        return {
          ...current,
          targetCategoryId,
          targetManufacturerName: current.targetManufacturerName,
          rows: nextRows
        };
      });
    } catch {
      // no-op
    }
  }

  function handleCreateSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const fieldErrors = validatePartForm(copy, {
      catalogNumber: createCatalogNumber,
      manufacturerName: createManufacturerName,
      unitId: createUnitId
    });

    setCreateFieldErrors(fieldErrors);
    const firstErrorTab = getFirstTabWithErrors(fieldErrors);

    if (firstErrorTab) {
      setCreateActiveTab(firstErrorTab);
    }

    if (hasFieldErrors(fieldErrors)) {
      return;
    }

    formData.set("catalogNumber", createCatalogNumber);
    formData.set("manufacturerName", createManufacturerName);
    formData.set("unitId", createUnitId);
    formData.set("description", createDescription);
    formData.set("primaryCategoryId", createPrimaryCategoryId);
    formData.set("secondaryCategoryId", createSecondaryCategoryId);
    formData.set("defaultLocationId", createDefaultLocationId);

    createPartMutation.mutate(formData);
  }

  function handleUpdateSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const fieldErrors = validatePartForm(copy, {
      catalogNumber: editCatalogNumber,
      manufacturerName: editManufacturerName,
      unitId: editUnitId
    });

    setEditFieldErrors(fieldErrors);
    const firstErrorTab = getFirstTabWithErrors(fieldErrors);

    if (firstErrorTab) {
      setEditActiveTab(firstErrorTab);
    }

    if (hasFieldErrors(fieldErrors)) {
      return;
    }

    formData.set("catalogNumber", editCatalogNumber);
    formData.set("manufacturerName", editManufacturerName);
    formData.set("unitId", editUnitId);
    formData.set("description", editDescription);
    formData.set("primaryCategoryId", editPrimaryCategoryId);
    formData.set("secondaryCategoryId", editSecondaryCategoryId);
    formData.set("defaultLocationId", editDefaultLocationId);

    updatePartMutation.mutate(formData);
  }

  function handleDeletePart(part: PartsListItem) {
    setEditFieldErrors((currentErrors) => {
      const nextErrors = { ...currentErrors };
      delete nextErrors.delete;
      return nextErrors;
    });
    setPartPendingDelete(part);
  }

  function confirmDeletePart() {
    if (!partPendingDelete) {
      return;
    }

    const formData = new FormData();
    formData.set("workspaceSlug", workspaceSlug);
    formData.set("id", partPendingDelete.id);
    setEditFieldErrors({});
    deletePartMutation.mutate(formData);
  }

  function addManufacturerSuggestion(manufacturerName: string) {
    setCurrentManufacturerSuggestions((currentSuggestions) => {
      if (
        currentSuggestions.some(
          (suggestion) => suggestion.name === manufacturerName
        )
      ) {
        return currentSuggestions;
      }

      return [
        ...currentSuggestions,
        { id: manufacturerName, name: manufacturerName }
      ].sort((left, right) =>
          left.name.localeCompare(right.name, "en", { sensitivity: "base" })
        );
    });
  }

  function addToastMessage(toast: ToastMessage) {
    setToastMessages((currentMessages) => [...currentMessages, toast]);
  }

  function dismissToastMessage(toastId: number) {
    setToastMessages((currentMessages) =>
      currentMessages.filter((toast) => toast.id !== toastId)
    );
  }

  function handleMatchingTargetAttributeChange(
    rowIndex: number,
    nextTargetAttributeId: string
  ) {
    setMatchingState((current) => {
      if (!current) {
        return current;
      }

      const previousRowIndex = current.rows.findIndex(
        (row, index) =>
          index !== rowIndex && row.targetAttributeId === nextTargetAttributeId
      );

      if (nextTargetAttributeId && previousRowIndex >= 0) {
        setMatchingRowPendingReassign({
          nextRowIndex: rowIndex,
          nextTargetAttributeId,
          previousRowIndex
        });
        return current;
      }

      const nextRows = [...current.rows];
      nextRows[rowIndex] = {
        ...nextRows[rowIndex],
        targetAttributeId: nextTargetAttributeId,
        targetValue: nextTargetAttributeId ? nextRows[rowIndex].sourceValue : ""
      };

      return { ...current, rows: nextRows };
    });
  }

  function handleMatchingTargetValueChange(rowIndex: number, targetValue: string) {
    setMatchingState((current) => {
      if (!current) {
        return current;
      }

      const nextRows = [...current.rows];
      nextRows[rowIndex] = {
        ...nextRows[rowIndex],
        targetValue
      };

      return { ...current, rows: nextRows };
    });
  }

  function confirmMatchingReassignment() {
    if (!matchingRowPendingReassign) {
      return;
    }

    setMatchingState((current) => {
      if (!current) {
        return current;
      }

      const nextRows = [...current.rows];
      const { nextRowIndex, nextTargetAttributeId, previousRowIndex } =
        matchingRowPendingReassign;
      nextRows[previousRowIndex] = {
        ...nextRows[previousRowIndex],
        targetAttributeId: "",
        targetValue: ""
      };
      nextRows[nextRowIndex] = {
        ...nextRows[nextRowIndex],
        targetAttributeId: nextTargetAttributeId,
        targetValue: nextRows[nextRowIndex].sourceValue
      };

      return { ...current, rows: nextRows };
    });

    setMatchingRowPendingReassign(null);
  }

  function applyMatchingToPartForm() {
    if (!matchingState) {
      closeDialog(matchingDialogRef.current);
      return;
    }

    const nextAttributeValues: Record<string, string> = {};

    for (const row of matchingState.rows) {
      if (!row.targetAttributeId) {
        continue;
      }

      nextAttributeValues[row.targetAttributeId] = row.targetValue;
    }

    setCreateSupplierMatchingPayload(
      JSON.stringify({
        mode: "create-from-suggestion",
        provider: matchingState.provider,
        sourceCategoryKey: matchingState.sourceCategoryKey,
        sourceManufacturerKey:
          normalizeSupplierMatchingKey(matchingState.sourceManufacturerName),
        targetCategoryId: matchingState.targetCategoryId || null,
        attributeMappings: matchingState.rows
          .filter((row) => row.targetAttributeId)
          .map((row) => ({
            sourceAttributeKey: row.sourceAttributeKey,
            targetAttributeId: row.targetAttributeId
          }))
      })
    );

    setCreateAttributeValues((current) => ({
      ...current,
      ...nextAttributeValues
    }));
    setCreateManufacturerName(matchingState.targetManufacturerName);
    clearPartFieldError(setCreateFieldErrors, "manufacturerName");
    setCreatePrimaryCategoryId(matchingState.targetCategoryId);
    setCreateSecondaryCategoryId("");
    closeDialog(matchingDialogRef.current);
  }

  function toggleColumnSorting(columnId: string) {
    const currentSort = sorting.find((item) => item.id === columnId);
    if (!currentSort) {
      setColumnSorting(columnId, "asc");
      return;
    }

    if (!currentSort.desc) {
      setColumnSorting(columnId, "desc");
      return;
    }

    setColumnSorting(columnId, "none");
  }

  return (
    <>
      <div className="flex min-h-0 flex-1 gap-4">
        <section
          aria-labelledby="parts-heading"
          className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm"
        >
        <h2 id="parts-heading" className="sr-only">
          {copy.title}
        </h2>
        <ListPageToolbar
          columnGroups={[{ groupId: "attribute", label: copy.attributeColumns }]}
          clearFiltersLabel={copy.clearFilters}
          columnVisibility={columnVisibility}
          configurableColumns={configurableColumns}
          configureListLabel={copy.configureList}
          filteredCount={partsCounts.filteredCount}
          formatCount={(visible, total) =>
            formatFilteredPartsSummary(copy, { visible, total })
          }
          hasActiveFilters={hasActiveFilters}
          totalCount={partsCounts.totalCount}
          visibleColumnsLabel={copy.visibleColumns}
          setColumnVisible={setColumnVisible}
          onClearFilters={clearFilters}
          filterContent={
            <PartsListFilters
              copy={copy}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              categoryFilterId={categoryFilterId}
              onCategoryChange={setCategoryFilterId}
              manufacturerFilter={manufacturerFilter}
              onManufacturerChange={setManufacturerFilter}
              partCategories={partCategories}
              manufacturerOptions={currentManufacturerSuggestions}
              disabled={!isDatabaseAvailable}
            />
          }
          primaryAction={
            <button
              className={primaryButtonClassName}
              disabled={!isDatabaseAvailable}
              type="button"
              onClick={openCreateDialog}
            >
              {copy.addPart}
            </button>
          }
        />
        <PartsListTable
          table={partsTable}
          columnDefs={listColumns}
          setColumnSorting={setColumnSorting}
          setColumnWidth={setColumnWidth}
          hasNextPage={partsQueryHasNextPage}
          isFetchingNextPage={partsQueryIsFetchingNextPage}
          isInitialLoading={partsQueryIsLoading || !isListConfigurationLoaded}
          isError={partsQueryIsError}
          isEmpty={currentParts.length === 0}
          loadMore={partsQueryFetchNextPage}
          loadingLabel={copy.loadingParts}
          loadingMoreLabel={copy.loadingMoreParts}
          emptyState={
            <div className="px-4 py-10">
              <p className="text-base font-medium text-slate-950">
                {hasActiveFilters ? copy.noMatchingPartsTitle : copy.emptyTitle}
              </p>
              <p className="mt-2 max-w-xl text-sm leading-6 text-slate-500">
                {hasActiveFilters ? copy.noMatchingPartsBody : copy.emptyBody}
              </p>
            </div>
          }
          errorState={
            <p className="p-6 text-sm text-slate-500">
              {copy.databaseUnavailable}
            </p>
          }
          testId="parts-list-viewport"
          onRowClick={openPartDetails}
          getRowHighlightClass={(part) =>
            part.id === selectedPartId ? "bg-slate-100" : ""
          }
          setColumnOrder={setColumnOrder}
        />
        </section>
        {selectedPart && hasLoadedDetailsPanelWidth ? (
          <DetailPanel
            closeLabel={copy.close}
            subtitle={
              <>
                <span>{selectedPart.manufacturerName}</span>
                {selectedPart.description ? (
                  <span className="mt-1 block">{selectedPart.description}</span>
                ) : null}
              </>
            }
            title={
              <span className="font-mono">{selectedPart.catalogNumber}</span>
            }
            width={detailsPanelWidth}
            onClose={closePartDetails}
            onStartResize={startResizingDetailsPanel}
          >
              <section className="grid gap-2">
                <h3 className="text-sm font-semibold text-slate-900">
                  {copy.attributes}
                </h3>
                {selectedPart.attributeValues.length === 0 ? (
                  <p className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
                    {copy.noAttributes}
                  </p>
                ) : (
                  <div className="overflow-hidden rounded-md border border-slate-200">
                    <table className="w-full table-fixed text-left text-sm">
                      <thead className="bg-slate-50 text-slate-600">
                        <tr>
                          <th className="px-3 py-2 font-semibold">Attribute</th>
                          <th className="px-3 py-2 font-semibold">Value</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedPart.attributeValues.map((attributeValue) => {
                          const attributeName =
                            workspaceAttributes.find(
                              (attribute) =>
                                attribute.id === attributeValue.attributeId
                            )?.name ?? attributeValue.attributeId;

                          return (
                            <tr
                              key={attributeValue.attributeId}
                              className="border-t border-slate-100"
                            >
                              <td className="px-3 py-2 text-slate-700">
                                {attributeName}
                              </td>
                              <td className="px-3 py-2 text-slate-900">
                                {attributeValue.displayValue}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
              {canReadInventory ? (
                <section className="grid gap-2">
                  <h3 className="text-sm font-semibold text-slate-900">
                    {copy.locationsAndStock}
                  </h3>
                  {selectedPartBalancesQuery.isLoading ||
                  detailsPanelLocationsQuery.isLoading ? (
                    <p className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
                      {copy.loadingParts}
                    </p>
                  ) : selectedPartBalancesQuery.isError ||
                    detailsPanelLocationsQuery.isError ? (
                    <p className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
                      {copy.databaseUnavailable}
                    </p>
                  ) : selectedPartLocationRows.length === 0 ? (
                    <p className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
                      {copy.noLocations}
                    </p>
                  ) : (
                    <div className="overflow-hidden rounded-md border border-slate-200">
                      <table className="w-full table-fixed text-left text-sm">
                        <thead className="bg-slate-50 text-slate-600">
                          <tr>
                            <th className="px-3 py-2 font-semibold">Location</th>
                            <th className="px-3 py-2 font-semibold">Stock</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedPartLocationRows.map((row) => (
                            <tr
                              key={row.locationId}
                              className="border-t border-slate-100"
                            >
                              <td className="px-3 py-2 text-slate-700">
                                {row.locationName}
                              </td>
                              <td className="px-3 py-2 font-semibold text-slate-950">
                                {row.quantity}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                  {canWriteInventory ? (
                    <div className="pt-2">
                      <button
                        className="min-h-8 rounded-md border border-slate-300 bg-white px-2.5 py-1 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400"
                        disabled={!isDatabaseAvailable}
                        type="button"
                        onClick={() => setPartForStockDialog(selectedPart)}
                      >
                        {copy.addMovement}
                      </button>
                    </div>
                  ) : null}
                </section>
              ) : null}
              {canReadInventory ? (
                <section className="grid gap-2">
                  <h3 className="text-sm font-semibold text-slate-900">
                    {copy.movementHistory}
                  </h3>
                  {partInventoryHistoryQuery.isLoading ? (
                    <p className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
                      {copy.loadingParts}
                    </p>
                  ) : partInventoryHistoryQuery.isError ? (
                    <p className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
                      {copy.databaseUnavailable}
                    </p>
                  ) : (partInventoryHistoryQuery.data ?? []).length === 0 ? (
                    <p className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
                      {copy.noHistory}
                    </p>
                  ) : (
                    <div className="max-h-64 overflow-y-auto rounded-md border border-slate-200">
                      <table className="w-full text-left text-sm">
                        <thead className="sticky top-0 bg-slate-50 text-slate-600">
                          <tr>
                            <th className="px-3 py-2 font-semibold">{copy.historyColType}</th>
                            <th className="px-3 py-2 font-semibold">{copy.historyColQuantity}</th>
                            <th className="px-3 py-2 font-semibold">{copy.historyColLocation}</th>
                            <th className="px-3 py-2 font-semibold">{copy.historyColDate}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(partInventoryHistoryQuery.data ?? []).map((entry) => (
                            <tr key={entry.id} className="border-t border-slate-100 first:border-t-0">
                              <td className="px-3 py-2 align-top">
                                <span className="inline-block rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs font-medium text-slate-700">
                                  {entry.entryType}
                                </span>
                              </td>
                              <td className="px-3 py-2 align-top font-semibold tabular-nums text-slate-950">
                                {entry.quantity}
                              </td>
                              <td className="px-3 py-2 align-top text-slate-600">
                                {[entry.fromLocationName, entry.toLocationName]
                                  .filter(Boolean)
                                  .join(" → ") || null}
                                {entry.note ? (
                                  <p className="text-xs text-slate-400">{entry.note}</p>
                                ) : null}
                              </td>
                              <td className="whitespace-nowrap px-3 py-2 align-top text-xs text-slate-400">
                                {new Date(entry.createdAt).toLocaleDateString()}
                                {entry.authorName ? (
                                  <p>{entry.authorName}</p>
                                ) : null}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>
              ) : null}
              {canReadPurchaseOrders ? (
                <section className="grid gap-2">
                  <h3 className="text-sm font-semibold text-slate-900">
                    {copy.poHistory}
                  </h3>
                  {partPurchaseOrderHistoryQuery.isLoading ? (
                    <p className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
                      {copy.loadingParts}
                    </p>
                  ) : partPurchaseOrderHistoryQuery.isError ? (
                    <p className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
                      {copy.databaseUnavailable}
                    </p>
                  ) : (partPurchaseOrderHistoryQuery.data ?? []).length === 0 ? (
                    <p className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
                      {copy.noPurchaseOrders}
                    </p>
                  ) : (
                    <div className="max-h-64 overflow-y-auto rounded-md border border-slate-200">
                      <table className="w-full text-left text-sm">
                        <thead className="sticky top-0 bg-slate-50 text-slate-600">
                          <tr>
                            <th className="px-3 py-2 font-semibold">{copy.poHistoryColOrder}</th>
                            <th className="px-3 py-2 font-semibold">{copy.poHistoryColSupplier}</th>
                            <th className="px-3 py-2 font-semibold">{copy.poHistoryColStatus}</th>
                            <th className="px-3 py-2 font-semibold">{copy.poHistoryColDate}</th>
                            <th className="px-3 py-2 text-right font-semibold">{copy.poHistoryColQty}</th>
                            <th className="px-3 py-2 text-right font-semibold">{copy.poHistoryColUnitPriceNet}</th>
                            <th className="px-3 py-2 text-right font-semibold">{copy.poHistoryColUnitPriceGross}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(partPurchaseOrderHistoryQuery.data ?? []).map((entry: PartPurchaseOrderHistoryItem) => (
                            <tr key={`${entry.orderId}`} className="border-t border-slate-100 first:border-t-0">
                              <td className="px-3 py-2 align-middle font-mono text-xs text-slate-700">
                                {entry.orderNumber ?? entry.orderId.slice(0, 8)}
                              </td>
                              <td className="px-3 py-2 align-middle text-slate-700">
                                {entry.supplierName}
                              </td>
                              <td className="px-3 py-2 align-middle">
                                <span className={[
                                  "inline-block rounded px-1.5 py-0.5 font-mono text-xs font-medium",
                                  entry.status === "RECEIVED"
                                    ? "bg-green-100 text-green-800"
                                    : entry.status === "ORDERED"
                                      ? "bg-amber-100 text-amber-800"
                                      : "bg-slate-100 text-slate-700"
                                ].join(" ")}>
                                  {entry.status}
                                </span>
                              </td>
                              <td className="whitespace-nowrap px-3 py-2 align-middle text-xs text-slate-400">
                                {entry.orderedAt
                                  ? new Date(entry.orderedAt).toLocaleDateString()
                                  : "—"}
                              </td>
                              <td className="px-3 py-2 align-middle text-right tabular-nums text-slate-950">
                                {entry.quantity}
                              </td>
                              <td className="px-3 py-2 align-middle text-right tabular-nums text-slate-700">
                                {entry.unitPriceNetPrimary != null ? (
                                  <>
                                    <span>{entry.unitPriceNetPrimary} {primaryCurrency}</span>
                                    {entry.currency && entry.currency !== primaryCurrency && entry.unitPriceNet != null ? (
                                      <p className="text-xs text-slate-400">{entry.unitPriceNet} {entry.currency}</p>
                                    ) : null}
                                  </>
                                ) : entry.unitPriceNet != null ? (
                                  <span>{entry.unitPriceNet}{entry.currency ? ` ${entry.currency}` : ""}</span>
                                ) : "—"}
                              </td>
                              <td className="px-3 py-2 align-middle text-right tabular-nums text-slate-700">
                                {entry.unitPriceGrossPrimary != null ? (
                                  <>
                                    <span>{entry.unitPriceGrossPrimary} {primaryCurrency}</span>
                                    {entry.currency && entry.currency !== primaryCurrency && entry.unitPriceGross != null ? (
                                      <p className="text-xs text-slate-400">{entry.unitPriceGross} {entry.currency}</p>
                                    ) : null}
                                  </>
                                ) : entry.unitPriceGross != null ? (
                                  <span>{entry.unitPriceGross}{entry.currency ? ` ${entry.currency}` : ""}</span>
                                ) : "—"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                  {canWritePurchaseOrders ? (
                    <div className="pt-2">
                      <button
                        className="min-h-8 rounded-md border border-slate-300 bg-white px-2.5 py-1 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400"
                        disabled={!isDatabaseAvailable}
                        type="button"
                        onClick={() => setPartForPODialog(selectedPart)}
                      >
                        {copy.addToPurchaseOrder}
                      </button>
                    </div>
                  ) : null}
                </section>
              ) : null}
              {canReadShoppingLists ? (
                <section className="grid gap-2">
                  <h3 className="text-sm font-semibold text-slate-900">
                    {copy.shoppingLists}
                  </h3>
                  {partShoppingListMembershipQuery.isLoading ? (
                    <p className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
                      {copy.loadingParts}
                    </p>
                  ) : partShoppingListMembershipQuery.isError ? (
                    <p className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
                      {copy.databaseUnavailable}
                    </p>
                  ) : (partShoppingListMembershipQuery.data ?? []).length === 0 ? (
                    <p className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
                      {copy.noShoppingLists}
                    </p>
                  ) : (
                    <div className="max-h-64 overflow-y-auto rounded-md border border-slate-200">
                      <table className="w-full text-left text-sm">
                        <thead className="sticky top-0 bg-slate-50 text-slate-600">
                          <tr>
                            <th className="px-3 py-2 font-semibold">{copy.slMembershipColList}</th>
                            <th className="px-3 py-2 text-right font-semibold">{copy.slMembershipColQty}</th>
                            <th className="px-3 py-2 font-semibold">{copy.slMembershipColNotes}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(partShoppingListMembershipQuery.data ?? []).map((entry: PartShoppingListMembershipItem) => (
                            <tr key={entry.shoppingListId} className="border-t border-slate-100 first:border-t-0">
                              <td className="px-3 py-2 align-middle">
                                <a
                                  href={`/w/${encodeURIComponent(workspaceSlug)}/shopping-lists?selectedListId=${entry.shoppingListId}`}
                                  className="text-accent hover:underline"
                                >
                                  {entry.shoppingListName}
                                </a>
                              </td>
                              <td className="px-3 py-2 align-middle text-right tabular-nums text-slate-950">
                                {entry.quantity}
                              </td>
                              <td className="px-3 py-2 align-middle text-slate-500">
                                {entry.notes ?? "—"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                  {canWriteShoppingLists ? (
                    <div className="pt-2">
                      <button
                        className="min-h-8 rounded-md border border-slate-300 bg-white px-2.5 py-1 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400"
                        disabled={!isDatabaseAvailable}
                        type="button"
                        onClick={() => setPartForSLDialog(selectedPart)}
                      >
                        {copy.addToShoppingList}
                      </button>
                    </div>
                  ) : null}
                </section>
              ) : null}
          </DetailPanel>
        ) : null}
      </div>

      <ToastNotice messages={toastMessages} onDismiss={dismissToastMessage} />

      <DialogShell
        ref={createDialogRef}
        closeLabel={copy.close}
        description={copy.newPartBody}
        title={copy.newPartTitle}
        titleId="add-part-dialog-title"
        widthClassName="w-[min(58rem,calc(100vw-3rem))]"
      >
          <form
            className="flex min-h-0 flex-1 flex-col overflow-hidden"
            onSubmit={handleCreateSubmit}
          >
            <input name="workspaceSlug" type="hidden" value={workspaceSlug} />
            <input
              name="supplierMatchingPayload"
              type="hidden"
              value={
                createSupplierMatchingPayload ||
                getSupplierMatchingPayloadValue(matchingState)
              }
            />
            <PartAttributeHiddenInputs
              attributeValues={createAttributeValues}
              categoryAttributesByCategoryId={categoryAttributesByCategoryId}
              part={null}
              partCategories={partCategories}
              selectedPrimaryCategoryId={createPrimaryCategoryId}
              selectedSecondaryCategoryId={createSecondaryCategoryId}
            />
            <div className="shrink-0 border-b border-slate-200 px-5 pt-4">
              <PartDialogTabs
                activeTab={createActiveTab}
                copy={copy}
                showAttributesTab={createHasAttributesTab}
                onTabChange={setCreateActiveTab}
              />
            </div>
            <DialogBody
              className="flex-[0_1_auto]"
              style={getDialogBodyHeightStyle(createDetailsContentHeight)}
            >
              {createActiveTab === "details" ? (
                <div
                  ref={createDetailsContentRef}
                  className="grid gap-3 pr-1"
                >
                  <PartDetailsFields
                    catalogNumber={createCatalogNumber}
                    catalogNumberInputId="create-catalog-number"
                    categoryTree={categoryTree}
                    copy={copy}
                    disabled={!isDatabaseAvailable}
                    description={createDescription}
                    descriptionInputId="create-description"
                    errors={createFieldErrors}
                    formResetKey={createFormResetKey}
                    manufacturerInputId="create-manufacturer-name"
                    manufacturerName={createManufacturerName}
                    unitId={createUnitId}
                    units={units}
                    manufacturerSuggestions={currentManufacturerSuggestions}
                    partCategories={partCategories}
                    primaryCategoryId={createPrimaryCategoryId}
                    secondaryCategoryId={createSecondaryCategoryId}
                    defaultLocationId={createDefaultLocationId}
                    dialogLocations={dialogLocations}
                    dialogLocationTree={dialogLocationTree}
                    onDefaultLocationChange={setCreateDefaultLocationId}
                    onCatalogNumberChange={(value) => {
                      setCreateCatalogNumber(value);
                      clearPartFieldError(setCreateFieldErrors, "catalogNumber");
                    }}
                    onDescriptionChange={setCreateDescription}
                    onManufacturerNameChange={(value) => {
                      setCreateManufacturerName(value);
                      clearPartFieldError(setCreateFieldErrors, "manufacturerName");
                    }}
                    onUnitIdChange={(value) => {
                      setCreateUnitId(value);
                      clearPartFieldError(setCreateFieldErrors, "unitId");
                    }}
                    onSupplierSuggestionSelect={(suggestion) => {
                      setCreateCatalogNumber(suggestion.catalogNumber);
                      setCreateManufacturerName(suggestion.manufacturerName);
                      setCreateDescription(suggestion.description);
                      void (async () => {
                        const sourceAttributes =
                          await getSuggestionSourceAttributesForMatching({
                            catalogNumber: suggestion.catalogNumber,
                            sourceAttributes: suggestion.sourceAttributes
                          });

                        await openMatchingDialogFromSupplierResult({
                          provider: activeSupplierProvider ?? "digikey",
                          sourceManufacturerName: suggestion.manufacturerName,
                          sourceCategory: suggestion.sourceCategory,
                          sourceAttributes
                        });
                      })();
                    }}
                    workspaceSlug={workspaceSlug}
                    activeSupplierProvider={activeSupplierProvider}
                    onPrimaryCategoryChange={(categoryId) => {
                      setCreatePrimaryCategoryId(categoryId);
                      setCreateSecondaryCategoryId("");
                      clearPartFieldError(setCreateFieldErrors, "primaryCategoryId");
                      clearPartFieldError(setCreateFieldErrors, "secondaryCategoryId");
                    }}
                    onSecondaryCategoryChange={(categoryId) => {
                      setCreateSecondaryCategoryId(categoryId);
                      clearPartFieldError(setCreateFieldErrors, "secondaryCategoryId");
                    }}
                  />
                  <PartAttributeSections
                    categoryAttributesByCategoryId={
                      categoryAttributesByCategoryId
                    }
                    partCategories={partCategories}
                    copy={copy}
                    disabled={!isDatabaseAvailable}
                    part={null}
                    selectedPrimaryCategoryId={createPrimaryCategoryId}
                    selectedSecondaryCategoryId={createSecondaryCategoryId}
                    tab="details"
                    values={createAttributeValues}
                    onValueChange={(attributeId, value) =>
                      setCreateAttributeValues((currentValues) => ({
                        ...currentValues,
                        [attributeId]: value
                      }))
                    }
                  />
                </div>
              ) : null}
              {createActiveTab === "attributes" ? (
                <div className="grid gap-3 pr-1">
                  <PartAttributeSections
                    categoryAttributesByCategoryId={
                      categoryAttributesByCategoryId
                    }
                    partCategories={partCategories}
                    copy={copy}
                    disabled={!isDatabaseAvailable}
                    part={null}
                    selectedPrimaryCategoryId={createPrimaryCategoryId}
                    selectedSecondaryCategoryId={createSecondaryCategoryId}
                    tab="attributes"
                    values={createAttributeValues}
                    onValueChange={(attributeId, value) =>
                      setCreateAttributeValues((currentValues) => ({
                        ...currentValues,
                        [attributeId]: value
                      }))
                    }
                  />
                </div>
              ) : null}
            </DialogBody>
            <DialogFooter className="items-center justify-end gap-3">
              <div className="relative">
                <ErrorBubble>{createFieldErrors.submit}</ErrorBubble>
                <button
                  className={primaryButtonClassName}
                  type="submit"
                  disabled={!isDatabaseAvailable || createPartMutation.isPending}
                >
                  {copy.createPart}
                </button>
              </div>
            </DialogFooter>
          </form>
      </DialogShell>

      <DialogShell
        ref={matchingDialogRef}
        closeLabel={copy.close}
        description={copy.matchingDialogBody}
        onCancel={(event) => {
          event.preventDefault();
          setSkipMatchingPendingConfirmation(true);
        }}
        onCloseClick={(event) => {
          event.preventDefault();
          setSkipMatchingPendingConfirmation(true);
        }}
        title={copy.matchingDialogTitle}
        titleId="supplier-matching-dialog-title"
        widthClassName="w-[min(68rem,calc(100vw-3rem))]"
      >
        {matchingState ? (
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <DialogBody>
              <div className="grid gap-4">
                <div className="grid grid-cols-2 gap-3">
                  <label className="grid gap-2 text-sm font-medium text-slate-700">
                    {copy.sourceManufacturerLabel}
                    <div className="min-h-10 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                      {matchingState.sourceManufacturerName}
                    </div>
                  </label>
                  <ManufacturerAutocomplete
                    compact
                    disabled={!isDatabaseAvailable}
                    inputId="matching-target-manufacturer"
                    label={copy.targetManufacturerLabel}
                    noMatchingLabel={copy.noMatchingManufacturers}
                    name="matchingTargetManufacturerName"
                    placeholder={copy.manufacturerPlaceholder}
                    suggestions={currentManufacturerSuggestions}
                    value={matchingState.targetManufacturerName}
                    onValueChange={(value) =>
                      setMatchingState((current) =>
                        current
                          ? {
                              ...current,
                              targetManufacturerName: value
                            }
                          : current
                      )
                    }
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <label className="grid gap-2 text-sm font-medium text-slate-700">
                    {copy.sourceCategoryLabel}
                    <div className="min-h-10 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                      {matchingState.sourceCategory?.trim() || copy.noCategory}
                    </div>
                  </label>
                  <CategoryTreeSelect
                    categories={partCategories}
                    categoryTree={categoryTree}
                    copy={copy}
                    disabled={!isDatabaseAvailable}
                    label={copy.targetCategoryLabel}
                    name="matchingTargetCategoryId"
                    noSelectionLabel={copy.noCategory}
                    selectedId={matchingState.targetCategoryId}
                    onSelectedIdChange={(nextCategoryId) => {
                      void handleMatchingTargetCategoryChange(nextCategoryId);
                    }}
                  />
                </div>
                <div className="overflow-hidden rounded-md border border-slate-200">
                  <table className="w-full table-fixed text-left text-sm">
                    <thead className="bg-slate-50 text-slate-600">
                      <tr>
                        <th className="px-3 py-2 font-semibold">{copy.sourceAttributeLabel}</th>
                        <th className="px-3 py-2 font-semibold">{copy.sourceValueLabel}</th>
                        <th className="px-3 py-2 font-semibold">{copy.targetAttributeLabel}</th>
                        <th className="px-3 py-2 font-semibold">{copy.targetValueLabel}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {matchingState.rows.map((row, rowIndex) => {
                        const availableAttributes = getMatchingTargetAttributes({
                          categoryAttributesByCategoryId,
                          globalWorkspaceAttributesForMatching,
                          targetCategoryId: matchingState.targetCategoryId
                        });
                        const selectedAttribute = availableAttributes.find(
                          (attribute) => attribute.id === row.targetAttributeId
                        );
                        const canEditTargetValue = Boolean(selectedAttribute);

                        return (
                          <tr key={`${row.sourceAttributeKey}-${rowIndex}`} className="border-t border-slate-100">
                            <td className="px-3 py-2 text-slate-700">{row.sourceAttribute}</td>
                            <td className="px-3 py-2 font-mono text-slate-950">{row.sourceValue}</td>
                            <td className="px-3 py-2">
                              <select
                                className="min-h-9 w-full rounded-md border border-slate-300 bg-white px-2 py-1 text-sm text-slate-950"
                                value={row.targetAttributeId}
                                onChange={(event) =>
                                  handleMatchingTargetAttributeChange(
                                    rowIndex,
                                    event.currentTarget.value
                                  )
                                }
                              >
                                <option value="">{copy.noAttribute}</option>
                                {availableAttributes.map((attribute) => (
                                  <option key={attribute.id} value={attribute.id}>
                                    {attribute.name}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td className="px-3 py-2">
                              {canEditTargetValue && selectedAttribute ? (
                                selectedAttribute.type === "BOOLEAN" ? (
                                  <select
                                    className="min-h-9 w-full rounded-md border border-slate-300 bg-white px-2 py-1 text-sm text-slate-950"
                                    value={row.targetValue}
                                    onChange={(event) =>
                                      handleMatchingTargetValueChange(
                                        rowIndex,
                                        event.currentTarget.value
                                      )
                                    }
                                  >
                                    <option value="">-</option>
                                    <option value="Yes">Yes</option>
                                    <option value="No">No</option>
                                  </select>
                                ) : selectedAttribute.type === "CHOICE" ? (
                                  <select
                                    className="min-h-9 w-full rounded-md border border-slate-300 bg-white px-2 py-1 text-sm text-slate-950"
                                    value={row.targetValue}
                                    onChange={(event) =>
                                      handleMatchingTargetValueChange(
                                        rowIndex,
                                        event.currentTarget.value
                                      )
                                    }
                                  >
                                    <option value="">-</option>
                                    {selectedAttribute.choiceOptions.map((choiceOption) => (
                                      <option key={choiceOption.id} value={choiceOption.label}>
                                        {choiceOption.label}
                                      </option>
                                    ))}
                                  </select>
                                ) : (
                                  <input
                                    className="min-h-9 w-full rounded-md border border-slate-300 bg-white px-2 py-1 text-sm text-slate-950"
                                    type={selectedAttribute.type === "NUMBER" ? "number" : "text"}
                                    value={row.targetValue}
                                    onChange={(event) =>
                                      handleMatchingTargetValueChange(
                                        rowIndex,
                                        event.currentTarget.value
                                      )
                                    }
                                  />
                                )
                              ) : null}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </DialogBody>
            <DialogFooter className="justify-between gap-3">
              <button
                className="min-h-9 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700"
                type="button"
                onClick={() => setSkipMatchingPendingConfirmation(true)}
              >
                {copy.skipMatching}
              </button>
              <button className={primaryButtonClassName} type="button" onClick={applyMatchingToPartForm}>
                {copy.saveChanges}
              </button>
            </DialogFooter>
          </div>
        ) : null}
      </DialogShell>

      <DialogShell
        ref={editDialogRef}
        closeLabel={copy.close}
        description={copy.editPartBody}
        title={copy.editPartTitle}
        titleId="edit-part-dialog-title"
        widthClassName="w-[min(58rem,calc(100vw-3rem))]"
        onClose={closeEditPartDialog}
      >
          {editingPart ? (
            <form
              className="flex min-h-0 flex-1 flex-col overflow-hidden"
              onSubmit={handleUpdateSubmit}
            >
              <input name="workspaceSlug" type="hidden" value={workspaceSlug} />
              <input name="id" type="hidden" value={editingPart.id} />
              <PartAttributeHiddenInputs
                attributeValues={editAttributeValues}
                categoryAttributesByCategoryId={categoryAttributesByCategoryId}
                part={editingPart}
                partCategories={partCategories}
                selectedPrimaryCategoryId={editPrimaryCategoryId}
                selectedSecondaryCategoryId={editSecondaryCategoryId}
              />
              <div className="shrink-0 border-b border-slate-200 px-5 pt-4">
                <PartDialogTabs
                  activeTab={editActiveTab}
                  copy={copy}
                  showAttributesTab={editHasAttributesTab}
                  onTabChange={setEditActiveTab}
                />
              </div>
              <DialogBody
                className="flex-[0_1_auto]"
                style={getDialogBodyHeightStyle(editDetailsContentHeight)}
              >
                {editActiveTab === "details" ? (
                  <div
                    ref={editDetailsContentRef}
                    className="grid gap-3 pr-1"
                  >
                    <PartDetailsFields
                      catalogNumber={editCatalogNumber}
                      catalogNumberInputId="edit-catalog-number"
                      categoryTree={categoryTree}
                      copy={copy}
                      disabled={!isDatabaseAvailable}
                      description={editDescription}
                      descriptionInputId="edit-description"
                      errors={editFieldErrors}
                      formResetKey={`${editingPart.id}-${editingPart.manufacturerName}`}
                      manufacturerInputId="edit-manufacturer-name"
                      manufacturerName={editManufacturerName}
                      unitId={editUnitId}
                      units={units}
                      manufacturerSuggestions={currentManufacturerSuggestions}
                      partCategories={partCategories}
                      primaryCategoryId={editPrimaryCategoryId}
                      secondaryCategoryId={editSecondaryCategoryId}
                      defaultLocationId={editDefaultLocationId}
                      dialogLocations={dialogLocations}
                      dialogLocationTree={dialogLocationTree}
                      onDefaultLocationChange={setEditDefaultLocationId}
                      onCatalogNumberChange={(value) => {
                        setEditCatalogNumber(value);
                        clearPartFieldError(setEditFieldErrors, "catalogNumber");
                      }}
                      onDescriptionChange={setEditDescription}
                      onManufacturerNameChange={(value) => {
                        setEditManufacturerName(value);
                        clearPartFieldError(setEditFieldErrors, "manufacturerName");
                      }}
                      onUnitIdChange={(value) => {
                        setEditUnitId(value);
                        clearPartFieldError(setEditFieldErrors, "unitId");
                      }}
                      onSupplierSuggestionSelect={() => {
                        // Supplier suggestions are disabled in edit mode.
                      }}
                      workspaceSlug={workspaceSlug}
                      activeSupplierProvider={null}
                      onPrimaryCategoryChange={(categoryId) => {
                        setEditPrimaryCategoryId(categoryId);
                        clearPartFieldError(setEditFieldErrors, "primaryCategoryId");

                        if (
                          !categoryId ||
                          editSecondaryCategoryId === categoryId
                        ) {
                          setEditSecondaryCategoryId("");
                          clearPartFieldError(
                            setEditFieldErrors,
                            "secondaryCategoryId"
                          );
                        }
                      }}
                      onSecondaryCategoryChange={(categoryId) => {
                        setEditSecondaryCategoryId(categoryId);
                        clearPartFieldError(setEditFieldErrors, "secondaryCategoryId");
                      }}
                    />
                    <PartAttributeSections
                      categoryAttributesByCategoryId={
                        categoryAttributesByCategoryId
                      }
                      partCategories={partCategories}
                      copy={copy}
                      disabled={!isDatabaseAvailable}
                      part={editingPart}
                      selectedPrimaryCategoryId={editPrimaryCategoryId}
                      selectedSecondaryCategoryId={editSecondaryCategoryId}
                      tab="details"
                      values={editAttributeValues}
                      onValueChange={(attributeId, value) =>
                        setEditAttributeValues((currentValues) => ({
                          ...currentValues,
                          [attributeId]: value
                        }))
                      }
                    />
                  </div>
                ) : null}
                {editActiveTab === "attributes" ? (
                  <div className="grid gap-3 pr-1">
                    <PartAttributeSections
                      categoryAttributesByCategoryId={
                        categoryAttributesByCategoryId
                      }
                      partCategories={partCategories}
                      copy={copy}
                      disabled={!isDatabaseAvailable}
                      part={editingPart}
                      selectedPrimaryCategoryId={editPrimaryCategoryId}
                      selectedSecondaryCategoryId={editSecondaryCategoryId}
                      tab="attributes"
                      values={editAttributeValues}
                      onValueChange={(attributeId, value) =>
                        setEditAttributeValues((currentValues) => ({
                          ...currentValues,
                          [attributeId]: value
                        }))
                      }
                    />
                  </div>
                ) : null}
              </DialogBody>
              <DialogFooter className="items-center justify-between gap-3">
                <button
                  className="min-h-9 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400"
                  disabled={!isDatabaseAvailable || deletePartMutation.isPending}
                  type="button"
                  onClick={closeEditPartDialog}
                >
                  {copy.cancelDelete}
                </button>
                <div className="relative">
                  <ErrorBubble>{editFieldErrors.submit}</ErrorBubble>
                  <button
                    className={primaryButtonClassName}
                    type="submit"
                    disabled={
                      !isDatabaseAvailable ||
                      updatePartMutation.isPending ||
                      deletePartMutation.isPending
                    }
                  >
                    {copy.saveChanges}
                  </button>
                </div>
              </DialogFooter>
            </form>
          ) : null}
      </DialogShell>
      {editFieldErrors.delete ? (
        <div className="mt-3">
          <ErrorBubble align="start">{editFieldErrors.delete}</ErrorBubble>
        </div>
      ) : null}
      <DeleteConfirmationDialog
        body={copy.deleteConfirmationBody}
        cancelLabel={copy.cancelDelete}
        closeLabel={copy.close}
        confirmLabel={copy.confirmDelete}
        deleteLabel={copy.deletePart}
        isPending={deletePartMutation.isPending}
        itemName={
          partPendingDelete
            ? `${partPendingDelete.manufacturerName} ${partPendingDelete.catalogNumber}`
            : ""
        }
        open={Boolean(partPendingDelete)}
        onCancel={() => setPartPendingDelete(null)}
        onConfirm={confirmDeletePart}
      />

      <PartStockDialog
        canReadInventory={canReadInventory}
        canWriteInventory={canWriteInventory}
        copy={copy}
        open={Boolean(partForStockDialog)}
        part={partForStockDialog}
        workspaceSlug={workspaceSlug}
        onClose={() => setPartForStockDialog(null)}
      />
      <QuickAddToPODialog
        copy={copy}
        open={Boolean(partForPODialog)}
        part={partForPODialog}
        workspaceSlug={workspaceSlug}
        onClose={() => setPartForPODialog(null)}
        onSuccess={(msg) => {
          addToastMessage({ id: getNextToastId(nextToastIdRef), message: msg });
          setPartForPODialog(null);
          queryClient.invalidateQueries({ queryKey: ["part-po-history", workspaceSlug] });
          queryClient.invalidateQueries({ queryKey: ["draft-pos", workspaceSlug] });
        }}
      />
      <QuickAddToSLDialog
        copy={copy}
        open={Boolean(partForSLDialog)}
        part={partForSLDialog}
        workspaceSlug={workspaceSlug}
        onClose={() => setPartForSLDialog(null)}
        onSuccess={(msg) => {
          addToastMessage({ id: getNextToastId(nextToastIdRef), message: msg });
          setPartForSLDialog(null);
          queryClient.invalidateQueries({ queryKey: ["part-sl-membership", workspaceSlug] });
          queryClient.invalidateQueries({ queryKey: ["all-sls", workspaceSlug] });
        }}
      />
      <DeleteConfirmationDialog
        body={`${copy.confirmSkipMatchingBody} ${copy.noLearningSaved}`}
        cancelLabel={copy.keepMatching}
        closeLabel={copy.close}
        confirmLabel={copy.skipAndContinue}
        deleteLabel={copy.skipMatching}
        isPending={false}
        itemName=""
        open={skipMatchingPendingConfirmation}
        onCancel={() => setSkipMatchingPendingConfirmation(false)}
        onConfirm={() => {
          setSkipMatchingPendingConfirmation(false);
          setMatchingState(null);
          closeDialog(matchingDialogRef.current);
        }}
      />
      <DeleteConfirmationDialog
        body={copy.reassignBody}
        cancelLabel={copy.cancelAction}
        closeLabel={copy.close}
        confirmLabel={copy.reassignAction}
        deleteLabel={copy.reassignTitle}
        isPending={false}
        itemName=""
        open={Boolean(matchingRowPendingReassign)}
        onCancel={() => setMatchingRowPendingReassign(null)}
        onConfirm={confirmMatchingReassignment}
      />
    </>
  );
}

function getPartSuccessMessage(actionLabel: string, part: PartsListItem) {
  return `${actionLabel}: ${part.manufacturerName} ${part.catalogNumber}.`;
}

function getMatchingTargetAttributes({
  categoryAttributesByCategoryId,
  globalWorkspaceAttributesForMatching,
  targetCategoryId
}: {
  categoryAttributesByCategoryId: Record<string, EffectiveCategoryAttribute[]>;
  globalWorkspaceAttributesForMatching: AttributeListItem[];
  targetCategoryId: string;
}) {
  const globalById = new Map(
    globalWorkspaceAttributesForMatching.map((attribute) => [
      attribute.id,
      attribute
    ])
  );
  const categoryById = new Map(
    (targetCategoryId
      ? (categoryAttributesByCategoryId[targetCategoryId] ?? []).map(
          (entry) => entry.attribute
        )
      : []
    ).map((attribute) => [attribute.id, attribute])
  );
  const merged = new Map([...globalById, ...categoryById]);

  return [...merged.values()].sort((left, right) =>
    left.name.localeCompare(right.name, "en", { sensitivity: "base" })
  );
}

function applySuggestedTargetAttributes({
  categoryAttributesByCategoryId,
  globalWorkspaceAttributesForMatching,
  targetCategoryId,
  rows
}: {
  categoryAttributesByCategoryId: Record<string, EffectiveCategoryAttribute[]>;
  globalWorkspaceAttributesForMatching: AttributeListItem[];
  targetCategoryId: string;
  rows: Array<{
    sourceAttribute: string;
    sourceAttributeName: string;
    sourceUnit: string | null;
    sourceAttributeKey: string;
    sourceValue: string;
    targetAttributeId: string;
    targetValue: string;
  }>;
}) {
  const availableAttributeIds = new Set(
    getMatchingTargetAttributes({
      categoryAttributesByCategoryId,
      globalWorkspaceAttributesForMatching,
      targetCategoryId
    }).map((attribute) => attribute.id)
  );
  const used = new Set<string>();

  return rows.map((row) => {
    const targetAttributeId =
      row.targetAttributeId && availableAttributeIds.has(row.targetAttributeId)
        ? row.targetAttributeId
        : "";

    if (!targetAttributeId || used.has(targetAttributeId)) {
      return {
        ...row,
        targetAttributeId: "",
        targetValue: ""
      };
    }

    used.add(targetAttributeId);

    return {
      ...row,
      targetAttributeId,
      targetValue: row.sourceValue
    };
  });
}

function getSupplierMatchingPayloadValue(state: MatchingDialogState | null) {
  if (!state) {
    return "";
  }

  return JSON.stringify({
    mode: "create-from-suggestion",
    provider: state.provider,
    sourceCategoryKey: state.sourceCategoryKey,
    sourceManufacturerKey: normalizeSupplierMatchingKey(
      state.sourceManufacturerName
    ),
    targetCategoryId: state.targetCategoryId || null,
    attributeMappings: state.rows
      .filter((row) => row.targetAttributeId)
      .map((row) => ({
        sourceAttributeKey: row.sourceAttributeKey,
        targetAttributeId: row.targetAttributeId
      }))
  });
}

function normalizeSupplierMatchingKey(value: string | null | undefined) {
  const normalized = (value ?? "")
    .trim()
    .toLocaleLowerCase("en")
    .replace(/\s+/g, " ");

  return normalized || "uncategorized";
}

function validatePartForm(
  copy: Copy,
  values: { catalogNumber: string; manufacturerName: string; unitId: string }
): PartFormErrors {
  const errors: PartFormErrors = {};

  if (!values.catalogNumber.trim()) {
    errors.catalogNumber = copy.missingCatalogNumber;
  }

  if (!values.manufacturerName.trim()) {
    errors.manufacturerName = copy.missingManufacturer;
  }

  if (!values.unitId.trim()) {
    errors.unitId = copy.missingUnit;
  }

  return errors;
}

function getPartFormErrors(copy: Copy, error: string): PartFormErrors {
  if (error === "missing-required-fields") {
    return {
      catalogNumber: copy.missingRequiredFields,
      manufacturerName: copy.missingRequiredFields,
      unitId: copy.missingRequiredFields
    };
  }

  if (error === "duplicate-part") {
    return {
      catalogNumber: copy.duplicatePart,
      manufacturerName: copy.duplicatePart
    };
  }

  if (error === "invalid-category") {
    return { primaryCategoryId: copy.invalidCategory };
  }

  if (error === "invalid-unit") {
    return { unitId: copy.missingUnit };
  }

  if (error === "secondary-without-primary") {
    return { secondaryCategoryId: copy.secondaryWithoutPrimary };
  }

  if (error === "duplicate-categories") {
    return {
      primaryCategoryId: copy.duplicateCategories,
      secondaryCategoryId: copy.duplicateCategories
    };
  }

  return { submit: getPartFormErrorMessage(copy, error) };
}

function hasFieldErrors(errors: Record<string, string | undefined>) {
  return Object.values(errors).some(Boolean);
}

function clearPartFieldError(
  setErrors: (update: SetStateAction<PartFormErrors>) => void,
  field: PartFormField
) {
  setErrors((currentErrors) => {
    if (!currentErrors[field]) {
      return currentErrors;
    }

    const nextErrors = { ...currentErrors };
    delete nextErrors[field];
    delete nextErrors.submit;
    return nextErrors;
  });
}

function getFirstTabWithErrors(errors: PartFormErrors): PartDialogTab | null {
  if (
    errors.catalogNumber ||
    errors.manufacturerName ||
    errors.unitId ||
    errors.primaryCategoryId ||
    errors.secondaryCategoryId
  ) {
    return "details";
  }

  return null;
}

function getFormValue(formData: FormData, name: string) {
  const value = formData.get(name);

  return typeof value === "string" ? value.trim() : "";
}

function getPartAttributeValueState(part: PartsListItem) {
  return Object.fromEntries(
    part.attributeValues.map((attributeValue) => [
      attributeValue.attributeId,
      attributeValue.displayValue
    ])
  );
}

function getPartFormErrorMessage(copy: Copy, error: string) {
  if (error === "missing-required-fields") {
    return copy.missingRequiredFields;
  }

  if (error === "duplicate-part") {
    return copy.duplicatePart;
  }

  if (error === "invalid-category") {
    return copy.invalidCategory;
  }

  if (error === "secondary-without-primary") {
    return copy.secondaryWithoutPrimary;
  }

  if (error === "duplicate-categories") {
    return copy.duplicateCategories;
  }

  if (error === "invalid-attribute-value") {
    return copy.invalidAttributeValue;
  }

  if (error === "invalid-default-location") {
    return copy.invalidDefaultLocation;
  }

  return copy.databaseUnavailable;
}
function PartDialogTabs({
  activeTab,
  copy,
  showAttributesTab,
  onTabChange
}: {
  activeTab: PartDialogTab;
  copy: Copy;
  showAttributesTab: boolean;
  onTabChange: (tab: PartDialogTab) => void;
}) {
  return (
    <div className="flex gap-2 border-b border-slate-200">
      <button
        className={`min-h-10 border-b-2 px-3 text-sm font-medium ${
          activeTab === "details"
            ? "border-[var(--color-accent)] text-slate-950"
            : "border-transparent text-slate-500 hover:text-slate-800"
        }`}
        type="button"
        onClick={() => onTabChange("details")}
      >
        {copy.detailsTab}
      </button>
      {showAttributesTab ? (
        <button
          className={`min-h-10 border-b-2 px-3 text-sm font-medium ${
            activeTab === "attributes"
              ? "border-[var(--color-accent)] text-slate-950"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
          type="button"
          onClick={() => onTabChange("attributes")}
        >
          {copy.attributesTab}
        </button>
      ) : null}
    </div>
  );
}

function PartDetailsFields({
  catalogNumber,
  catalogNumberInputId,
  categoryTree,
  copy,
  disabled,
  description,
  descriptionInputId,
  errors,
  formResetKey,
  manufacturerInputId,
  manufacturerName,
  unitId,
  units,
  manufacturerSuggestions,
  partCategories,
  primaryCategoryId,
  secondaryCategoryId,
  defaultLocationId,
  dialogLocations,
  dialogLocationTree,
  workspaceSlug,
  activeSupplierProvider,
  onCatalogNumberChange,
  onDescriptionChange,
  onManufacturerNameChange,
  onUnitIdChange,
  onSupplierSuggestionSelect,
  onPrimaryCategoryChange,
  onSecondaryCategoryChange,
  onDefaultLocationChange
}: {
  catalogNumber: string;
  catalogNumberInputId: string;
  categoryTree: CategoryTreeItem[];
  copy: Copy;
  disabled: boolean;
  description: string;
  descriptionInputId: string;
  errors: PartFormErrors;
  formResetKey: number | string;
  manufacturerInputId: string;
  manufacturerName: string;
  unitId: string;
  units: UnitListItem[];
  manufacturerSuggestions: ManufacturerSuggestion[];
  partCategories: PartCategoryListItem[];
  primaryCategoryId: string;
  secondaryCategoryId: string;
  defaultLocationId: string;
  dialogLocations: StorageLocationListItem[];
  dialogLocationTree: LocationTreeItem[];
  workspaceSlug: string;
  activeSupplierProvider: SupplierProviderKey | null;
  onCatalogNumberChange: (catalogNumber: string) => void;
  onDescriptionChange: (description: string) => void;
  onManufacturerNameChange: (manufacturerName: string) => void;
  onUnitIdChange: (unitId: string) => void;
  onSupplierSuggestionSelect: (suggestion: {
    manufacturerName: string;
    catalogNumber: string;
    description: string;
    sourceCategory: string | null;
    sourceAttributes: Array<{ name: string; value: string; unit: string | null }>;
  }) => void;
  onPrimaryCategoryChange: (categoryId: string) => void;
  onSecondaryCategoryChange: (categoryId: string) => void;
  onDefaultLocationChange: (locationId: string) => void;
}) {
  const digiKeyAnchorRef = useRef<HTMLDivElement>(null);
  const digiKeyPanelRef = useRef<HTMLDivElement>(null);
  const [isDigiKeyOpen, setIsDigiKeyOpen] = useState(false);
  const [suppressDigiKeyOpenOnFocus, setSuppressDigiKeyOpenOnFocus] =
    useState(false);
  const [activeDigiKeyIndex, setActiveDigiKeyIndex] = useState(0);
  const [digiKeyPanelStyle, setDigiKeyPanelStyle] = useState<CSSProperties>({});
  const [digiKeyPortalTarget, setDigiKeyPortalTarget] =
    useState<HTMLElement | null>(null);
  const debouncedCatalogNumber = useDebouncedValue(catalogNumber, 500);
  const normalizedCatalogQuery = debouncedCatalogNumber.trim();
  const hasActiveSupplierSearch = activeSupplierProvider !== null;
  const minSupplierQueryLength = activeSupplierProvider === "tme" ? 2 : 3;
  const shouldSearchDigiKey =
    hasActiveSupplierSearch &&
    !disabled &&
    normalizedCatalogQuery.length >= minSupplierQueryLength;
  const digiKeyResultsQuery = useInfiniteQuery({
    queryKey: ["digikey-search", workspaceSlug, normalizedCatalogQuery],
    enabled: shouldSearchDigiKey,
    initialPageParam: 0,
    queryFn: ({ pageParam }) =>
      searchSupplierPartsForWorkspace({
        workspaceSlug,
        query: normalizedCatalogQuery,
        limit: 10,
        offset: pageParam
      }),
    getNextPageParam: (lastPage) => {
      if (!lastPage.ok) {
        return undefined;
      }

      return lastPage.page.nextOffset ?? undefined;
    }
  });
  const digiKeyResult = digiKeyResultsQuery.data;
  const digiKeyResults =
    digiKeyResult?.pages.flatMap((page) => (page.ok ? page.page.items : [])) ?? [];
  const hasDigiKeyError = digiKeyResult?.pages.some((page) => !page.ok) ?? false;
  const activeDigiKeyResult = digiKeyResults[activeDigiKeyIndex];
  const digiKeyListboxId = `${catalogNumberInputId}-digikey-suggestions`;

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setActiveDigiKeyIndex(0);
  }, [normalizedCatalogQuery]);

  useEffect(() => {
    if (!isDigiKeyOpen || digiKeyResults.length === 0) {
      return;
    }

    const activeOption = digiKeyPanelRef.current?.querySelector<HTMLElement>(
      `#${catalogNumberInputId}-digikey-option-${activeDigiKeyIndex}`
    );

    activeOption?.scrollIntoView({
      block: "nearest"
    });
  }, [
    activeDigiKeyIndex,
    catalogNumberInputId,
    isDigiKeyOpen
  ]);

  useEffect(() => {
    if (!isDigiKeyOpen) {
      return;
    }

    function onPointerDown(event: PointerEvent) {
      if (
        event.target instanceof Node &&
        !digiKeyAnchorRef.current?.contains(event.target) &&
        !digiKeyPanelRef.current?.contains(event.target)
      ) {
        setIsDigiKeyOpen(false);
      }
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsDigiKeyOpen(false);
      }
    }

    function onReposition() {
      const nextStyle = getFloatingPanelStyle(digiKeyAnchorRef.current);
      if (nextStyle) {
        setDigiKeyPanelStyle(nextStyle);
      }
    }

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("resize", onReposition);
    window.addEventListener("scroll", onReposition, true);

    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("resize", onReposition);
      window.removeEventListener("scroll", onReposition, true);
    };
  }, [isDigiKeyOpen]);

  function handleDigiKeyListScroll(event: React.UIEvent<HTMLOListElement>) {
    const target = event.currentTarget;
    const distanceToBottom =
      target.scrollHeight - target.scrollTop - target.clientHeight;

    if (
      distanceToBottom <= 24 &&
      digiKeyResultsQuery.hasNextPage &&
      !digiKeyResultsQuery.isFetchingNextPage
    ) {
      void digiKeyResultsQuery.fetchNextPage();
    }
  }

  function updateDigiKeyOpen(nextValue: string) {
    const normalizedNextValue = nextValue.trim();
    const shouldOpen =
      hasActiveSupplierSearch &&
      !disabled &&
      normalizedNextValue.length >= minSupplierQueryLength;
    if (!shouldOpen) {
      setIsDigiKeyOpen(false);
      return;
    }

    setDigiKeyPanelStyle(getFloatingPanelStyle(digiKeyAnchorRef.current) ?? {});
    setDigiKeyPortalTarget(
      digiKeyAnchorRef.current?.closest("dialog") ?? document.body
    );
    setIsDigiKeyOpen(true);
  }

  function selectDigiKeyResult(result: {
    manufacturerName: string;
    catalogNumber: string;
    description: string;
    sourceCategory: string | null;
    sourceAttributes: Array<{ name: string; value: string; unit: string | null }>;
  }) {
    onCatalogNumberChange(result.catalogNumber);
    onManufacturerNameChange(result.manufacturerName);
    onDescriptionChange(result.description);
    onSupplierSuggestionSelect(result);
    setIsDigiKeyOpen(false);
    setActiveDigiKeyIndex(0);
    setSuppressDigiKeyOpenOnFocus(true);
  }

  function moveActiveDigiKeyResult(direction: 1 | -1) {
    if (!digiKeyResults.length) {
      return;
    }

    setActiveDigiKeyIndex(
      (activeDigiKeyIndex + direction + digiKeyResults.length) %
        digiKeyResults.length
    );
  }

  function handleCatalogNumberKeyDown(event: ReactKeyboardEvent<HTMLInputElement>) {
    if (!shouldSearchDigiKey) {
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (!isDigiKeyOpen) {
        setIsDigiKeyOpen(true);
      } else {
        moveActiveDigiKeyResult(1);
      }
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      if (!isDigiKeyOpen) {
        setIsDigiKeyOpen(true);
      } else {
        moveActiveDigiKeyResult(-1);
      }
    }

    if (event.key === "Enter" && isDigiKeyOpen && activeDigiKeyResult) {
      event.preventDefault();
      selectDigiKeyResult(activeDigiKeyResult);
    }

    if (event.key === "Escape" && isDigiKeyOpen) {
      event.preventDefault();
      setIsDigiKeyOpen(false);
    }
  }

  return (
    <div className="grid gap-3">
      <div className="grid grid-cols-2 gap-3">
        <div
          ref={digiKeyAnchorRef}
          className="relative grid gap-2 text-sm font-medium text-slate-700"
        >
          <LabelWithError htmlFor={catalogNumberInputId} error={errors.catalogNumber}>
            {copy.catalogNumber}
          </LabelWithError>
          <input
            id={catalogNumberInputId}
            name="catalogNumber"
            aria-invalid={errors.catalogNumber ? true : undefined}
            aria-activedescendant={
              isDigiKeyOpen && activeDigiKeyResult
                ? `${catalogNumberInputId}-digikey-option-${activeDigiKeyIndex}`
                : undefined
            }
            aria-autocomplete={hasActiveSupplierSearch ? "list" : undefined}
            aria-controls={isDigiKeyOpen ? digiKeyListboxId : undefined}
            aria-expanded={isDigiKeyOpen}
            autoComplete="off"
            className={getFieldInputClassName(
              "min-h-10 rounded-md border border-slate-300 bg-white px-3 py-1.5 font-mono text-sm text-slate-950 outline-none transition placeholder:text-slate-400 hover:border-slate-400 focus:border-slate-500 focus:ring-2 focus:ring-slate-200 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400",
              Boolean(errors.catalogNumber)
            )}
            placeholder={copy.catalogNumberPlaceholder}
            role={hasActiveSupplierSearch ? "combobox" : undefined}
            type="text"
            value={catalogNumber}
            disabled={disabled}
            onBlur={() => {
              setIsDigiKeyOpen(false);
            }}
            onChange={(event) => {
              const nextValue = event.target.value;
              onCatalogNumberChange(nextValue);
              setSuppressDigiKeyOpenOnFocus(false);
              updateDigiKeyOpen(nextValue);
            }}
            onFocus={(event) => {
              if (suppressDigiKeyOpenOnFocus) {
                return;
              }
              updateDigiKeyOpen(event.currentTarget.value);
            }}
            onKeyDown={handleCatalogNumberKeyDown}
          />
          {isDigiKeyOpen && shouldSearchDigiKey
            ? createPortal(
                <div
                  ref={digiKeyPanelRef}
                  id={digiKeyListboxId}
                  aria-label={copy.supplierSuggestionLabel}
                  className="fixed z-50 overflow-hidden rounded-md border border-slate-200 bg-white shadow-lg"
                  style={digiKeyPanelStyle}
                  role="listbox"
                >
                  {digiKeyResultsQuery.isLoading ? (
                    <p className="px-3 py-3 text-sm font-normal text-slate-500">
                      {copy.loadingParts}
                    </p>
                  ) : digiKeyResultsQuery.isError || hasDigiKeyError ? (
                    <p className="px-3 py-3 text-sm font-normal text-slate-500">
                      {copy.supplierSearchError}
                    </p>
                  ) : digiKeyResults.length > 0 ? (
                    <ol
                      className="max-h-56 overflow-auto p-1"
                      onScroll={handleDigiKeyListScroll}
                    >
                      {digiKeyResults.map((result, index) => (
                        <li key={`${result.manufacturerName}-${result.catalogNumber}`}>
                          <button
                            id={`${catalogNumberInputId}-digikey-option-${index}`}
                            aria-selected={index === activeDigiKeyIndex}
                            className={`w-full rounded-md px-3 py-2 text-left text-sm transition focus:outline-none focus:ring-2 focus:ring-slate-300 ${
                              index === activeDigiKeyIndex
                                ? "bg-[var(--color-accent-soft)] font-semibold text-slate-950"
                                : "text-slate-700 hover:bg-slate-50"
                            }`}
                            role="option"
                            type="button"
                            onMouseDown={(event) => event.preventDefault()}
                            onClick={() => selectDigiKeyResult(result)}
                          >
                            <span className="flex items-center justify-between gap-3">
                              <span className="font-mono text-slate-950">
                                {result.catalogNumber}
                              </span>
                              <span className="truncate text-xs font-medium uppercase tracking-wide text-slate-500">
                                {result.manufacturerName}
                              </span>
                            </span>
                            <span className="mt-1 block overflow-hidden text-ellipsis whitespace-nowrap text-xs font-normal leading-5 text-slate-600">
                              {result.description}
                            </span>
                          </button>
                        </li>
                      ))}
                      {digiKeyResultsQuery.isFetchingNextPage ? (
                        <li className="px-3 py-2 text-xs text-slate-500">
                          {copy.loadingMoreParts}
                        </li>
                      ) : null}
                    </ol>
                  ) : (
                    <p className="px-3 py-3 text-sm font-normal text-slate-500">
                      {copy.supplierNoMatchingParts}
                    </p>
                  )}
                </div>,
                digiKeyPortalTarget ?? document.body
              )
            : null}
        </div>
        <ManufacturerAutocomplete
          key={`manufacturer-${formResetKey}`}
          disabled={disabled}
          inputId={manufacturerInputId}
          label={copy.manufacturer}
          noMatchingLabel={copy.noMatchingManufacturers}
          value={manufacturerName}
          name="manufacturerName"
          placeholder={copy.manufacturerPlaceholder}
          error={errors.manufacturerName}
          suggestions={manufacturerSuggestions}
          onValueChange={onManufacturerNameChange}
        />
      </div>
      <label
        className="grid gap-2 text-sm font-medium text-slate-700"
        htmlFor={descriptionInputId}
      >
        {copy.description}
        <textarea
          className="min-h-20 resize-y rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 hover:border-slate-400 focus:border-slate-500 focus:ring-2 focus:ring-slate-200 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400"
          id={descriptionInputId}
          name="description"
          placeholder={copy.descriptionPlaceholder}
          value={description}
          disabled={disabled}
          onChange={(event) => onDescriptionChange(event.target.value)}
        />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="grid gap-2 text-sm font-medium text-slate-700">
          <LabelWithError
            error={errors.unitId}
            htmlFor={`${catalogNumberInputId}-unit`}
          >
            {copy.unit}
          </LabelWithError>
          <select
            id={`${catalogNumberInputId}-unit`}
            name="unitId"
            value={unitId}
            disabled={disabled}
            className={getFieldInputClassName(
              "min-h-10 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-950 outline-none transition hover:border-slate-400 focus:border-slate-500 focus:ring-2 focus:ring-slate-200 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400",
              Boolean(errors.unitId)
            )}
            onChange={(event) => onUnitIdChange(event.target.value)}
          >
            <option value="">{copy.unitPlaceholder}</option>
            {units.map((unit) => (
              <option key={unit.id} value={unit.id}>
                {unit.name} ({unit.symbol})
              </option>
            ))}
          </select>
        </label>
        <div className="grid gap-2 text-sm font-medium text-slate-700">
          <LabelWithError>{copy.defaultLocation}</LabelWithError>
          <LocationTreeSelect
            locations={dialogLocations}
            locationTree={dialogLocationTree}
            copy={{
              chooseLocation: copy.chooseDefaultLocation,
              searchLocations: copy.searchLocations,
              noMatchingLocations: copy.noMatchingLocations,
              expandLocation: copy.expandLocation,
              collapseLocation: copy.collapseLocation
            } satisfies LocationTreeSelectCopy}
            name="defaultLocationId-picker"
            selectedId={defaultLocationId}
            onSelectedIdChange={onDefaultLocationChange}
            clearable={true}
            buttonClassName={formLocationSelectButtonClassName}
            className="w-full"
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <CategoryTreeSelect
          categories={partCategories}
          categoryTree={categoryTree}
          copy={copy}
          disabled={disabled}
          label={copy.primaryCategory}
          name="primaryCategoryId"
          noSelectionLabel={copy.noCategory}
          selectedId={primaryCategoryId}
          error={errors.primaryCategoryId}
          onSelectedIdChange={onPrimaryCategoryChange}
        />
        <CategoryTreeSelect
          key={`secondary-${formResetKey}-${primaryCategoryId}`}
          categories={partCategories}
          categoryTree={categoryTree}
          copy={copy}
          disabled={disabled || !primaryCategoryId}
          excludedCategoryId={primaryCategoryId}
          label={copy.secondaryCategory}
          name="secondaryCategoryId"
          noSelectionLabel={copy.noSecondaryCategory}
          selectedId={secondaryCategoryId}
          error={errors.secondaryCategoryId}
          onSelectedIdChange={onSecondaryCategoryChange}
        />
      </div>
    </div>
  );
}

function PartAttributeSections({
  categoryAttributesByCategoryId,
  copy,
  disabled,
  values,
  part,
  partCategories,
  selectedPrimaryCategoryId,
  selectedSecondaryCategoryId,
  tab,
  onValueChange
}: {
  categoryAttributesByCategoryId: Record<string, EffectiveCategoryAttribute[]>;
  copy: Copy;
  disabled: boolean;
  values: Record<string, string>;
  part: PartsListItem | null;
  partCategories: PartCategoryListItem[];
  selectedPrimaryCategoryId: string;
  selectedSecondaryCategoryId: string;
  tab: PartDialogTab;
  onValueChange: (attributeId: string, value: string) => void;
}) {
  const groups = getPartAttributeGroups({
    categoryAttributesByCategoryId,
    copy,
    partCategories,
    selectedPrimaryCategoryId,
    selectedSecondaryCategoryId
  });
  const sections = tab === "details" ? groups.details : groups.attributes;
  const existingValuesByAttributeId = new Map(
    (part?.attributeValues ?? []).map((attributeValue) => [
      attributeValue.attributeId,
      attributeValue.displayValue
    ])
  );

  if (sections.length === 0) {
    return null;
  }

  return (
    <div className="grid gap-3">
      {sections.map((section) => (
        <section key={section.id}>
          <h3 className="mb-2 text-sm font-semibold text-slate-700">
            {section.title}
          </h3>
          <div className="divide-y divide-slate-100 rounded-md border border-slate-200">
            {section.attributes.map((effectiveAttribute) => (
              <PartAttributeField
                key={effectiveAttribute.attribute.id}
                compact
                disabled={disabled}
                effectiveAttribute={effectiveAttribute}
                value={getAttributeInputValue({
                  effectiveAttribute,
                  existingValuesByAttributeId,
                  values
                })}
                onValueChange={onValueChange}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function PartAttributeHiddenInputs({
  attributeValues,
  categoryAttributesByCategoryId,
  part,
  partCategories,
  selectedPrimaryCategoryId,
  selectedSecondaryCategoryId
}: {
  attributeValues: Record<string, string>;
  categoryAttributesByCategoryId: Record<string, EffectiveCategoryAttribute[]>;
  part: PartsListItem | null;
  partCategories: PartCategoryListItem[];
  selectedPrimaryCategoryId: string;
  selectedSecondaryCategoryId: string;
}) {
  const groups = getPartAttributeGroups({
    categoryAttributesByCategoryId,
    copy: null,
    partCategories,
    selectedPrimaryCategoryId,
    selectedSecondaryCategoryId
  });
  const existingValuesByAttributeId = new Map(
    (part?.attributeValues ?? []).map((attributeValue) => [
      attributeValue.attributeId,
      attributeValue.displayValue
    ])
  );
  const effectiveAttributesById = new Map<string, EffectiveCategoryAttribute>();

  for (const section of [...groups.details, ...groups.attributes]) {
    for (const effectiveAttribute of section.attributes) {
      effectiveAttributesById.set(
        effectiveAttribute.attribute.id,
        effectiveAttribute
      );
    }
  }

  return (
    <>
      {[...effectiveAttributesById.values()].map((effectiveAttribute) => (
        <input
          key={effectiveAttribute.attribute.id}
          name={`attributeValue:${effectiveAttribute.attribute.id}`}
          type="hidden"
          value={getAttributeInputValue({
            effectiveAttribute,
            existingValuesByAttributeId,
            values: attributeValues
          })}
        />
      ))}
    </>
  );
}

function getAttributeInputValue({
  effectiveAttribute,
  existingValuesByAttributeId,
  values
}: {
  effectiveAttribute: EffectiveCategoryAttribute;
  existingValuesByAttributeId: Map<string, string>;
  values: Record<string, string>;
}) {
  const attributeId = effectiveAttribute.attribute.id;

  return (
    values[attributeId] ??
    existingValuesByAttributeId.get(attributeId) ??
    effectiveAttribute.defaultValue?.displayValue ??
    ""
  );
}

function getPartAttributeGroups({
  categoryAttributesByCategoryId,
  copy,
  partCategories,
  selectedPrimaryCategoryId,
  selectedSecondaryCategoryId
}: {
  categoryAttributesByCategoryId: Record<string, EffectiveCategoryAttribute[]>;
  copy: Pick<Copy, "attributes" | "value"> | null;
  partCategories: PartCategoryListItem[];
  selectedPrimaryCategoryId: string;
  selectedSecondaryCategoryId: string;
}) {
  const primaryAttributes = selectedPrimaryCategoryId
    ? categoryAttributesByCategoryId[selectedPrimaryCategoryId] ?? []
    : [];
  const primaryAttributeIds = new Set(
    primaryAttributes.map((attribute) => attribute.attribute.id)
  );
  const secondaryAttributes = selectedSecondaryCategoryId
    ? (categoryAttributesByCategoryId[selectedSecondaryCategoryId] ?? []).filter(
        (attribute) => !primaryAttributeIds.has(attribute.attribute.id)
      )
    : [];
  const valueAttribute = primaryAttributes.find((attribute) => attribute.isValue);
  const valueAttributeId = valueAttribute?.attribute.id ?? null;
  const primaryPrimaryAttributes = primaryAttributes.filter(
    (attribute) => attribute.isPrimary && attribute.attribute.id !== valueAttributeId
  );
  const secondaryPrimaryAttributes = secondaryAttributes.filter(
    (attribute) => attribute.isPrimary
  );
  const primaryOtherAttributes = primaryAttributes.filter(
    (attribute) =>
      attribute.attribute.id !== valueAttributeId && !attribute.isPrimary
  );
  const secondaryOtherAttributes = secondaryAttributes.filter(
    (attribute) => !attribute.isPrimary
  );

  return {
    details: compactAttributeSections([
      {
        id: "value",
        title: copy?.value ?? "",
        attributes: valueAttribute ? [valueAttribute] : []
      },
      {
        id: "primary",
        title: copy?.attributes ?? "",
        attributes: [...primaryPrimaryAttributes, ...secondaryPrimaryAttributes]
      }
    ]),
    attributes: compactAttributeSections([
      {
        id: "primary-all",
        title: getCategoryAttributeSectionTitle({
          categoryId: selectedPrimaryCategoryId,
          partCategories
        }),
        attributes: [
          ...(valueAttribute ? [valueAttribute] : []),
          ...primaryPrimaryAttributes,
          ...primaryOtherAttributes
        ]
      },
      {
        id: "secondary-all",
        title: getCategoryAttributeSectionTitle({
          categoryId: selectedSecondaryCategoryId,
          partCategories
        }),
        attributes: [...secondaryPrimaryAttributes, ...secondaryOtherAttributes]
      }
    ])
  };
}

function compactAttributeSections(
  sections: Array<{
    id: string;
    title: string;
    attributes: EffectiveCategoryAttribute[];
  }>
) {
  return sections.filter((section) => section.attributes.length > 0);
}

function getCategoryAttributeSectionTitle({
  categoryId,
  partCategories
}: {
  categoryId: string;
  partCategories: PartCategoryListItem[];
}) {
  const category = partCategories.find((item) => item.id === categoryId);

  return category?.path ?? "";
}

function PartAttributeField({
  compact = false,
  disabled,
  effectiveAttribute,
  value,
  onValueChange
}: {
  compact?: boolean;
  disabled: boolean;
  effectiveAttribute: EffectiveCategoryAttribute;
  value: string;
  onValueChange: (attributeId: string, value: string) => void;
}) {
  const attribute = effectiveAttribute.attribute;
  const descriptionId = `${attribute.id}-description`;
  const commonClassName = compact
    ? "min-h-8 rounded-md border border-slate-300 bg-white px-2.5 py-1 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 hover:border-slate-400 focus:border-slate-500 focus:ring-2 focus:ring-slate-200 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400"
    : "min-h-10 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 hover:border-slate-400 focus:border-slate-500 focus:ring-2 focus:ring-slate-200 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400";

  return (
    <label
      className={
        compact
          ? "grid grid-cols-[minmax(10rem,16rem)_minmax(12rem,1fr)] items-center gap-3 px-3 py-2 text-sm font-medium text-slate-700"
          : "grid gap-1.5 p-3 text-sm font-medium text-slate-700"
      }
    >
      <span className="min-w-0">
        <span className="block truncate">{attribute.name}</span>
        {compact && attribute.description ? (
          <span
            id={descriptionId}
            className="mt-0.5 block truncate text-xs font-normal text-slate-500"
          >
            {attribute.description}
          </span>
        ) : null}
      </span>
      {attribute.type === "BOOLEAN" ? (
        <select
          aria-describedby={attribute.description ? descriptionId : undefined}
          className={commonClassName}
          disabled={disabled}
          value={value}
          onChange={(event) =>
            onValueChange(attribute.id, event.currentTarget.value)
          }
        >
          <option value="">-</option>
          <option value="Yes">Yes</option>
          <option value="No">No</option>
        </select>
      ) : attribute.type === "CHOICE" ? (
        <select
          aria-describedby={attribute.description ? descriptionId : undefined}
          className={commonClassName}
          disabled={disabled}
          value={value}
          onChange={(event) =>
            onValueChange(attribute.id, event.currentTarget.value)
          }
        >
          <option value="">-</option>
          {attribute.choiceOptions.map((choiceOption) => (
            <option key={choiceOption.id} value={choiceOption.label}>
              {choiceOption.label}
            </option>
          ))}
        </select>
      ) : (
        <input
          aria-describedby={attribute.description ? descriptionId : undefined}
          className={commonClassName}
          disabled={disabled}
          type={attribute.type === "NUMBER" ? "number" : "text"}
          value={value}
          onChange={(event) =>
            onValueChange(attribute.id, event.currentTarget.value)
          }
        />
      )}
      {!compact && attribute.description ? (
        <span
          id={descriptionId}
          className="text-xs font-normal text-slate-500"
        >
          {attribute.description}
        </span>
      ) : null}
    </label>
  );
}

const primaryButtonClassName =
  "min-h-9 rounded-md border border-[var(--color-action-primary)] bg-[var(--color-action-primary)] px-3 py-1.5 text-sm font-semibold text-white transition hover:border-[var(--color-action-primary-hover)] hover:bg-[var(--color-action-primary-hover)] focus:outline-none focus:ring-2 focus:ring-[var(--color-action-focus)] focus:ring-offset-2 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400";
