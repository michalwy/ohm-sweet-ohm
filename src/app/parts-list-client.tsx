"use client";

import type {
  CSSProperties,
  FormEvent,
  KeyboardEvent as ReactKeyboardEvent,
  SetStateAction
} from "react";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
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
import { getPartsListPageForWorkspace } from "@/server/parts/listActions";
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
  DialogActions,
  DialogBody,
  DialogFooter,
  DialogPrimaryButton,
  DialogSecondaryButton,
  DialogShell,
  LabelWithError,
  closeDialog,
  getFieldInputClassName,
  getDialogBodyHeightStyle,
  observeDialogContentHeight,
  openDialog
} from "@/app/dialog-shell";
import { PartMovementHistoryDialog } from "@/app/part-movement-history-dialog";
import { PartStockDialog } from "@/app/part-stock-dialog";
import { QuickAddToPODialog } from "@/app/part-quick-add-po-dialog";
import { QuickAddToSLDialog } from "@/app/part-quick-add-sl-dialog";
import { useDebouncedValue } from "@/app/use-debounced-value";
import { usePartsListQuery } from "@/app/use-parts-list-query";
import { useListFilterConfiguration } from "@/app/list-filter-config";
import type { FilterDefinition } from "@/app/list-filter-config";
import { useFilterUrlState } from "@/app/use-filter-url-state";
import { FilterBar } from "@/app/list-filter-bar";
import { buildPartsListColumnDefs, buildPartsListColumns } from "@/app/parts-list-columns";
import { PartsListTable } from "@/app/parts-list-table";
import { formatFilteredPartsSummary } from "@/app/parts-list-sort-utils";
import {
  CategoryTreeSelect,
  buildCategoryTree,
  compactCategorySelectButtonClassName,
  getCreatePrimaryCategoryFromFilter,
  getFloatingPanelStyle,
  type CategoryTreeItem
} from "@/app/parts-category-tree-select";
import { getPartBalancesForWorkspace } from "@/server/inventory/entryActions";
import { getLocationsForWorkspace } from "@/server/inventory/locationActions";
import type { StorageLocationListItem } from "@/server/inventory/locationMutations";
import { buildTree } from "@/app/tree-picker-utils";
import {
  LocationTreeSelect,
  formLocationSelectButtonClassName,
  type LocationTreeItem,
  type LocationTreeSelectCopy
} from "@/app/location-tree-select";
import { getPartPurchaseOrderHistoryForWorkspace } from "@/server/purchase-orders/purchaseOrderActions";
import type { PartPurchaseOrderHistoryItem } from "@/server/purchase-orders/purchaseOrderMutations";
import { getPartShoppingListMembershipForWorkspace } from "@/server/shopping-lists/shoppingListActions";
import type { PartShoppingListMembershipItem } from "@/server/shopping-lists/shoppingListMutations";
import {
  getPartBuildAllocationsForWorkspace,
  getPartProductionBuildsForWorkspace
} from "@/server/builds/buildActions";
import type { PartBuildAllocationItem, PartProductionBuildItem } from "@/server/builds/builds";
import { BUILD_STATE_BADGE_CLASS } from "@/app/builds-client";
import { BuildLink, PoLink, SlLink } from "@/app/entity-links";
import { PinnedFilterBanner } from "@/app/pinned-filter-banner";
import { DateDisplay } from "@/app/date-display";

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
  configureFilters: string;
  availableFilters: string;
  pinnedFilterLabel: string;
  clearPinnedFilter: string;
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
  source: string;
  stock: string;
  reserved: string;
  allocated: string;
  available: string;
  balance: string;
  planned: string;
  onOrder: string;
  inProduction: string;
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
  chooseLocation: string;
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
  noStock: string;
  noBalances: string;
  currentStock: string;
  stockSaved: string;
  stockActionInvalid: string;
  stockInsufficientStock: string;
  stockInvalidQuantity: string;
  stockFractionalQuantityNotAllowed: string;
  stockLocationArchived: string;
  stockLocationNotAssignable: string;
  cancel: string;
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
  deleteError: string;
  locationsAndStock: string;
  noAttributes: string;
  movementHistory: string;
  viewMovementHistory: string;
  noHistory: string;
  historyColType: string;
  historyColQuantity: string;
  historyColFrom: string;
  historyColTo: string;
  historyColNote: string;
  historyColDate: string;
  historyColAuthor: string;
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
  buildAllocations: string;
  buildAllocationsColBuild: string;
  buildAllocationsColState: string;
  buildAllocationsColAllocated: string;
  buildAllocationsColReserved: string;
  productionBuilds: string;
  productionBuildsColBuild: string;
  productionBuildsColState: string;
  productionBuildsColQty: string;
  buildStates: Record<string, string>;
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
  canReadBuilds: boolean;
  primaryCurrency: string;
  initialSelectedPartId?: string;
  initialPinnedId?: string;
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
  canReadBuilds,
  primaryCurrency,
  initialSelectedPartId,
  initialPinnedId
}: PartsListClientProps) {
  const queryClient = useQueryClient();
  const partDialogRef = useRef<HTMLDialogElement>(null);
  const matchingDialogRef = useRef<HTMLDialogElement>(null);
  const dialogDetailsContentRef = useRef<HTMLDivElement>(null);
  const nextToastIdRef = useRef(0);
  const categoryTree = buildCategoryTree(partCategories);
  const [currentManufacturerSuggestions, setCurrentManufacturerSuggestions] =
    useState(manufacturerSuggestions);
  const [toastMessages, setToastMessages] = useState<ToastMessage[]>([]);

  // Unified dialog form state
  const [dialogCatalogNumber, setDialogCatalogNumber] = useState("");
  const [dialogDescription, setDialogDescription] = useState("");
  const [dialogManufacturerName, setDialogManufacturerName] = useState("");
  const [dialogUnitId, setDialogUnitId] = useState("");
  const [dialogPrimaryCategoryId, setDialogPrimaryCategoryId] = useState("");
  const [dialogSecondaryCategoryId, setDialogSecondaryCategoryId] = useState("");
  const [dialogDefaultLocationId, setDialogDefaultLocationId] = useState("");
  const [dialogActiveTab, setDialogActiveTab] = useState<PartDialogTab>("details");
  const [dialogDetailsContentHeight, setDialogDetailsContentHeight] =
    useState<number | null>(null);
  const [dialogAttributeValues, setDialogAttributeValues] = useState<
    Record<string, string>
  >({});
  const [dialogFieldErrors, setDialogFieldErrors] = useState<PartFormErrors>({});
  const [dialogFormResetKey, setDialogFormResetKey] = useState(0);

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
  const [editingPart, setEditingPart] = useState<PartsListItem | null>(null);
  const [partPendingDelete, setPartPendingDelete] =
    useState<PartsListItem | null>(null);
  const [partForStockDialog, setPartForStockDialog] = useState<PartsListItem | null>(
    null
  );
  const [partForPODialog, setPartForPODialog] = useState<PartsListItem | null>(null);
  const [partForSLDialog, setPartForSLDialog] = useState<PartsListItem | null>(null);
  const [showHistoryDialog, setShowHistoryDialog] = useState(false);
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
          source: copy.source,
          stock: copy.stock,
          reserved: copy.reserved,
          allocated: copy.allocated,
          available: copy.available,
          balance: copy.balance,
          planned: copy.planned,
          onOrder: copy.onOrder,
          inProduction: copy.inProduction,
          avgNetCost: copy.avgNetCost,
          avgGrossCost: copy.avgGrossCost,
          defaultLocation: copy.defaultLocation
        },
        workspaceAttributes
      }),
    [copy, workspaceAttributes]
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
  // Build filter definitions for the parts list.
  // renderControl for category and manufacturer close over props data via useMemo.
  const partsFilterDefs = useMemo<FilterDefinition[]>(
    () => [
      {
        id: "search",
        label: copy.searchParts,
        type: "text",
        urlParam: "q",
        debounceMs: 300,
        alwaysVisible: true
      },
      {
        id: "category",
        label: copy.filterByCategory,
        type: "tree",
        urlParam: "categoryId",
        defaultVisible: true,
        renderControl: ({ value, onChange, disabled: controlDisabled }) =>
          partCategories.length > 0 ? (
            <div className="min-w-56">
              <CategoryTreeSelect
                allowOrganizationalCategories
                buttonClassName={compactCategorySelectButtonClassName}
                categories={partCategories}
                categoryTree={categoryTree}
                copy={copy}
                disabled={controlDisabled ?? false}
                label={copy.filterByCategory}
                name="categoryFilterId"
                noSelectionLabel={copy.allCategories}
                selectedId={value}
                onSelectedIdChange={onChange}
              />
            </div>
          ) : null
      },
      {
        id: "manufacturer",
        label: copy.filterByManufacturer,
        type: "select",
        urlParam: "manufacturer",
        debounceMs: 300,
        defaultVisible: true,
        renderControl: ({ value, onChange, disabled: controlDisabled }) => (
          <ManufacturerAutocomplete
            compact
            disabled={controlDisabled ?? false}
            inputId="manufacturer-filter"
            label={copy.filterByManufacturer}
            noMatchingLabel={copy.noMatchingManufacturers}
            name="manufacturerFilter"
            placeholder={copy.allManufacturers}
            suggestions={currentManufacturerSuggestions}
            value={value}
            onValueChange={onChange}
          />
        )
      }
    ],
    // copy, partCategories, categoryTree, and currentManufacturerSuggestions are
    // the actual data deps; including all filter def inline functions would cause
    // re-renders on every render — useMemo stabilizes the array.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [copy.searchParts, copy.filterByCategory, copy.allCategories, copy.filterByManufacturer, copy.allManufacturers, copy.noMatchingManufacturers, partCategories, categoryTree, currentManufacturerSuggestions]
  );

  const {
    filterValues,
    setFilterValue,
    clearFilterValues,
    hasActiveFilters: filterHasActiveFilters
  } = useFilterUrlState(partsFilterDefs);

  const {
    filterVisibility,
    filterOrder,
    configurableFilters,
    setFilterVisible,
    setFilterOrder
  } = useListFilterConfiguration({
    storageKey: `oso:filter-config:parts:${workspaceSlug}`,
    filters: partsFilterDefs
  });

  const {
    currentParts,
    partsCounts,
    hasActiveFilters,
    isLoading: partsQueryIsLoading,
    isPlaceholderData: partsQueryIsPlaceholderData,
    isError: partsQueryIsError,
    isFetchingNextPage: partsQueryIsFetchingNextPage,
    hasNextPage: partsQueryHasNextPage,
    fetchNextPage: partsQueryFetchNextPage,
    pinnedId,
    clearPinnedId
  } = usePartsListQuery({
    workspaceSlug,
    sorting,
    filterValues,
    initialPage,
    enabled: isDatabaseAvailable && isListConfigurationLoaded,
    initialPinnedId: initialPinnedId
  });

  const dialogHasAttributesTab =
    getPartAttributeGroups({
      categoryAttributesByCategoryId,
      copy,
      partCategories,
      selectedPrimaryCategoryId: dialogPrimaryCategoryId,
      selectedSecondaryCategoryId: dialogSecondaryCategoryId
    }).attributes.length > 0;
  const currentPartsById = useMemo(
    () => new Map(currentParts.map((part) => [part.id, part])),
    [currentParts]
  );
  // When a part is selected via URL (e.g. page refresh or entity link) but is not
  // present on the loaded list page, fetch it independently so the detail pane can
  // still render it without filtering the list down to that single part.
  const isSelectedPartInList = selectedPartId
    ? currentPartsById.has(selectedPartId)
    : false;
  const selectedPartFallbackQuery = useQuery({
    queryKey: ["part-detail", workspaceSlug, selectedPartId],
    enabled:
      Boolean(selectedPartId) &&
      isListConfigurationLoaded &&
      !isSelectedPartInList,
    queryFn: async () => {
      const result = await getPartsListPageForWorkspace({
        workspaceSlug,
        pinnedId: selectedPartId
      });
      if (!result.ok) {
        throw new Error(result.error);
      }
      return result.page.items[0] ?? null;
    }
  });
  const selectedPart = selectedPartId
    ? currentPartsById.get(selectedPartId) ??
      selectedPartFallbackQuery.data ??
      null
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
      setDialogFieldErrors({
        submit: getPartFormErrorMessage(copy, "database-unavailable")
      });
    },
    onSuccess: async (result) => {
      if (!result.ok) {
        const nextErrors = getPartFormErrors(copy, result.error);
        setDialogFieldErrors(nextErrors);
        const firstErrorTab = getFirstTabWithErrors(nextErrors);

        if (firstErrorTab) {
          setDialogActiveTab(firstErrorTab);
        }

        return;
      }

      await refreshPartsLists();
      addManufacturerSuggestion(result.part.manufacturerName);
      setDialogCatalogNumber("");
      setDialogDescription("");
      setDialogManufacturerName("");
      setDialogPrimaryCategoryId("");
      setDialogSecondaryCategoryId("");
      setDialogActiveTab("details");
      setDialogAttributeValues({});
      setCreateSupplierMatchingPayload("");
      setDialogFieldErrors({});
      setDialogFormResetKey((currentKey) => currentKey + 1);
      addToastMessage({
        id: getNextToastId(nextToastIdRef),
        message: getPartSuccessMessage(copy.createdToast, result.part)
      });
      closeDialog(partDialogRef.current);
    }
  });
  const updatePartMutation = useMutation({
    mutationFn: updatePart,
    onError: () => {
      setDialogFieldErrors({
        submit: getPartFormErrorMessage(copy, "database-unavailable")
      });
    },
    onSuccess: async (result) => {
      if (!result.ok) {
        const nextErrors = getPartFormErrors(copy, result.error);
        setDialogFieldErrors(nextErrors);
        const firstErrorTab = getFirstTabWithErrors(nextErrors);

        if (firstErrorTab) {
          setDialogActiveTab(firstErrorTab);
        }

        setPartPendingDelete(null);
        return;
      }

      await refreshPartsLists();
      addManufacturerSuggestion(result.part.manufacturerName);
      setEditingPart(result.part);
      setDialogDescription(result.part.description ?? "");
      setDialogManufacturerName(result.part.manufacturerName);
      setDialogActiveTab("details");
      setDialogAttributeValues(getPartAttributeValueState(result.part));
      setDialogFieldErrors({});
      addToastMessage({
        id: getNextToastId(nextToastIdRef),
        message: getPartSuccessMessage(copy.updatedToast, result.part)
      });
      closeDialog(partDialogRef.current);
    }
  });
  const deletePartMutation = useMutation({
    mutationFn: deletePart,
    onError: () => {
      setPartPendingDelete(null);
      addToastMessage({
        id: getNextToastId(nextToastIdRef),
        message: copy.deleteError,
        variant: "error"
      });
    },
    onSuccess: async (result) => {
      if (!result.ok) {
        setPartPendingDelete(null);
        addToastMessage({
          id: getNextToastId(nextToastIdRef),
          message: copy.deleteError,
          variant: "error"
        });
        return;
      }

      const deletedPart =
        currentPartsById.get(result.id) ?? partPendingDelete ?? editingPart;
      await refreshPartsLists();
      setEditingPart(null);
      setPartPendingDelete(null);
      setDialogFieldErrors({});

      if (deletedPart) {
        addToastMessage({
          id: getNextToastId(nextToastIdRef),
          message: getPartSuccessMessage(copy.deletedToast, deletedPart)
        });
      }

      closeDialog(partDialogRef.current);
    }
  });
  const openPartDialog = useCallback(function openPartDialog(part?: PartsListItem) {
    if (part) {
      setEditingPart(part);
      setDialogCatalogNumber(part.catalogNumber);
      setDialogDescription(part.description ?? "");
      setDialogManufacturerName(part.manufacturerName);
      setDialogUnitId(part.unitId);
      setDialogPrimaryCategoryId(part.primaryCategoryId ?? "");
      setDialogSecondaryCategoryId(part.secondaryCategoryId ?? "");
      setDialogDefaultLocationId(part.defaultLocationId ?? "");
      setDialogAttributeValues(getPartAttributeValueState(part));
      setDialogActiveTab("details");
      setDialogFieldErrors({});
      window.requestAnimationFrame(() => openDialog(partDialogRef.current));
    } else {
      const defaultPrimaryCategoryId = getCreatePrimaryCategoryFromFilter({
        categories: partCategories,
        categoryFilterId: filterValues["category"] ?? ""
      });

      setEditingPart(null);
      setDialogCatalogNumber("");
      setDialogDescription("");
      setDialogManufacturerName("");
      setDialogUnitId("");
      setDialogPrimaryCategoryId(defaultPrimaryCategoryId);
      setDialogSecondaryCategoryId("");
      setDialogDefaultLocationId("");
      setDialogActiveTab("details");
      setDialogAttributeValues({});
      setCreateSupplierMatchingPayload("");
      setDialogFieldErrors({});
      setDialogFormResetKey((currentKey) => currentKey + 1);
      openDialog(partDialogRef.current);
    }
  }, [filterValues, partCategories]);

  const columns = useMemo(() => buildPartsListColumns({
    mode: "full",
    copy: {
      noCategory: copy.noCategory,
      categories: copy.categories,
      manufacturer: copy.manufacturer,
      catalogNumber: copy.catalogNumber,
      description: copy.description,
      value: copy.value,
      source: copy.source,
      stock: copy.stock,
      reserved: copy.reserved,
      allocated: copy.allocated,
      available: copy.available,
      balance: copy.balance,
      planned: copy.planned,
      onOrder: copy.onOrder,
      inProduction: copy.inProduction,
      avgNetCost: copy.avgNetCost,
      avgGrossCost: copy.avgGrossCost,
      defaultLocation: copy.defaultLocation,
      editPart: copy.editPart,
      deletePart: copy.deletePart,
      addToPurchaseOrder: copy.addToPurchaseOrder,
      addToShoppingList: copy.addToShoppingList
    },
    workspaceAttributes,
    isDatabaseAvailable,
    isDeletePending: deletePartMutation.isPending,
    canWriteShoppingLists,
    canWritePurchaseOrders,
    onEditPart: openPartDialog,
    onDeletePart: handleDeletePart,
    onAddToPO: canWritePurchaseOrders ? (part) => setPartForPODialog(part) : undefined,
    onAddToSL: canWriteShoppingLists ? (part) => setPartForSLDialog(part) : undefined
  }), [
    canWriteShoppingLists,
    canWritePurchaseOrders,
    copy,
    deletePartMutation.isPending,
    isDatabaseAvailable,
    openPartDialog,
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
    if (!dialogHasAttributesTab && dialogActiveTab === "attributes") {
      setDialogActiveTab("details");
    }
  }, [dialogActiveTab, dialogHasAttributesTab]);

  useLayoutEffect(() => {
    if (dialogActiveTab !== "details") {
      return undefined;
    }

    return observeDialogContentHeight(
      dialogDetailsContentRef.current,
      setDialogDetailsContentHeight
    );
  }, [dialogActiveTab, editingPart]);

  useEffect(() => {
    // Only drop the selection once we are certain the part does not exist:
    // the list config is loaded and the independent fallback fetch has settled
    // without finding it. Clearing earlier would wipe a valid selection while
    // the list/fallback are still loading.
    if (!selectedPartId || isSelectedPartInList || !isListConfigurationLoaded) {
      return;
    }
    if (
      selectedPartFallbackQuery.isLoading ||
      selectedPartFallbackQuery.isFetching ||
      selectedPartFallbackQuery.data
    ) {
      return;
    }

    setSelectedPartId(null);
    syncSelectedPartInUrl(null);
  }, [
    selectedPartId,
    isSelectedPartInList,
    isListConfigurationLoaded,
    selectedPartFallbackQuery.isLoading,
    selectedPartFallbackQuery.isFetching,
    selectedPartFallbackQuery.data
  ]);

  useEffect(() => {
    if (partDialogOpen) {
      openDialog(partDialogRef.current);
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
      setDialogCatalogNumber(part.catalogNumber);
      setDialogDescription(part.description ?? "");
      setDialogManufacturerName(part.manufacturerName);
      setDialogUnitId(part.unitId);
      setDialogPrimaryCategoryId(part.primaryCategoryId ?? "");
      setDialogSecondaryCategoryId(part.secondaryCategoryId ?? "");
      setDialogDefaultLocationId(part.defaultLocationId ?? "");
      setDialogAttributeValues(getPartAttributeValueState(part));
      setDialogActiveTab("details");
      openDialog(partDialogRef.current);
    });
  }, [partEditDialog, currentParts]);

  function closePartDialog() {
    closeDialog(partDialogRef.current);
    setEditingPart(null);
    setDialogFieldErrors({});
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

  const partBuildAllocationsQuery = useQuery({
    queryKey: ["part-build-allocations", workspaceSlug, selectedPartId],
    enabled: Boolean(selectedPartId) && canReadBuilds,
    queryFn: async () => {
      const result = await getPartBuildAllocationsForWorkspace({
        workspaceSlug,
        partId: selectedPartId as string
      });
      if (!result.ok) throw new Error(result.error);
      return result.data;
    }
  });

  const partProductionBuildsQuery = useQuery({
    queryKey: ["part-production-builds", workspaceSlug, selectedPartId],
    enabled: Boolean(selectedPartId) && canReadBuilds,
    queryFn: async () => {
      const result = await getPartProductionBuildsForWorkspace({
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
      .filter((row) => Number(row.quantity) !== 0)
      .map((row) => ({
        locationId: row.locationId,
        locationName: locationNameById.get(row.locationId) ?? row.locationId,
        quantity: row.quantity,
        availableQuantity: row.availableQuantity
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

  function handlePartDialogSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const fieldErrors = validatePartForm(copy, {
      catalogNumber: dialogCatalogNumber,
      manufacturerName: dialogManufacturerName,
      unitId: dialogUnitId
    });

    setDialogFieldErrors(fieldErrors);
    const firstErrorTab = getFirstTabWithErrors(fieldErrors);

    if (firstErrorTab) {
      setDialogActiveTab(firstErrorTab);
    }

    if (hasFieldErrors(fieldErrors)) {
      return;
    }

    formData.set("catalogNumber", dialogCatalogNumber);
    formData.set("manufacturerName", dialogManufacturerName);
    formData.set("unitId", dialogUnitId);
    formData.set("description", dialogDescription);
    formData.set("primaryCategoryId", dialogPrimaryCategoryId);
    formData.set("secondaryCategoryId", dialogSecondaryCategoryId);
    formData.set("defaultLocationId", dialogDefaultLocationId);

    if (editingPart) {
      updatePartMutation.mutate(formData);
    } else {
      createPartMutation.mutate(formData);
    }
  }

  function handleDeletePart(part: PartsListItem) {
    setDialogFieldErrors((currentErrors) => {
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
    setDialogFieldErrors({});
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

    setDialogAttributeValues((current) => ({
      ...current,
      ...nextAttributeValues
    }));
    setDialogManufacturerName(matchingState.targetManufacturerName);
    clearPartFieldError(setDialogFieldErrors, "manufacturerName");
    setDialogPrimaryCategoryId(matchingState.targetCategoryId);
    setDialogSecondaryCategoryId("");
    closeDialog(matchingDialogRef.current);
  }

  return (
    <>
      <div className="flex min-h-0 flex-1 gap-4">
        <section
          aria-labelledby="parts-heading"
          className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elevated)] shadow-sm"
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
          hasActiveFilters={hasActiveFilters || filterHasActiveFilters}
          totalCount={partsCounts.totalCount}
          visibleColumnsLabel={copy.visibleColumns}
          setColumnVisible={setColumnVisible}
          onClearFilters={clearFilterValues}
          filterContent={
            <FilterBar
              filters={partsFilterDefs}
              filterVisibility={filterVisibility}
              filterOrder={filterOrder}
              configurableFilters={configurableFilters}
              setFilterVisible={setFilterVisible}
              setFilterOrder={setFilterOrder}
              filterValues={filterValues}
              onFilterChange={setFilterValue}
              onClearFilters={clearFilterValues}
              hasActiveFilters={filterHasActiveFilters}
              disabled={!isDatabaseAvailable}
              configureFiltersLabel={copy.configureFilters}
              clearFiltersLabel={copy.clearFilters}
              availableFiltersLabel={copy.availableFilters}
            />
          }
          primaryAction={
            <button
              className={primaryButtonClassName}
              disabled={!isDatabaseAvailable}
              type="button"
              onClick={() => openPartDialog()}
            >
              {copy.addPart}
            </button>
          }
        />
        {pinnedId ? (
          <PinnedFilterBanner
            label={copy.pinnedFilterLabel}
            clearLabel={copy.clearPinnedFilter}
            onClear={() => {
              clearPinnedId();
              setSelectedPartId(null);
              const url = new URL(window.location.href);
              url.searchParams.delete("selectedPartId");
              url.searchParams.delete("pinnedId");
              window.history.replaceState(null, "", url.toString());
            }}
          />
        ) : null}
        <PartsListTable
          table={partsTable}
          columnDefs={listColumns}
          setColumnSorting={setColumnSorting}
          setColumnWidth={setColumnWidth}
          hasNextPage={partsQueryHasNextPage}
          isFetchingNextPage={partsQueryIsFetchingNextPage}
          isInitialLoading={partsQueryIsLoading || !isListConfigurationLoaded || partsQueryIsPlaceholderData}
          isError={partsQueryIsError}
          isEmpty={currentParts.length === 0}
          loadMore={partsQueryFetchNextPage}
          loadingLabel={copy.loadingParts}
          loadingMoreLabel={copy.loadingMoreParts}
          emptyState={
            <div className="px-4 py-10">
              <p className="text-base font-medium text-[var(--color-text-primary)]">
                {hasActiveFilters ? copy.noMatchingPartsTitle : copy.emptyTitle}
              </p>
              <p className="mt-2 max-w-xl text-sm leading-6 text-[var(--color-text-muted)]">
                {hasActiveFilters ? copy.noMatchingPartsBody : copy.emptyBody}
              </p>
            </div>
          }
          errorState={
            <p className="p-6 text-sm text-[var(--color-text-muted)]">
              {copy.databaseUnavailable}
            </p>
          }
          testId="parts-list-viewport"
          onRowClick={openPartDetails}
          getRowHighlightClass={(part) =>
            part.id === selectedPartId ? "bg-[var(--color-bg-muted)]" : ""
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
              {(canWriteInventory || canWritePurchaseOrders || canWriteShoppingLists || canReadInventory) ? (
                <div className="flex flex-wrap gap-2">
                  {canWriteInventory ? (
                    <button
                      className="min-h-8 rounded-md border border-[var(--color-border-strong)] bg-[var(--color-bg-elevated)] px-2.5 py-1 text-sm font-medium text-[var(--color-text-secondary)] transition hover:border-[var(--color-border-hover)] hover:bg-[var(--color-bg-subtle)] focus:outline-none focus:ring-2 focus:ring-[var(--color-ring-strong)] focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-[var(--color-bg-subtle)] disabled:text-[var(--color-text-placeholder)]"
                      disabled={!isDatabaseAvailable}
                      type="button"
                      onClick={() => setPartForStockDialog(selectedPart)}
                    >
                      {copy.addMovement}
                    </button>
                  ) : null}
                  {canWritePurchaseOrders ? (
                    <button
                      className="min-h-8 rounded-md border border-[var(--color-border-strong)] bg-[var(--color-bg-elevated)] px-2.5 py-1 text-sm font-medium text-[var(--color-text-secondary)] transition hover:border-[var(--color-border-hover)] hover:bg-[var(--color-bg-subtle)] focus:outline-none focus:ring-2 focus:ring-[var(--color-ring-strong)] focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-[var(--color-bg-subtle)] disabled:text-[var(--color-text-placeholder)]"
                      disabled={!isDatabaseAvailable}
                      type="button"
                      onClick={() => setPartForPODialog(selectedPart)}
                    >
                      {copy.addToPurchaseOrder}
                    </button>
                  ) : null}
                  {canWriteShoppingLists ? (
                    <button
                      className="min-h-8 rounded-md border border-[var(--color-border-strong)] bg-[var(--color-bg-elevated)] px-2.5 py-1 text-sm font-medium text-[var(--color-text-secondary)] transition hover:border-[var(--color-border-hover)] hover:bg-[var(--color-bg-subtle)] focus:outline-none focus:ring-2 focus:ring-[var(--color-ring-strong)] focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-[var(--color-bg-subtle)] disabled:text-[var(--color-text-placeholder)]"
                      disabled={!isDatabaseAvailable}
                      type="button"
                      onClick={() => setPartForSLDialog(selectedPart)}
                    >
                      {copy.addToShoppingList}
                    </button>
                  ) : null}
                  {canReadInventory ? (
                    <button
                      className="min-h-8 rounded-md border border-[var(--color-border-strong)] bg-[var(--color-bg-elevated)] px-2.5 py-1 text-sm font-medium text-[var(--color-text-secondary)] transition hover:border-[var(--color-border-hover)] hover:bg-[var(--color-bg-subtle)] focus:outline-none focus:ring-2 focus:ring-[var(--color-ring-strong)] focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-[var(--color-bg-subtle)] disabled:text-[var(--color-text-placeholder)]"
                      disabled={!isDatabaseAvailable}
                      type="button"
                      onClick={() => setShowHistoryDialog(true)}
                    >
                      {copy.viewMovementHistory}
                    </button>
                  ) : null}
                </div>
              ) : null}
              {canReadInventory && canReadPurchaseOrders && canReadBuilds &&
              selectedPart.balanceQuantity !== null ? (
                <p className="text-sm text-[var(--color-text-secondary)]">
                  <span className="font-semibold text-[var(--color-text-primary)]">
                    {copy.balance}:
                  </span>{" "}
                  {selectedPart.balanceQuantity}
                </p>
              ) : null}
              <section className="grid gap-2">
                <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
                  {copy.attributes}
                </h3>
                {selectedPart.attributeValues.length === 0 ? (
                  <p className="rounded-md border border-[var(--color-border)] bg-[var(--color-bg-subtle)] px-3 py-2 text-sm text-[var(--color-text-secondary)]">
                    {copy.noAttributes}
                  </p>
                ) : (
                  <div className="overflow-hidden rounded-md border border-[var(--color-border)]">
                    <table className="w-full table-fixed text-left text-sm">
                      <thead className="bg-[var(--color-bg-subtle)] text-[var(--color-text-secondary)]">
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
                              className="border-t border-[var(--color-border)]"
                            >
                              <td className="px-3 py-2 text-[var(--color-text-secondary)]">
                                {attributeName}
                              </td>
                              <td className="px-3 py-2 text-[var(--color-text-primary)]">
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
                  <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
                    {copy.locationsAndStock}
                  </h3>
                  {selectedPartBalancesQuery.isLoading ||
                  detailsPanelLocationsQuery.isLoading ? (
                    <p className="rounded-md border border-[var(--color-border)] bg-[var(--color-bg-subtle)] px-3 py-2 text-sm text-[var(--color-text-secondary)]">
                      {copy.loadingParts}
                    </p>
                  ) : selectedPartBalancesQuery.isError ||
                    detailsPanelLocationsQuery.isError ? (
                    <p className="rounded-md border border-[var(--color-border)] bg-[var(--color-bg-subtle)] px-3 py-2 text-sm text-[var(--color-text-secondary)]">
                      {copy.databaseUnavailable}
                    </p>
                  ) : selectedPartLocationRows.length === 0 ? (
                    <p className="rounded-md border border-[var(--color-border)] bg-[var(--color-bg-subtle)] px-3 py-2 text-sm text-[var(--color-text-secondary)]">
                      {copy.noStock}
                    </p>
                  ) : (
                    <div className="overflow-hidden rounded-md border border-[var(--color-border)]">
                      <table className="w-full table-fixed text-left text-sm">
                        <thead className="bg-[var(--color-bg-subtle)] text-[var(--color-text-secondary)]">
                          <tr>
                            <th className="px-3 py-2 font-semibold">Location</th>
                            <th className="px-3 py-2 font-semibold">Stock</th>
                            <th className="px-3 py-2 font-semibold">{copy.available}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedPartLocationRows.map((row) => (
                            <tr
                              key={row.locationId}
                              className="border-t border-[var(--color-border)]"
                            >
                              <td className="px-3 py-2 text-[var(--color-text-secondary)]">
                                {row.locationName}
                              </td>
                              <td className="px-3 py-2 font-semibold text-[var(--color-text-primary)]">
                                {row.quantity}
                              </td>
                              <td className="px-3 py-2 font-semibold text-[var(--color-text-primary)]">
                                {row.availableQuantity}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>
              ) : null}
              {canReadPurchaseOrders &&
               !partPurchaseOrderHistoryQuery.isLoading &&
               !partPurchaseOrderHistoryQuery.isError &&
               (partPurchaseOrderHistoryQuery.data ?? []).length > 0 ? (
                <section className="grid gap-2">
                  <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
                    {copy.poHistory}
                  </h3>
                  <div className="max-h-64 overflow-y-auto rounded-md border border-[var(--color-border)]">
                    <table className="w-full text-left text-sm">
                      <thead className="sticky top-0 bg-[var(--color-bg-subtle)] text-[var(--color-text-secondary)]">
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
                          <tr key={`${entry.orderId}`} className="group border-t border-[var(--color-border)] first:border-t-0">
                            <td className="px-3 py-2 align-middle font-mono text-xs text-[var(--color-text-secondary)]">
                              <PoLink poId={entry.orderId} reference={entry.orderNumber ?? entry.orderId.slice(0, 8)} />
                            </td>
                            <td className="px-3 py-2 align-middle text-[var(--color-text-secondary)]">
                              {entry.supplierName}
                            </td>
                            <td className="px-3 py-2 align-middle">
                              <span className={[
                                "inline-block rounded px-1.5 py-0.5 font-mono text-xs font-medium",
                                entry.status === "RECEIVED"
                                  ? "bg-green-100 text-green-800"
                                  : entry.status === "ORDERED"
                                    ? "bg-amber-100 text-amber-800"
                                    : "bg-[var(--color-bg-muted)] text-[var(--color-text-secondary)]"
                              ].join(" ")}>
                                {entry.status}
                              </span>
                            </td>
                            <td className="whitespace-nowrap px-3 py-2 align-middle text-xs text-[var(--color-text-placeholder)]">
                              {entry.orderedAt
                                ? <DateDisplay value={entry.orderedAt} />
                                : "—"}
                            </td>
                            <td className="px-3 py-2 align-middle text-right tabular-nums text-[var(--color-text-primary)]">
                              {entry.quantity}
                            </td>
                            <td className="px-3 py-2 align-middle text-right tabular-nums text-[var(--color-text-secondary)]">
                              {entry.unitPriceNetPrimary != null ? (
                                <>
                                  <span>{entry.unitPriceNetPrimary} {primaryCurrency}</span>
                                  {entry.currency && entry.currency !== primaryCurrency && entry.unitPriceNet != null ? (
                                    <p className="text-xs text-[var(--color-text-placeholder)]">{entry.unitPriceNet} {entry.currency}</p>
                                  ) : null}
                                </>
                              ) : entry.unitPriceNet != null ? (
                                <span>{entry.unitPriceNet}{entry.currency ? ` ${entry.currency}` : ""}</span>
                              ) : "—"}
                            </td>
                            <td className="px-3 py-2 align-middle text-right tabular-nums text-[var(--color-text-secondary)]">
                              {entry.unitPriceGrossPrimary != null ? (
                                <>
                                  <span>{entry.unitPriceGrossPrimary} {primaryCurrency}</span>
                                  {entry.currency && entry.currency !== primaryCurrency && entry.unitPriceGross != null ? (
                                    <p className="text-xs text-[var(--color-text-placeholder)]">{entry.unitPriceGross} {entry.currency}</p>
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
                </section>
              ) : null}
              {canReadShoppingLists &&
               !partShoppingListMembershipQuery.isLoading &&
               !partShoppingListMembershipQuery.isError &&
               (partShoppingListMembershipQuery.data ?? []).length > 0 ? (
                <section className="grid gap-2">
                  <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
                    {copy.shoppingLists}
                  </h3>
                  <div className="max-h-64 overflow-y-auto rounded-md border border-[var(--color-border)]">
                    <table className="w-full text-left text-sm">
                      <thead className="sticky top-0 bg-[var(--color-bg-subtle)] text-[var(--color-text-secondary)]">
                        <tr>
                          <th className="px-3 py-2 font-semibold">{copy.slMembershipColList}</th>
                          <th className="px-3 py-2 text-right font-semibold">{copy.slMembershipColQty}</th>
                          <th className="px-3 py-2 font-semibold">{copy.slMembershipColNotes}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(partShoppingListMembershipQuery.data ?? []).map((entry: PartShoppingListMembershipItem) => (
                          <tr key={entry.shoppingListId} className="group border-t border-[var(--color-border)] first:border-t-0">
                            <td className="px-3 py-2 align-middle">
                              <SlLink slId={entry.shoppingListId} name={entry.shoppingListName} />
                            </td>
                            <td className="px-3 py-2 align-middle text-right tabular-nums text-[var(--color-text-primary)]">
                              {entry.quantity}
                            </td>
                            <td className="px-3 py-2 align-middle text-[var(--color-text-muted)]">
                              {entry.notes ?? "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              ) : null}
              {canReadBuilds &&
               !partBuildAllocationsQuery.isLoading &&
               !partBuildAllocationsQuery.isError &&
               (partBuildAllocationsQuery.data ?? []).length > 0 ? (
                <section className="grid gap-2">
                  <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
                    {copy.buildAllocations}
                  </h3>
                  <div className="max-h-64 overflow-y-auto rounded-md border border-[var(--color-border)]">
                    <table className="w-full text-left text-sm">
                      <thead className="sticky top-0 bg-[var(--color-bg-subtle)] text-[var(--color-text-secondary)]">
                        <tr>
                          <th className="px-3 py-2 font-semibold">{copy.buildAllocationsColBuild}</th>
                          <th className="px-3 py-2 font-semibold">{copy.buildAllocationsColState}</th>
                          <th className="px-3 py-2 text-right font-semibold">{copy.buildAllocationsColAllocated}</th>
                          <th className="px-3 py-2 text-right font-semibold">{copy.buildAllocationsColReserved}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(partBuildAllocationsQuery.data ?? []).map((entry: PartBuildAllocationItem) => (
                          <tr key={entry.buildId} className="group border-t border-[var(--color-border)] first:border-t-0">
                            <td className="px-3 py-2 align-middle">
                              <BuildLink
                                buildId={entry.buildId}
                                label={`${entry.designName} r${entry.revisionNumber} ×${entry.targetQuantity}`}
                              />
                            </td>
                            <td className="px-3 py-2 align-middle">
                              <span
                                className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${BUILD_STATE_BADGE_CLASS[entry.state] ?? ""}`}
                              >
                                {copy.buildStates[entry.state] ?? entry.state}
                              </span>
                            </td>
                            <td className="px-3 py-2 align-middle text-right tabular-nums text-[var(--color-text-primary)]">
                              {entry.allocatedQty > 0 ? entry.allocatedQty : "—"}
                            </td>
                            <td className="px-3 py-2 align-middle text-right tabular-nums text-[var(--color-text-primary)]">
                              {entry.reservedQty > 0 ? entry.reservedQty : "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              ) : null}
              {canReadBuilds &&
               !partProductionBuildsQuery.isLoading &&
               !partProductionBuildsQuery.isError &&
               (partProductionBuildsQuery.data ?? []).length > 0 ? (
                <section className="grid gap-2">
                  <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
                    {copy.productionBuilds}
                  </h3>
                  <div className="max-h-64 overflow-y-auto rounded-md border border-[var(--color-border)]">
                    <table className="w-full text-left text-sm">
                      <thead className="sticky top-0 bg-[var(--color-bg-subtle)] text-[var(--color-text-secondary)]">
                        <tr>
                          <th className="px-3 py-2 font-semibold">{copy.productionBuildsColBuild}</th>
                          <th className="px-3 py-2 font-semibold">{copy.productionBuildsColState}</th>
                          <th className="px-3 py-2 text-right font-semibold">{copy.productionBuildsColQty}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(partProductionBuildsQuery.data ?? []).map((entry: PartProductionBuildItem) => (
                          <tr key={entry.buildId} className="group border-t border-[var(--color-border)] first:border-t-0">
                            <td className="px-3 py-2 align-middle">
                              <BuildLink
                                buildId={entry.buildId}
                                label={`${entry.designName} r${entry.revisionNumber} ×${entry.targetQuantity}`}
                              />
                            </td>
                            <td className="px-3 py-2 align-middle">
                              <span
                                className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${BUILD_STATE_BADGE_CLASS[entry.state] ?? ""}`}
                              >
                                {copy.buildStates[entry.state] ?? entry.state}
                              </span>
                            </td>
                            <td className="px-3 py-2 align-middle text-right tabular-nums text-[var(--color-text-primary)]">
                              {entry.inProductionQty}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              ) : null}
          </DetailPanel>
        ) : null}
      </div>

      <ToastNotice messages={toastMessages} onDismiss={dismissToastMessage} />

      {/* Add / edit part dialog */}
      <DialogShell
        ref={partDialogRef}
        closeLabel={copy.close}
        description={editingPart ? copy.editPartBody : copy.newPartBody}
        title={editingPart ? copy.editPartTitle : copy.newPartTitle}
        titleId="part-dialog-title"
        widthClassName="w-[min(58rem,calc(100vw-3rem))]"
        onClose={closePartDialog}
      >
          <form
            className="flex min-h-0 flex-1 flex-col overflow-hidden"
            onSubmit={handlePartDialogSubmit}
          >
            <input name="workspaceSlug" type="hidden" value={workspaceSlug} />
            {editingPart && <input name="id" type="hidden" value={editingPart.id} />}
            {!editingPart && (
              <input
                name="supplierMatchingPayload"
                type="hidden"
                value={
                  createSupplierMatchingPayload ||
                  getSupplierMatchingPayloadValue(matchingState)
                }
              />
            )}
            <PartAttributeHiddenInputs
              attributeValues={dialogAttributeValues}
              categoryAttributesByCategoryId={categoryAttributesByCategoryId}
              part={editingPart ?? null}
              partCategories={partCategories}
              selectedPrimaryCategoryId={dialogPrimaryCategoryId}
              selectedSecondaryCategoryId={dialogSecondaryCategoryId}
            />
            <div className="shrink-0 border-b border-[var(--color-border)] px-5 pt-4">
              <PartDialogTabs
                activeTab={dialogActiveTab}
                copy={copy}
                showAttributesTab={dialogHasAttributesTab}
                onTabChange={setDialogActiveTab}
              />
            </div>
            <DialogBody
              className="flex-[0_1_auto]"
              style={getDialogBodyHeightStyle(dialogDetailsContentHeight)}
            >
              {dialogActiveTab === "details" ? (
                <div
                  ref={dialogDetailsContentRef}
                  className="grid gap-3 pr-1"
                >
                  <PartDetailsFields
                    catalogNumber={dialogCatalogNumber}
                    catalogNumberInputId="part-dialog-catalog-number"
                    categoryTree={categoryTree}
                    copy={copy}
                    disabled={!isDatabaseAvailable}
                    description={dialogDescription}
                    descriptionInputId="part-dialog-description"
                    errors={dialogFieldErrors}
                    formResetKey={editingPart ? `${editingPart.id}-${editingPart.manufacturerName}` : dialogFormResetKey}
                    manufacturerInputId="part-dialog-manufacturer-name"
                    manufacturerName={dialogManufacturerName}
                    unitId={dialogUnitId}
                    units={units}
                    manufacturerSuggestions={currentManufacturerSuggestions}
                    partCategories={partCategories}
                    primaryCategoryId={dialogPrimaryCategoryId}
                    secondaryCategoryId={dialogSecondaryCategoryId}
                    defaultLocationId={dialogDefaultLocationId}
                    dialogLocations={dialogLocations}
                    dialogLocationTree={dialogLocationTree}
                    onDefaultLocationChange={setDialogDefaultLocationId}
                    onCatalogNumberChange={(value) => {
                      setDialogCatalogNumber(value);
                      clearPartFieldError(setDialogFieldErrors, "catalogNumber");
                    }}
                    onDescriptionChange={setDialogDescription}
                    onManufacturerNameChange={(value) => {
                      setDialogManufacturerName(value);
                      clearPartFieldError(setDialogFieldErrors, "manufacturerName");
                    }}
                    onUnitIdChange={(value) => {
                      setDialogUnitId(value);
                      clearPartFieldError(setDialogFieldErrors, "unitId");
                    }}
                    onSupplierSuggestionSelect={editingPart ? () => {} : (suggestion) => {
                      setDialogCatalogNumber(suggestion.catalogNumber);
                      setDialogManufacturerName(suggestion.manufacturerName);
                      setDialogDescription(suggestion.description);
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
                    activeSupplierProvider={editingPart ? null : activeSupplierProvider}
                    onPrimaryCategoryChange={(categoryId) => {
                      setDialogPrimaryCategoryId(categoryId);
                      clearPartFieldError(setDialogFieldErrors, "primaryCategoryId");
                      if (!categoryId || dialogSecondaryCategoryId === categoryId) {
                        setDialogSecondaryCategoryId("");
                        clearPartFieldError(setDialogFieldErrors, "secondaryCategoryId");
                      }
                    }}
                    onSecondaryCategoryChange={(categoryId) => {
                      setDialogSecondaryCategoryId(categoryId);
                      clearPartFieldError(setDialogFieldErrors, "secondaryCategoryId");
                    }}
                  />
                  <PartAttributeSections
                    categoryAttributesByCategoryId={categoryAttributesByCategoryId}
                    partCategories={partCategories}
                    copy={copy}
                    disabled={!isDatabaseAvailable}
                    part={editingPart ?? null}
                    selectedPrimaryCategoryId={dialogPrimaryCategoryId}
                    selectedSecondaryCategoryId={dialogSecondaryCategoryId}
                    tab="details"
                    values={dialogAttributeValues}
                    onValueChange={(attributeId, value) =>
                      setDialogAttributeValues((currentValues) => ({
                        ...currentValues,
                        [attributeId]: value
                      }))
                    }
                  />
                </div>
              ) : null}
              {dialogActiveTab === "attributes" ? (
                <div className="grid gap-3 pr-1">
                  <PartAttributeSections
                    categoryAttributesByCategoryId={categoryAttributesByCategoryId}
                    partCategories={partCategories}
                    copy={copy}
                    disabled={!isDatabaseAvailable}
                    part={editingPart ?? null}
                    selectedPrimaryCategoryId={dialogPrimaryCategoryId}
                    selectedSecondaryCategoryId={dialogSecondaryCategoryId}
                    tab="attributes"
                    values={dialogAttributeValues}
                    onValueChange={(attributeId, value) =>
                      setDialogAttributeValues((currentValues) => ({
                        ...currentValues,
                        [attributeId]: value
                      }))
                    }
                  />
                </div>
              ) : null}
            </DialogBody>
            {editingPart ? (
              <DialogActions
                cancelLabel={copy.cancelDelete}
                actionLabel={copy.saveChanges}
                disabled={!isDatabaseAvailable || updatePartMutation.isPending || deletePartMutation.isPending}
                error={dialogFieldErrors.submit}
              />
            ) : (
              <DialogActions
                cancelLabel={copy.cancelDelete}
                actionLabel={copy.createPart}
                disabled={!isDatabaseAvailable || createPartMutation.isPending}
                error={dialogFieldErrors.submit}
              />
            )}
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
                  <label className="grid gap-2 text-sm font-medium text-[var(--color-text-secondary)]">
                    {copy.sourceManufacturerLabel}
                    <div className="min-h-10 rounded-md border border-[var(--color-border)] bg-[var(--color-bg-subtle)] px-3 py-2 text-sm text-[var(--color-text-secondary)]">
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
                  <label className="grid gap-2 text-sm font-medium text-[var(--color-text-secondary)]">
                    {copy.sourceCategoryLabel}
                    <div className="min-h-10 rounded-md border border-[var(--color-border)] bg-[var(--color-bg-subtle)] px-3 py-2 text-sm text-[var(--color-text-secondary)]">
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
                <div className="overflow-hidden rounded-md border border-[var(--color-border)]">
                  <table className="w-full table-fixed text-left text-sm">
                    <thead className="bg-[var(--color-bg-subtle)] text-[var(--color-text-secondary)]">
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
                          <tr key={`${row.sourceAttributeKey}-${rowIndex}`} className="border-t border-[var(--color-border)]">
                            <td className="px-3 py-2 text-[var(--color-text-secondary)]">{row.sourceAttribute}</td>
                            <td className="px-3 py-2 font-mono text-[var(--color-text-primary)]">{row.sourceValue}</td>
                            <td className="px-3 py-2">
                              <select
                                className="min-h-9 w-full rounded-md border border-[var(--color-border-strong)] bg-[var(--color-bg-elevated)] px-2 py-1 text-sm text-[var(--color-text-primary)]"
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
                                    className="min-h-9 w-full rounded-md border border-[var(--color-border-strong)] bg-[var(--color-bg-elevated)] px-2 py-1 text-sm text-[var(--color-text-primary)]"
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
                                    className="min-h-9 w-full rounded-md border border-[var(--color-border-strong)] bg-[var(--color-bg-elevated)] px-2 py-1 text-sm text-[var(--color-text-primary)]"
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
                                    className="min-h-9 w-full rounded-md border border-[var(--color-border-strong)] bg-[var(--color-bg-elevated)] px-2 py-1 text-sm text-[var(--color-text-primary)]"
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
            <DialogFooter className="items-center justify-between gap-3">
              <DialogSecondaryButton onClick={() => setSkipMatchingPendingConfirmation(true)}>
                {copy.skipMatching}
              </DialogSecondaryButton>
              <DialogPrimaryButton type="button" onClick={applyMatchingToPartForm}>
                {copy.saveChanges}
              </DialogPrimaryButton>
            </DialogFooter>
          </div>
        ) : null}
      </DialogShell>

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

      <PartMovementHistoryDialog
        copy={copy}
        open={showHistoryDialog}
        partId={selectedPartId}
        partTitle={
          selectedPart
            ? `${selectedPart.manufacturerName} ${selectedPart.catalogNumber}`
            : ""
        }
        workspaceSlug={workspaceSlug}
        onClose={() => setShowHistoryDialog(false)}
      />
      <PartStockDialog
        canReadInventory={canReadInventory}
        canWriteInventory={canWriteInventory}
        copy={copy}
        open={Boolean(partForStockDialog)}
        part={partForStockDialog}
        workspaceSlug={workspaceSlug}
        onClose={() => setPartForStockDialog(null)}
        onSuccess={(msg) => {
          addToastMessage({ id: getNextToastId(nextToastIdRef), message: msg });
          setPartForStockDialog(null);
        }}
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
    <div className="flex gap-2 border-b border-[var(--color-border)]">
      <button
        className={`min-h-10 border-b-2 px-3 text-sm font-medium ${
          activeTab === "details"
            ? "border-[var(--color-accent)] text-[var(--color-text-primary)]"
            : "border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]"
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
              ? "border-[var(--color-accent)] text-[var(--color-text-primary)]"
              : "border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]"
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- digiKeyResults.length intentionally omitted: effect scrolls active item into view on index change; length is only a guard
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
          className="relative grid gap-2 text-sm font-medium text-[var(--color-text-secondary)]"
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
              "min-h-10 rounded-md border border-[var(--color-border-strong)] bg-[var(--color-bg-elevated)] px-3 py-1.5 font-mono text-sm text-[var(--color-text-primary)] outline-none transition placeholder:text-[var(--color-text-placeholder)] hover:border-[var(--color-border-hover)] focus:border-[var(--color-border-hover)] focus:ring-2 focus:ring-[var(--color-ring)] disabled:cursor-not-allowed disabled:bg-[var(--color-bg-subtle)] disabled:text-[var(--color-text-placeholder)]",
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
                  className="fixed z-50 overflow-hidden rounded-md border border-[var(--color-border)] bg-[var(--color-bg-elevated)] shadow-lg"
                  style={digiKeyPanelStyle}
                  role="listbox"
                >
                  {digiKeyResultsQuery.isLoading ? (
                    <p className="px-3 py-3 text-sm font-normal text-[var(--color-text-muted)]">
                      {copy.loadingParts}
                    </p>
                  ) : digiKeyResultsQuery.isError || hasDigiKeyError ? (
                    <p className="px-3 py-3 text-sm font-normal text-[var(--color-text-muted)]">
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
                            className={`w-full rounded-md px-3 py-2 text-left text-sm transition focus:outline-none focus:ring-2 focus:ring-[var(--color-ring-strong)] ${
                              index === activeDigiKeyIndex
                                ? "bg-[var(--color-accent-soft)] font-semibold text-[var(--color-text-primary)]"
                                : "text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-subtle)]"
                            }`}
                            role="option"
                            type="button"
                            onMouseDown={(event) => event.preventDefault()}
                            onClick={() => selectDigiKeyResult(result)}
                          >
                            <span className="flex items-center justify-between gap-3">
                              <span className="font-mono text-[var(--color-text-primary)]">
                                {result.catalogNumber}
                              </span>
                              <span className="truncate text-xs font-medium uppercase tracking-wide text-[var(--color-text-muted)]">
                                {result.manufacturerName}
                              </span>
                            </span>
                            <span className="mt-1 block overflow-hidden text-ellipsis whitespace-nowrap text-xs font-normal leading-5 text-[var(--color-text-secondary)]">
                              {result.description}
                            </span>
                          </button>
                        </li>
                      ))}
                      {digiKeyResultsQuery.isFetchingNextPage ? (
                        <li className="px-3 py-2 text-xs text-[var(--color-text-muted)]">
                          {copy.loadingMoreParts}
                        </li>
                      ) : null}
                    </ol>
                  ) : (
                    <p className="px-3 py-3 text-sm font-normal text-[var(--color-text-muted)]">
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
        className="grid gap-2 text-sm font-medium text-[var(--color-text-secondary)]"
        htmlFor={descriptionInputId}
      >
        {copy.description}
        <textarea
          className="min-h-20 resize-y rounded-md border border-[var(--color-border-strong)] bg-[var(--color-bg-elevated)] px-3 py-2 text-sm text-[var(--color-text-primary)] outline-none transition placeholder:text-[var(--color-text-placeholder)] hover:border-[var(--color-border-hover)] focus:border-[var(--color-border-hover)] focus:ring-2 focus:ring-[var(--color-ring)] disabled:cursor-not-allowed disabled:bg-[var(--color-bg-subtle)] disabled:text-[var(--color-text-placeholder)]"
          id={descriptionInputId}
          name="description"
          placeholder={copy.descriptionPlaceholder}
          value={description}
          disabled={disabled}
          onChange={(event) => onDescriptionChange(event.target.value)}
        />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="grid gap-2 text-sm font-medium text-[var(--color-text-secondary)]">
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
              "min-h-10 rounded-md border border-[var(--color-border-strong)] bg-[var(--color-bg-elevated)] px-3 py-1.5 text-sm text-[var(--color-text-primary)] outline-none transition hover:border-[var(--color-border-hover)] focus:border-[var(--color-border-hover)] focus:ring-2 focus:ring-[var(--color-ring)] disabled:cursor-not-allowed disabled:bg-[var(--color-bg-subtle)] disabled:text-[var(--color-text-placeholder)]",
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
        <div className="grid gap-2 text-sm font-medium text-[var(--color-text-secondary)]">
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
          <h3 className="mb-2 text-sm font-semibold text-[var(--color-text-secondary)]">
            {section.title}
          </h3>
          <div className="divide-y divide-[var(--color-border)] rounded-md border border-[var(--color-border)]">
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
    ? "min-h-8 rounded-md border border-[var(--color-border-strong)] bg-[var(--color-bg-elevated)] px-2.5 py-1 text-sm text-[var(--color-text-primary)] outline-none transition placeholder:text-[var(--color-text-placeholder)] hover:border-[var(--color-border-hover)] focus:border-[var(--color-border-hover)] focus:ring-2 focus:ring-[var(--color-ring)] disabled:cursor-not-allowed disabled:bg-[var(--color-bg-subtle)] disabled:text-[var(--color-text-placeholder)]"
    : "min-h-10 rounded-md border border-[var(--color-border-strong)] bg-[var(--color-bg-elevated)] px-3 py-1.5 text-sm text-[var(--color-text-primary)] outline-none transition placeholder:text-[var(--color-text-placeholder)] hover:border-[var(--color-border-hover)] focus:border-[var(--color-border-hover)] focus:ring-2 focus:ring-[var(--color-ring)] disabled:cursor-not-allowed disabled:bg-[var(--color-bg-subtle)] disabled:text-[var(--color-text-placeholder)]";

  return (
    <label
      className={
        compact
          ? "grid grid-cols-[minmax(10rem,16rem)_minmax(12rem,1fr)] items-center gap-3 px-3 py-2 text-sm font-medium text-[var(--color-text-secondary)]"
          : "grid gap-1.5 p-3 text-sm font-medium text-[var(--color-text-secondary)]"
      }
    >
      <span className="min-w-0">
        <span className="block truncate">{attribute.name}</span>
        {compact && attribute.description ? (
          <span
            id={descriptionId}
            className="mt-0.5 block truncate text-xs font-normal text-[var(--color-text-muted)]"
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
          className="text-xs font-normal text-[var(--color-text-muted)]"
        >
          {attribute.description}
        </span>
      ) : null}
    </label>
  );
}

const primaryButtonClassName =
  "min-h-9 rounded-md border border-[var(--color-action-primary)] bg-[var(--color-action-primary)] px-3 py-1.5 text-sm font-semibold text-white transition hover:border-[var(--color-action-primary-hover)] hover:bg-[var(--color-action-primary-hover)] focus:outline-none focus:ring-2 focus:ring-[var(--color-action-focus)] focus:ring-offset-2 disabled:cursor-not-allowed disabled:border-[var(--color-border)] disabled:bg-[var(--color-bg-muted)] disabled:text-[var(--color-text-placeholder)]";
