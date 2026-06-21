import { notFound, redirect } from "next/navigation";

import { PartsListClient } from "@/app/parts-list-client";
import { WorkspaceShell } from "@/app/workspace-shell";
import { hasWorkspacePermission } from "@/server/access-control/authorize";
import {
  getCurrentSession,
  getCurrentWorkspaceContextBySlug
} from "@/server/auth/currentContext";
import { getManufacturerSuggestionsForPartForm } from "@/server/organizations/organizations";
import { getWorkspaceActiveSupplierProvider } from "@/server/integrations/providerSettings";
import { getPartCategoriesForPartForm } from "@/server/parts/categories";
import { getPartsList } from "@/server/parts/getParts";
import {
  getEffectivePartCategoryAttributes,
  getEffectiveWorkspaceAttributes
} from "@/server/parts/attributes";
import { getWorkspaceAttributes } from "@/server/parts/attributeMutations";
import { getUnitsForWorkspace } from "@/server/units/getUnits";

export const dynamic = "force-dynamic";

const copy = {
  appShortName: "OSO",
  appName: "OhmSweetOhm",
  appSubtitle: "Home electronics workshop",
  signOut: "Sign out",
  switchWorkspace: "Switch workspace",
  title: "Parts",
  detailsTab: "Details",
  attributesTab: "Attributes",
  partCategories: "Part categories",
  attributes: "Attributes",
  units: "Units",
  locations: "Locations",
  settingsIntegrations: "Integrations",
  intro: "Parts in this workspace.",
  catalogNumber: "Catalog number",
  description: "Description",
  value: "Value",
  attributeValues: "Attribute values",
  primaryAttributes: "Primary attributes",
  secondaryPrimaryAttributes: "Secondary primary attributes",
  primaryCategoryAttributes: "Primary category attributes",
  secondaryCategoryAttributes: "Secondary category attributes",
  categories: "Categories",
  primaryCategory: "Primary category",
  secondaryCategory: "Secondary category",
  noCategory: "No category",
  noSecondaryCategory: "No secondary category",
  manufacturer: "Manufacturer",
  unit: "Unit",
  unitPlaceholder: "Choose a unit",
  missingUnit: "Choose a unit.",
  noMatchingManufacturers: "No matching manufacturers",
  searchParts: "Search parts",
  searchPartsPlaceholder: "Search catalog, manufacturer, category, value",
  filterByCategory: "Filter by category",
  allCategories: "All categories",
  filterByManufacturer: "Filter by manufacturer",
  allManufacturers: "All manufacturers",
  clearFilters: "Clear filters",
  configureList: "Configure list",
  configureListTitle: "Configure list",
  configureListBody: "Choose visible columns, order, sorting, and widths.",
  visibleColumns: "Columns",
  attributeColumns: "Attributes",
  moveUp: "Up",
  moveDown: "Down",
  columnWidthPx: "Width",
  sortingLabel: "Sort",
  clearSorting: "None",
  resetListConfiguration: "Reset defaults",
  filteredPartsSummary: "{visible} of {total} parts",
  actions: "Actions",
  stock: "Stock",
  planned: "Planned",
  onOrder: "On order",
  avgNetCost: "Avg. net cost",
  avgGrossCost: "Avg. gross cost",
  newPartTitle: "Add part",
  newPartBody: "Create a new part.",
  editPartTitle: "Edit part",
  editPartBody: "Update this part.",
  catalogNumberPlaceholder: "NE555P",
  descriptionPlaceholder: "Timer IC in DIP-8 package",
  manufacturerPlaceholder: "Texas Instruments",
  supplierNoMatchingParts: "No matching parts found",
  supplierSearchError: "Supplier search is currently unavailable.",
  supplierSuggestionLabel: "Supplier suggestions",
  matchingDialogTitle: "Supplier matching",
  matchingDialogBody: "Review and adjust category and attribute mapping.",
  sourceManufacturerLabel: "Source manufacturer",
  targetManufacturerLabel: "Target manufacturer",
  sourceCategoryLabel: "Source category",
  targetCategoryLabel: "Target category",
  sourceAttributeLabel: "Source attribute",
  sourceValueLabel: "Source value",
  targetAttributeLabel: "Target attribute",
  noAttribute: "No attribute",
  targetValueLabel: "Target value",
  skipMatching: "Skip matching",
  confirmSkipMatchingTitle: "Skip matching?",
  confirmSkipMatchingBody: "Matching changes will be discarded.",
  noLearningSaved: "No learning will be saved.",
  keepMatching: "Keep matching",
  skipAndContinue: "Skip and continue",
  reassignTitle: "Reassign attribute?",
  reassignBody: "This target attribute is already used. Reassigning will clear the previous row.",
  reassignAction: "Reassign",
  cancelAction: "Cancel",
  categoryPlaceholder: "Choose a category",
  searchCategories: "Search categories",
  noMatchingCategories: "No matching categories",
  expandCategory: "Expand",
  collapseCategory: "Collapse",
  defaultLocation: "Default location",
  chooseDefaultLocation: "Choose a default location",
  searchLocations: "Search locations",
  noMatchingLocations: "No matching locations",
  expandLocation: "Expand",
  collapseLocation: "Collapse",
  addPart: "Add part",
  createPart: "Create part",
  editPart: "Edit",
  deletePart: "Delete",
  saveChanges: "Save changes",
  close: "Close",
  quantity: "Quantity",
  location: "Choose location",
  fromLocation: "From location",
  toLocation: "To location",
  note: "Note",
  addMovement: "Add movement",
  stockEntryType: "Entry type",
  receipt: "Receipt",
  issue: "Issue",
  transfer: "Transfer",
  adjustment: "Adjustment",
  noLocations: "No assignable locations available.",
  noBalances: "No stock recorded yet.",
  currentStock: "Current stock by location",
  stockSaved: "Stock movement saved",
  stockActionInvalid: "Check stock movement fields and try again.",
  cancelDelete: "Cancel",
  confirmDelete: "Delete",
  deleteConfirmationBody: "This cannot be undone.",
  createdToast: "Part created",
  updatedToast: "Part updated",
  deletedToast: "Part deleted",
  missingRequiredFields: "Enter catalog number, manufacturer, and unit.",
  missingCatalogNumber: "Enter a catalog number.",
  missingManufacturer: "Enter a manufacturer.",
  invalidCategory: "Choose valid assignable categories.",
  secondaryWithoutPrimary:
    "Choose a primary category before choosing a secondary category.",
  duplicateCategories: "Primary and secondary categories must be different.",
  duplicatePart:
    "A part with this manufacturer and catalog number already exists.",
  invalidAttributeValue: "Enter valid attribute values for the selected category.",
  invalidDefaultLocation: "Choose a valid, non-archived location as the default.",
  emptyTitle: "No parts yet",
  emptyBody: "Parts will appear here once they exist.",
  noMatchingPartsTitle: "No matching parts",
  noMatchingPartsBody: "Adjust the search or filters to show more parts.",
  loadingParts: "Loading parts...",
  loadingMoreParts: "Loading more parts...",
  locationsAndStock: "Locations and stock",
  noAttributes: "No attributes for this part.",
  movementHistory: "Movement history",
  noHistory: "No movements recorded yet.",
  historyColType: "Type",
  historyColQuantity: "Qty",
  historyColLocation: "Location",
  historyColDate: "Date",
  poHistory: "Purchase Orders",
  noPurchaseOrders: "No purchase orders for this part.",
  poHistoryColOrder: "Order",
  poHistoryColSupplier: "Supplier",
  poHistoryColStatus: "Status",
  poHistoryColDate: "Ordered",
  poHistoryColQty: "Qty",
  poHistoryColUnitPriceNet: "Unit Price (net)",
  poHistoryColUnitPriceGross: "Unit Price (gross)",
  shoppingLists: "Shopping Lists",
  noShoppingLists: "Not on any shopping list.",
  slMembershipColList: "List",
  slMembershipColQty: "Qty",
  slMembershipColNotes: "Notes",
  databaseUnavailable:
    "Database is not available, so the list is shown empty for now."
};

