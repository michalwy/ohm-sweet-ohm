import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { PartCategoriesClient } from "@/app/part-categories-client";
import { hasWorkspacePermission } from "@/server/access-control/authorize";
import { signOut } from "@/server/auth/actions";
import {
  getCurrentSession,
  getCurrentWorkspaceContextBySlug
} from "@/server/auth/currentContext";
import {
  getPartCategoriesForManagement,
  type PartCategoryListItem
} from "@/server/parts/categories";
import { getWorkspaceAttributes } from "@/server/parts/attributeMutations";
import type { AttributeListItem } from "@/server/parts/attributeMutations";

export const dynamic = "force-dynamic";

const copy = {
  appShortName: "OSO",
  appName: "OhmSweetOhm",
  signOut: "Sign out",
  switchWorkspace: "Switch workspace",
  parts: "Parts",
  attributes: "Attributes",
  title: "Part categories",
  intro:
    "Manage the category tree used to organize real purchasable electronic parts.",
  addRootCategory: "Add root category",
  addChild: "Add child",
  edit: "Edit",
  delete: "Delete",
  configureAttributes: "Configure attributes",
  categoryAttributes: "Category attributes",
  detailsTab: "Details",
  attributesTab: "Attributes",
  createCategoryBeforeAttributes:
    "Create the category before assigning attributes.",
  attribute: "Attribute",
  sortOrder: "Sort order",
  defaultValue: "Default value",
  valueAttribute: "Value attribute",
  primaryAttribute: "Primary attribute",
  inherited: "Inherited",
  local: "Local",
  attachAttribute: "Attach",
  globalAttributes: "Global attributes",
  globalAttributesTitle: "Global attributes",
  globalAttributesBody:
    "Manage attributes inherited by all root categories in this workspace.",
  saveGlobalAttributes: "Save global attributes",
  saveAttributeConfig: "Save configuration",
  detachAttribute: "Detach",
  noValueAttribute: "No local value",
  noAttributes: "No attributes configured",
  selectCategory: "Select a category",
  attributeConfigUpdatedToast: "Category attribute configuration updated",
  attributeConfigDeletedToast: "Category attribute configuration removed",
  valueAttributeUpdatedToast: "Value attribute updated",
  expandCategory: "Expand",
  collapseCategory: "Collapse",
  searchCategories: "Search categories",
  noMatchingCategories: "No matching categories",
  actions: "Actions",
  newCategoryTitle: "Add category",
  newCategoryBody: "Create a category in the parts category tree.",
  editCategoryTitle: "Edit category",
  editCategoryBody: "Update this category's name, parent, and assignment type.",
  name: "Name",
  namePlaceholder: "Resistors",
  parentCategory: "Parent category",
  rootCategory: "No parent",
  type: "Type",
  organizational: "Organizational",
  assignable: "Assignable",
  createCategory: "Create category",
  saveChanges: "Save changes",
  close: "Close",
  cancelDelete: "Cancel",
  confirmDelete: "Delete",
  deleteConfirmationBody: "This cannot be undone.",
  createdToast: "Category created",
  updatedToast: "Category updated",
  deletedToast: "Category deleted",
  missingRequiredFields: "Enter a category name.",
  invalidParentCategory: "Choose a valid parent category.",
  categoryNotFound: "This category is no longer available.",
  categoryTreeCycle: "Choose a parent outside this category branch.",
  categoryInUseByParts:
    "This category is used by parts and cannot be deleted.",
  categoryHasChildren:
    "Delete child categories before deleting this category.",
  permissionDenied: "You do not have permission to manage categories.",
  invalidAttributeDefaultValue:
    "Choose a valid default value for each category attribute.",
  emptyTitle: "No categories yet",
  emptyBody: "Create a root category to start organizing the parts tree.",
  databaseUnavailable:
    "Database is not available, so the category tree is shown empty for now."
};

type PartCategoriesPageProps = {
  params: Promise<{
    workspaceSlug: string;
  }>;
  searchParams?: Promise<{
    categoryDialog?: string;
    categoryEditDialog?: string;
  }>;
};

export default async function PartCategoriesPage({
  params,
  searchParams
}: PartCategoriesPageProps) {
  const { workspaceSlug } = await params;
  const session = await getCurrentSession();

  if (!session) {
    redirect("/sign-in");
  }

  const context = await getCurrentWorkspaceContextBySlug(workspaceSlug);

  if (!context) {
    notFound();
  }

  let isDatabaseAvailable = true;
  let categories: PartCategoryListItem[] = [];
  let attributes: AttributeListItem[] = [];

  try {
    [categories, attributes] = await Promise.all([
      getPartCategoriesForManagement(context),
      getWorkspaceAttributes(context.workspace.id)
    ]);
  } catch {
    isDatabaseAvailable = false;
  }

  const canWriteCategories = isDatabaseAvailable
    ? await hasWorkspacePermission({
        userId: context.user.id,
        workspaceId: context.workspace.id,
        permission: "part-categories:write"
      }).catch(() => false)
    : false;
  const resolvedSearchParams = await searchParams;
  const categoryDialogOpen = resolvedSearchParams?.categoryDialog === "create";
  const categoryEditDialog = resolvedSearchParams?.categoryEditDialog;

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
              className="flex min-h-10 items-center rounded-md px-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              href={`/w/${workspaceSlug}/parts`}
            >
              {copy.parts}
            </Link>
            <Link
              className="flex min-h-10 items-center rounded-md bg-[var(--color-accent-soft)] px-3 text-sm font-semibold text-slate-950"
              href={`/w/${workspaceSlug}/part-categories`}
              aria-current="page"
            >
              {copy.title}
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

            <PartCategoriesClient
              categories={categories}
              categoryDialogOpen={categoryDialogOpen}
              categoryEditDialog={categoryEditDialog}
              canWriteCategories={canWriteCategories}
              copy={copy}
              isDatabaseAvailable={isDatabaseAvailable}
              attributes={attributes}
              workspaceSlug={workspaceSlug}
            />
          </div>
        </div>
      </div>
    </main>
  );
}
