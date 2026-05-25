import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { PartsListClient } from "@/app/parts-list-client";
import { signOut } from "@/server/auth/actions";
import {
  getCurrentSession,
  getCurrentWorkspaceContextBySlug
} from "@/server/auth/currentContext";
import { getManufacturerSuggestionsForPartForm } from "@/server/organizations/organizations";
import { getPartCategoriesForPartForm } from "@/server/parts/categories";
import { getPartsList } from "@/server/parts/getParts";
import { getEffectivePartCategoryAttributes } from "@/server/parts/attributes";
import { getWorkspaceAttributes } from "@/server/parts/attributeMutations";

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
  newPartTitle: "Add part",
  newPartBody: "Create a new part.",
  editPartTitle: "Edit part",
  editPartBody: "Update this part.",
  catalogNumberPlaceholder: "NE555P",
  descriptionPlaceholder: "Timer IC in DIP-8 package",
  manufacturerPlaceholder: "Texas Instruments",
  categoryPlaceholder: "Choose a category",
  searchCategories: "Search categories",
  noMatchingCategories: "No matching categories",
  expandCategory: "Expand",
  collapseCategory: "Collapse",
  addPart: "Add part",
  createPart: "Create part",
  editPart: "Edit",
  deletePart: "Delete",
  saveChanges: "Save changes",
  close: "Close",
  cancelDelete: "Cancel",
  confirmDelete: "Delete",
  deleteConfirmationBody: "This cannot be undone.",
  createdToast: "Part created",
  updatedToast: "Part updated",
  deletedToast: "Part deleted",
  missingRequiredFields: "Enter both catalog number and manufacturer.",
  missingCatalogNumber: "Enter a catalog number.",
  missingManufacturer: "Enter a manufacturer.",
  invalidCategory: "Choose valid assignable categories.",
  secondaryWithoutPrimary:
    "Choose a primary category before choosing a secondary category.",
  duplicateCategories: "Primary and secondary categories must be different.",
  duplicatePart:
    "A part with this manufacturer and catalog number already exists.",
  invalidAttributeValue: "Enter valid attribute values for the selected category.",
  emptyTitle: "No parts yet",
  emptyBody: "Parts will appear here once they exist.",
  noMatchingPartsTitle: "No matching parts",
  noMatchingPartsBody: "Adjust the search or filters to show more parts.",
  loadingParts: "Loading parts...",
  loadingMoreParts: "Loading more parts...",
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
  const [partCategories, manufacturerSuggestions, workspaceAttributes] =
    isDatabaseAvailable
    ? await Promise.all([
        getPartCategoriesForPartForm(context).catch(() => []),
        getManufacturerSuggestionsForPartForm({
          userId: context.user.id,
          workspaceId: context.workspace.id
        }).catch(() => []),
        getWorkspaceAttributes(context.workspace.id).catch(() => [])
      ])
    : [[], [], []];
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

  return (
    <main className="h-screen overflow-hidden bg-slate-100 text-slate-950">
      <div className="flex h-full min-h-0">
        <aside className="flex h-full w-60 shrink-0 flex-col border-r border-slate-200 bg-white">
          <div className="flex min-h-14 items-center gap-3 border-b border-slate-200 px-4">
            <div className="grid h-8 w-8 place-items-center rounded-md bg-[var(--color-accent)] text-sm font-semibold text-white">
              {copy.appShortName}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold leading-5 text-slate-950">
                {copy.appName}
              </p>
              <p className="truncate text-xs leading-4 text-slate-500">
                {context.workspace.name}
              </p>
            </div>
          </div>
          <nav
            className="flex min-h-0 flex-1 flex-col gap-1 overflow-auto p-3"
            aria-label="Main navigation"
          >
            <Link
              className="flex min-h-10 items-center rounded-md bg-[var(--color-accent-soft)] px-3 text-sm font-semibold text-slate-950"
              href={`/w/${workspaceSlug}/parts`}
              aria-current="page"
            >
              {copy.title}
            </Link>
            <Link
              className="flex min-h-10 items-center rounded-md px-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              href={`/w/${workspaceSlug}/part-categories`}
            >
              {copy.partCategories}
            </Link>
            <Link
              className="flex min-h-10 items-center rounded-md px-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              href={`/w/${workspaceSlug}/attributes`}
            >
              {copy.attributes}
            </Link>
          </nav>
          <div className="border-t border-slate-200 p-3">
            <p className="mb-2 truncate text-xs leading-5 text-slate-500">
              {context.user.email}
            </p>
            <Link
              className="mb-2 flex min-h-10 items-center rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2"
              href="/workspaces"
            >
              {copy.switchWorkspace}
            </Link>
            <form action={signOut}>
              <button
                className="min-h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-left text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2"
                type="submit"
              >
                {copy.signOut}
              </button>
            </form>
          </div>
        </aside>

        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          <div className="flex min-h-0 flex-1 flex-col gap-4 p-6">
            <header className="flex items-end justify-between gap-2 border-b border-slate-200 pb-4">
              <div>
                <h1 className="text-2xl font-semibold tracking-normal text-slate-950">
                  {copy.title}
                </h1>
                <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">
                  {copy.intro}
                </p>
              </div>
            </header>

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
              initialPage={page}
              workspaceSlug={workspaceSlug}
            />
          </div>
        </div>
      </div>
    </main>
  );
}