type PartsPageProps = {
  params: Promise<{
    workspaceSlug: string;
  }>;
  searchParams?: Promise<{
    partDialog?: string;
    partEditDialog?: string;
    selectedPartId?: string;
  }>;
};

export default async function PartsPage({
  params,
  searchParams
}: PartsPageProps) {
  const { workspaceSlug } = await params;
  const session = await getCurrentSession();

  if (!session) {
    redirect("/sign-in");
  }

  const context = await getCurrentWorkspaceContextBySlug(workspaceSlug);

  if (!context) {
    notFound();
  }

  const { page, isDatabaseAvailable } = await getPartsList(context);
  const [
    partCategories,
    manufacturerSuggestions,
    workspaceAttributes,
    globalWorkspaceAttributesForMatching,
    units
  ] =
    isDatabaseAvailable
    ? await Promise.all([
        getPartCategoriesForPartForm(context).catch(() => []),
        getManufacturerSuggestionsForPartForm({
          userId: context.user.id,
          workspaceId: context.workspace.id
        }).catch(() => []),
        getWorkspaceAttributes(context.workspace.id).catch(() => []),
        getEffectiveWorkspaceAttributes({
          workspaceId: context.workspace.id
        })
          .then((attributes) =>
            attributes.map((effectiveAttribute) => ({
              id: effectiveAttribute.attribute.id,
              name: effectiveAttribute.attribute.name,
              description: effectiveAttribute.attribute.description,
              type: effectiveAttribute.attribute.type,
              baseUnitSymbol: effectiveAttribute.attribute.baseUnitSymbol,
              choiceOptions: effectiveAttribute.attribute.choiceOptions
            }))
          )
          .catch(() => []),
        getUnitsForWorkspace(context.workspace.id).catch(() => [])
      ])
    : [[], [], [], [], []];
  const categoryAttributesByCategoryId = isDatabaseAvailable
    ? Object.fromEntries(
        await Promise.all(
          partCategories.map(async (category) => [
            category.id,
            category.isAssignable
              ? await getEffectivePartCategoryAttributes({
                  workspaceId: context.workspace.id,
                  categoryId: category.id
                }).catch(() => [])
              : []
          ])
        )
      )
    : {};
  const resolvedSearchParams = await searchParams;
  const partDialogOpen = resolvedSearchParams?.partDialog === "open";
  const partEditDialog = resolvedSearchParams?.partEditDialog;
  const initialSelectedPartId = resolvedSearchParams?.selectedPartId;
  const activeSupplierProvider = isDatabaseAvailable
    ? await getWorkspaceActiveSupplierProvider(context.workspace.id).catch(() => null)
    : null;
  const [canReadInventory, canWriteInventory, canReadShoppingLists, canReadPurchaseOrders] =
    isDatabaseAvailable
      ? await Promise.all([
          hasWorkspacePermission({
            userId: context.user.id,
            workspaceId: context.workspace.id,
            permission: "inventory:read"
          }).catch(() => false),
          hasWorkspacePermission({
            userId: context.user.id,
            workspaceId: context.workspace.id,
            permission: "inventory:write"
          }).catch(() => false),
          hasWorkspacePermission({
            userId: context.user.id,
            workspaceId: context.workspace.id,
            permission: "shopping-lists:read"
          }).catch(() => false),
          hasWorkspacePermission({
            userId: context.user.id,
            workspaceId: context.workspace.id,
            permission: "purchase-orders:read"
          }).catch(() => false)
        ])
      : [false, false, false, false];

  return (
    <WorkspaceShell
      activeNavItem="parts"
      intro={copy.intro}
      title={copy.title}
      userEmail={context.user.email}
      workspaceName={context.workspace.name}
      workspaceSlug={workspaceSlug}
    >
      {!isDatabaseAvailable ? (
        <p className="rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {copy.databaseUnavailable}
        </p>
      ) : null}

      <PartsListClient
        copy={copy}
        isDatabaseAvailable={isDatabaseAvailable}
        partDialogOpen={partDialogOpen}
        partEditDialog={partEditDialog}
        partCategories={partCategories}
        categoryAttributesByCategoryId={categoryAttributesByCategoryId}
        manufacturerSuggestions={manufacturerSuggestions}
        workspaceAttributes={workspaceAttributes}
        units={units}
        globalWorkspaceAttributesForMatching={globalWorkspaceAttributesForMatching}
        initialPage={page}
        workspaceSlug={workspaceSlug}
        activeSupplierProvider={activeSupplierProvider}
        canReadInventory={canReadInventory}
        canWriteInventory={canWriteInventory}
        canReadShoppingLists={canReadShoppingLists}
        canReadPurchaseOrders={canReadPurchaseOrders}
        primaryCurrency={context.workspace.primaryCurrency}
        initialSelectedPartId={initialSelectedPartId}
      />
    </WorkspaceShell>
  );
}
