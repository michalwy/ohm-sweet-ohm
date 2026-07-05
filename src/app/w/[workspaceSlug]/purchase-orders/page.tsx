import { notFound, redirect } from "next/navigation";

import { PurchaseOrdersClient } from "@/app/purchase-orders-client";
import { WorkspaceShell } from "@/app/workspace-shell";
import { hasWorkspacePermission } from "@/server/access-control/authorize";
import {
  getCurrentSession,
  getCurrentWorkspaceContextBySlug
} from "@/server/auth/currentContext";
import { getPurchaseOrders } from "@/server/purchase-orders/purchaseOrderMutations";
import { getStorageLocations } from "@/server/inventory/locationMutations";

export const dynamic = "force-dynamic";

const copy = {
  title: "Purchase Orders",
  intro: "Formal orders sent to a supplier.",
  newOrder: "New order",
  newOrderTitle: "New purchase order",
  editOrderTitle: "Edit purchase order",
  supplier: "Supplier",
  chooseSupplier: "Choose a supplier",
  noSuppliers: "No matching suppliers",
  loadingSuppliers: "Loading suppliers...",
  orderNumber: "Order number",
  orderNumberPlaceholder: "PO-2026-001",
  notes: "Notes",
  notesPlaceholder: "Optional notes",
  createOrder: "Create order",
  saveChanges: "Save changes",
  edit: "Edit",
  delete: "Delete",
  close: "Close",
  cancel: "Cancel",
  cancelDelete: "Cancel",
  confirmDelete: "Delete",
  deleteConfirmationBody: "This cannot be undone.",
  deleteOrder: "Delete order",
  revertToDraft: "Revert to draft",
  revertToDraftConfirmTitle: "Revert to draft?",
  revertToDraftConfirmBody: "The order will return to draft status. On-order quantities will return to planned.",
  revertedToast: "Order reverted to draft",
  noOrders: "No purchase orders yet. Create one to start ordering parts.",
  pinnedFilterLabel: "Filtered to 1 purchase order",
  clearPinnedFilter: "Show all orders",
  loadError: "Failed to load orders.",
  loadingOrders: "Loading orders...",
  loadingMoreOrders: "Loading more...",
  status: "Status",
  statusDraft: "Draft",
  statusOrdered: "Ordered",
  statusReceived: "Received",
  markOrdered: "Mark as ordered",
  markOrderedConfirmTitle: "Mark as ordered?",
  markOrderedConfirmBody: "This will record the order date. You can still edit items after marking as ordered.",
  confirm: "Confirm",
  receiveItems: "Receive items",
  receiveItemsTitle: "Receive items",
  receiveItemsBody: "Enter quantities received and the destination location.",
  items: "Items",
  itemsPlural: "items",
  created: "Created",
  createdBy: "Created by",
  supplierOrderNumber: "Supplier order number",
  supplierOrderNumberPlaceholder: "Supplier's reference",
  ordered: "Ordered",
  received: "Received",
  remaining: "Remaining",
  part: "Part",
  quantity: "Qty ordered",
  receivedQty: "Qty to receive",
  location: "Location",
  chooseLocation: "Choose a location",
  noLocations: "No assignable locations available.",
  searchLocations: "Search locations",
  noMatchingLocations: "No matching locations",
  expandLocation: "Expand",
  collapseLocation: "Collapse",
  supplierSku: "Supplier SKU",
  unitPrice: "Unit price",
  lineTotal: "Line total",
  currency: "Currency",
  chooseCurrency: "— none —",
  taxRate: "Tax rate (%)",
  taxRateShort: "Tax %",
  taxRatePlaceholder: "0",
  taxRateHelp: "Applied to all items unless overridden per item",
  grossUnitPrice: "Gross unit price",
  grossLineTotal: "Gross line total",
  lookupSku: "Look up",
  skuFound: "SKU found",
  skuNotFound: "Not found",
  addItem: "Add item",
  editItem: "Edit item",
  removeItem: "Remove item",
  removeItemConfirmBody: "This item will be removed from the order.",
  noItems: "No items yet. Add parts to this order.",
  searchParts: "Search parts",
  searchPartsPlaceholder: "Search by catalog number or description",
  loadingParts: "Loading parts…",
  noMatchingParts: "No matching parts",
  createdToast: "Order created",
  updatedToast: "Order updated",
  deletedToast: "Order deleted",
  orderedToast: "Order marked as ordered",
  itemAddedToast: "Item added",
  itemUpdatedToast: "Item updated",
  itemRemovedToast: "Item removed",
  receivedToast: "Items received",
  nameRequired: "Select a supplier.",
  quantityRequired: "Enter a quantity greater than zero.",
  partRequired: "Select a part.",
  locationRequired: "Choose a location.",
  invalidInput: "Check the fields and try again.",
  permissionDenied: "You do not have permission to perform this action.",
  databaseUnavailable: "Database is not available.",
  orderedAt: "Ordered",
  noAttribute: "—",
  totalNetValue: "Net value",
  totalGrossValue: "Gross value",
  totalNetValuePrimary: "Net value ({currency})",
  totalGrossValuePrimary: "Gross value ({currency})",
  orderTotals: "Order totals",
  configureList: "Configure list",
  configureListTitle: "Configure list",
  configureListBody: "Choose visible columns, order, sorting, and widths.",
  visibleColumns: "Columns",
  moveUp: "Up",
  moveDown: "Down",
  columnWidthPx: "Width",
  sortingLabel: "Sort",
  clearSorting: "None",
  resetListConfiguration: "Reset defaults",
  orderCountSummary: "{visible} of {total} orders",
  priceEntryMode: "Price entry mode",
  priceEntryModeNet: "Net",
  priceEntryModeGross: "Gross",
  exchangeRateUnavailableTitle: "Exchange rate unavailable",
  exchangeRateUnavailableBody: "The exchange rate for {from} → {to} on {date} could not be fetched automatically. Please enter it manually to continue.",
  manualRateLabel: "1 {from} =",
  manualRateSubmit: "Save rate and continue",
  multiAdd: {
    // picker step
    pickerTitle: "Add multiple items",
    title: "Add multiple items",
    cancel: "Cancel",
    confirmSelection: "Set quantities ({count})",
    partsSelected: "{count} selected",
    alreadyAdded: "Already on order",
    filteredPartsSummary: "{visible} of {total} parts",
    configureList: "Configure list",
    clearFilters: "Clear filters",
    visibleColumns: "Columns",
    attributeColumns: "Attribute columns",
    emptyTitle: "No parts yet",
    emptyBody: "Add parts to your workspace to start building orders.",
    noMatchingPartsTitle: "No matching parts",
    noMatchingPartsBody: "Try a different search or clear the filters.",
    loadingParts: "Loading parts…",
    loadingMoreParts: "Loading more…",
    databaseUnavailable: "Database is not available.",
    // filter bar
    searchParts: "Search parts",
    searchPartsPlaceholder: "Search by catalog number or description",
    filterByCategory: "Category",
    allCategories: "All categories",
    filterByManufacturer: "Manufacturer",
    allManufacturers: "All manufacturers",
    noMatchingManufacturers: "No matching manufacturers",
    searchCategories: "Search categories",
    noMatchingCategories: "No matching categories",
    expandCategory: "Expand",
    collapseCategory: "Collapse",
    // column headers
    noCategory: "—",
    categories: "Category",
    manufacturer: "Manufacturer",
    catalogNumber: "Catalog number",
    description: "Description",
    value: "Value",
    stock: "Stock",
    reserved: "Reserved",
    allocated: "Allocated",
    available: "Available",
    planned: "Planned",
    onOrder: "On order",
    inProduction: "In production",
    avgNetCost: "Avg net cost",
    avgGrossCost: "Avg gross cost",
    source: "Source",
    defaultLocation: "Default location",
    // quantities step
    quantitiesTitle: "Set quantities",
    part: "Part",
    quantity: "Quantity",
    back: "← Back",
    addItems: "Add {count} items",
    addItem: "Add item",
    submitting: "Adding…"
  }
};

