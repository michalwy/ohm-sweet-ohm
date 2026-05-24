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
import { getEffectivePartCategoryParameters } from "@/server/parts/parameters";

export const dynamic = "force-dynamic";

const copy = {
  appShortName: "OSO",
  appName: "OhmSweetOhm",
  appSubtitle: "Home electronics workshop",
  signOut: "Sign out",
  switchWorkspace: "Switch workspace",
  title: "Parts",
  detailsTab: "Details",
  parametersTab: "Parameters",
  partCategories: "Part categories",
  parameters: "Parameters",
  intro:
    "Real purchasable electronic parts tracked by manufacturer and catalog number.",
  catalogNumber: "Catalog number",
  value: "Value",
  parameterValues: "Parameter values",
  primaryParameters: "Primary parameters",
  secondaryPrimaryParameters: "Secondary primary parameters",
  primaryCategoryParameters: "Primary category parameters",
  secondaryCategoryParameters: "Secondary category parameters",
  categories: "Categories",
  primaryCategory: "Primary category",
  secondaryCategory: "Secondary category",
  noCategory: "No category",
  noSecondaryCategory: "No secondary category",
  manufacturer: "Manufacturer",
  noMatchingManufacturers: "No matching manufacturers",
  actions: "Actions",
  newPartTitle: "Add part",
  newPartBody: "Create a real purchasable electronic part.",
  editPartTitle: "Edit part",
  editPartBody: "Update this part's manufacturer and catalog number.",
  catalogNumberPlaceholder: "NE555P",
  manufacturerPlaceholder: "Texas Instruments",
  categoryPlaceholder: "Choose a category",
  searchCategories: "Search categories",
  noMatchingCategories: "No matching categories",
  expandCategory: "Expand",
  collapseCategory: "Collapse",
  addPart: "Add part",
  createPart: "Create part",
  editPart: "Edit",
  saveChanges: "Save changes",
  close: "Close",
  createdToast: "Part created",
  updatedToast: "Part updated",
  missingRequiredFields: "Enter both catalog number and manufacturer.",
  invalidCategory: "Choose valid assignable categories.",
  secondaryWithoutPrimary:
    "Choose a primary category before choosing a secondary category.",
  duplicateCategories: "Primary and secondary categories must be different.",
  duplicatePart:
    "A part with this manufacturer and catalog number already exists.",
  invalidParameterValue: "Enter valid parameter values for the selected category.",
  emptyTitle: "No parts yet",
  emptyBody: "Parts will appear here once they exist.",
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

  const { parts, isDatabaseAvailable } = await getPartsList(context);
  const [partCategories, manufacturerSuggestions] = isDatabaseAvailable
    ? await Promise.all([
        getPartCategoriesForPartForm(context).catch(() => []),
        getManufacturerSuggestionsForPartForm({
          userId: context.user.id,
          workspaceId: context.workspace.id
        }).catch(() => [])
      ])
    : [[], []];
  const categoryParametersByCategoryId = isDatabaseAvailable
    ? Object.fromEntries(
        await Promise.all(
          partCategories.map(async (category) => [
            category.id,
            category.isAssignable
              ? await getEffectivePartCategoryParameters({
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
    <main className="min-h-screen bg-slate-100 text-slate-950">
      <div className="flex min-h-screen">
        <aside className="flex w-60 shrink-0 flex-col border-r border-slate-200 bg-white">
          <div className="flex min-h-14 items-center gap-3 border-b border-slate-200 px-4">
            <div className="grid h-8 w-8 place-items-center rounded-md bg-slate-950 text-sm font-semibold text-white">
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
            className="flex flex-1 flex-col gap-1 p-3"
            aria-label="Main navigation"
          >
            <Link
              className="flex min-h-10 items-center rounded-md bg-slate-100 px-3 text-sm font-semibold text-slate-950"
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
              href={`/w/${workspaceSlug}/parameters`}
            >
              {copy.parameters}
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

        <div className="flex min-w-0 flex-1 flex-col">
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
              categoryParametersByCategoryId={categoryParametersByCategoryId}
              manufacturerSuggestions={manufacturerSuggestions}
              parts={parts}
              workspaceSlug={workspaceSlug}
            />
          </div>
        </div>
      </div>
    </main>
  );
}
