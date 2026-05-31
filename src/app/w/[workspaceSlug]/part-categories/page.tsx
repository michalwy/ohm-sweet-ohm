import { notFound, redirect } from "next/navigation";

import { PartCategoriesClient } from "@/app/part-categories-client";
import { WorkspaceShell } from "@/app/workspace-shell";
import { hasWorkspacePermission } from "@/server/access-control/authorize";
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
  units: "Units",
  locations: "Locations",
  settingsIntegrations: "Integrations",
  title: "Part categories",
  intro:
    "Manage the category tree used to organize electronic parts.",
  addRootCategory: "Add root category",
  quickCreatePath: "Quick create path",
  quickCreatePathTitle: "Quick create path",
  quickCreatePathBody:
    "Create nested categories from a slash-separated path, for example Passives / Capacitors / Audio.",
  path: "Path",
  pathPlaceholder: "Passives / Capacitors / Audio / Electrolytic",
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
    <WorkspaceShell
      activeNavItem="part-categories"
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
    </WorkspaceShell>
  );
}