type PurchaseOrdersPageProps = {
  params: Promise<{ workspaceSlug: string }>;
  searchParams?: Promise<{ selectedOrderId?: string; pinnedId?: string }>;
};

export default async function PurchaseOrdersPage({ params, searchParams }: PurchaseOrdersPageProps) {
  const { workspaceSlug } = await params;
  const resolvedSearchParams = await searchParams;
  const session = await getCurrentSession();

  if (!session) {
    redirect("/sign-in");
  }

  const context = await getCurrentWorkspaceContextBySlug(workspaceSlug);

  if (!context) {
    notFound();
  }

  const emptyPage = { items: [], nextCursor: null, totalCount: 0, filteredCount: 0 };

  const [initialPage, locations, canWrite, canReadInventory, canReadShoppingLists] = await Promise.all([
    getPurchaseOrders(context.workspace.id).catch(() => emptyPage),
    getStorageLocations(context.workspace.id).catch(() => []),
    hasWorkspacePermission({
      userId: context.user.id,
      workspaceId: context.workspace.id,
      permission: "purchase-orders:write"
    }).catch(() => false),
    hasWorkspacePermission({
      userId: context.user.id,
      workspaceId: context.workspace.id,
      permission: "inventory:read"
    }).catch(() => false),
    hasWorkspacePermission({
      userId: context.user.id,
      workspaceId: context.workspace.id,
      permission: "shopping-lists:read"
    }).catch(() => false)
  ]);

  const allLocations = locations.filter((l) => !l.isArchived);
  const assignableLocations = locations.filter((l) => l.isAssignable && !l.isArchived);

  return (
    <WorkspaceShell
      activeNavItem="purchase-orders"
      intro={copy.intro}
      title={copy.title}
      userEmail={context.user.email}
      workspaceName={context.workspace.name}
      workspaceSlug={workspaceSlug}
    >
      <PurchaseOrdersClient
        copy={copy}
        canWrite={canWrite}
        canReadInventory={canReadInventory}
        canReadShoppingLists={canReadShoppingLists}
        initialPage={initialPage}
        initialSelectedOrderId={resolvedSearchParams?.selectedOrderId}
        initialPinnedOrderId={resolvedSearchParams?.pinnedId}
        allLocations={allLocations}
        assignableLocations={assignableLocations}
        workspaceSlug={workspaceSlug}
        primaryCurrency={context.workspace.primaryCurrency}
        workspaceDefaultPriceEntryMode={
          (context.workspace.defaultPriceEntryMode as "net" | "gross") ?? "net"
        }
        workspaceDefaultTaxRate={context.workspace.defaultTaxRate?.toString() ?? null}
      />
    </WorkspaceShell>
  );
}
