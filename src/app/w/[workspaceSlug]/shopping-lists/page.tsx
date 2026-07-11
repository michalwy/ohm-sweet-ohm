import { notFound, redirect } from "next/navigation";

import { ShoppingListsClient } from "@/app/shopping-lists-client";
import { WorkspaceShell } from "@/app/workspace-shell";
import { hasWorkspacePermission } from "@/server/access-control/authorize";
import {
  getCurrentSession,
  getCurrentWorkspaceContextBySlug
} from "@/server/auth/currentContext";
import { getShoppingLists } from "@/server/shopping-lists/shoppingListMutations";

export const dynamic = "force-dynamic";

const copy = {
  title: "Shopping Lists",
  intro: "Informal lists of parts you want to buy.",
  newList: "New list",
  newListTitle: "New shopping list",
  editListTitle: "Edit shopping list",
  name: "Name",
  description: "Description",
  namePlaceholder: "Weekend order",
  descriptionPlaceholder: "Optional description",
  createList: "Create list",
  saveChanges: "Save changes",
  edit: "Edit",
  delete: "Delete",
  close: "Close",
  cancel: "Cancel",
  cancelDelete: "Cancel",
  confirmDelete: "Delete",
  deleteConfirmationBody: "This cannot be undone.",
  deleteList: "Delete list",
  noLists: "No shopping lists yet. Create one to start collecting parts to buy.",
  pinnedFilterLabel: "Filtered to 1 shopping list",
  clearPinnedFilter: "Show all lists",
  loadError: "Failed to load lists.",
  loadingLists: "Loading lists...",
  loadingMoreLists: "Loading more...",
  items: "Items",
  itemsPlural: "items",
  listItems: "Items",
  addItem: "Add item",
  editItem: "Edit item",
  removeItem: "Remove item",
  removeItemConfirmBody: "This item will be removed from the list.",
  part: "Part",
  quantity: "Quantity",
  noItems: "No items yet. Add parts to this list.",
  searchParts: "Search parts",
  searchPartsPlaceholder: "Search by catalog number or description",
  loadingParts: "Loading parts…",
  noMatchingParts: "No matching parts",
  orderedBadge: "On order",
  alreadyOnOrder: "Already on a purchase order",
  convertToOrder: "Convert to order",
  convertToOrderTitle: "Convert to purchase order",
  convertToOrderBody: "Select a draft purchase order or create a new one.",
  supplier: "Supplier",
  chooseSupplier: "Choose a supplier",
  noSuppliers: "No matching suppliers",
  loadingSuppliers: "Loading suppliers...",
  newOrder: "New order",
  newOrderTitle: "New purchase order",
  noDraftOrders: "No draft purchase orders available.",
  noOrderSelected: "Select a purchase order.",
  addedToOrderToast: "Items added to purchase order",
  selectedItems: "selected",
  noItemsSelected: "Select at least one item to convert.",
  addToOrder: "Add to order",
  orderNumber: "Order number",
  orderNumberPlaceholder: "PO-2026-001",
  notes: "Notes",
  notesPlaceholder: "Optional notes",
  createOrder: "Create order",
  created: "Created",
  createdBy: "Created by",
  createdToast: "List created",
  updatedToast: "List updated",
  deletedToast: "List deleted",
  itemAddedToast: "Item added",
  itemUpdatedToast: "Item updated",
  itemRemovedToast: "Item removed",
  convertedToast: "New purchase order created",
  nameRequired: "Enter a name.",
  quantityRequired: "Enter a quantity greater than zero.",
  partRequired: "Select a part.",
  supplierRequired: "Select a supplier.",
  invalidInput: "Check the fields and try again.",
  permissionDenied: "You do not have permission to perform this action.",
  databaseUnavailable: "Database is not available.",
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
  listCountSummary: "{visible} of {total} lists",
  searchLists: "Search lists",
  configureFilters: "Filters",
  clearFilters: "Clear filters",
  availableFilters: "Available filters",
  multiAdd: {
    // picker step
    pickerTitle: "Add multiple items",
    title: "Add multiple items",
    cancel: "Cancel",
    confirmSelection: "Set quantities ({count})",
    partsSelected: "{count} selected",
    alreadyAdded: "Already on list",
    filteredPartsSummary: "{visible} of {total} parts",
    configureList: "Configure list",
    clearFilters: "Clear filters",
    visibleColumns: "Columns",
    attributeColumns: "Attribute columns",
    emptyTitle: "No parts yet",
    emptyBody: "Add parts to your workspace to start building lists.",
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
    balance: "Balance",
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

type ShoppingListsPageProps = {
  params: Promise<{ workspaceSlug: string }>;
  searchParams?: Promise<{ selectedListId?: string; pinnedId?: string }>;
};

export default async function ShoppingListsPage({
  params,
  searchParams
}: ShoppingListsPageProps) {
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

  const [initialPage, canWrite] = await Promise.all([
    getShoppingLists(context.workspace.id).catch(() => emptyPage),
    hasWorkspacePermission({
      userId: context.user.id,
      workspaceId: context.workspace.id,
      permission: "shopping-lists:write"
    }).catch(() => false)
  ]);

  return (
    <WorkspaceShell
      activeNavItem="shopping-lists"
      intro={copy.intro}
      title={copy.title}
      userEmail={context.user.email}
      workspaceName={context.workspace.name}
      workspaceSlug={workspaceSlug}
    >
      <ShoppingListsClient
        canWrite={canWrite}
        copy={copy}
        initialPage={initialPage}
        initialSelectedListId={resolvedSearchParams?.selectedListId}
        initialPinnedListId={resolvedSearchParams?.pinnedId}
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
