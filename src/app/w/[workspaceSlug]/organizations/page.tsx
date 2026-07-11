import { notFound, redirect } from "next/navigation";

import { OrganizationsClient } from "@/app/organizations-client";
import { WorkspaceShell } from "@/app/workspace-shell";
import { hasWorkspacePermission } from "@/server/access-control/authorize";
import {
  getCurrentSession,
  getCurrentWorkspaceContextBySlug
} from "@/server/auth/currentContext";
import { getOrganizationsForWorkspace } from "@/server/organizations/organizations";

export const dynamic = "force-dynamic";

const copy = {
  title: "Organizations",
  intro: "Manufacturers, suppliers, and other organizations you work with.",
  addOrganization: "Add organization",
  newOrganizationTitle: "New organization",
  editOrganizationTitle: "Edit organization",
  name: "Name",
  namePlaceholder: "Acme Electronics",
  roles: "Roles",
  roleManufacturer: "Manufacturer",
  roleSupplier: "Supplier",
  createdAt: "Created",
  actions: "Actions",
  edit: "Edit",
  delete: "Delete",
  close: "Close",
  cancel: "Cancel",
  cancelDelete: "Cancel",
  confirmDelete: "Delete",
  deleteConfirmationBody: "This cannot be undone.",
  deleteOrganization: "Delete organization",
  createOrganization: "Create organization",
  saveChanges: "Save changes",
  noOrganizations: "No organizations yet. Add one to start.",
  loadError: "Failed to load organizations.",
  loadingOrganizations: "Loading organizations...",
  loadingMore: "Loading more...",
  nameRequired: "Enter a name.",
  roleRequired: "Select at least one role.",
  nameTaken: "An organization with this name already exists.",
  referencedByParts:
    "This organization is used as a manufacturer on one or more parts and cannot be deleted.",
  referencedByPurchaseOrders:
    "This organization is used as a supplier on one or more purchase orders and cannot be deleted.",
  notFound: "Organization not found.",
  permissionDenied: "You do not have permission to perform this action.",
  databaseUnavailable: "Database is not available.",
  createdToast: "Organization created",
  updatedToast: "Organization updated",
  deletedToast: "Organization deleted",
  invalidInput: "Check the fields and try again.",
  configureList: "Configure list",
  visibleColumns: "Columns",
  listCountSummary: "{visible} of {total} organizations",
  searchOrganizations: "Search organizations",
  configureFilters: "Filters",
  clearFilters: "Clear filters",
  availableFilters: "Available filters",
  currency: "Default currency",
  chooseCurrency: "No default",
  defaultPriceEntryMode: "Default price entry mode",
  priceEntryModeNet: "Net",
  priceEntryModeGross: "Gross",
  priceEntryModeNone: "No default",
  defaultTaxRate: "Default tax rate (%)",
  defaultTaxRatePlaceholder: "0"
};

type OrganizationsPageProps = {
  params: Promise<{ workspaceSlug: string }>;
};

export default async function OrganizationsPage({ params }: OrganizationsPageProps) {
  const { workspaceSlug } = await params;
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
    getOrganizationsForWorkspace({
      userId: context.user.id,
      workspaceId: context.workspace.id
    }).catch(() => emptyPage),
    hasWorkspacePermission({
      userId: context.user.id,
      workspaceId: context.workspace.id,
      permission: "organizations:write"
    }).catch(() => false)
  ]);

  return (
    <WorkspaceShell
      activeNavItem="organizations"
      intro={copy.intro}
      title={copy.title}
      userEmail={context.user.email}
      workspaceName={context.workspace.name}
      workspaceSlug={workspaceSlug}
    >
      <OrganizationsClient
        canWrite={canWrite}
        copy={copy}
        initialPage={initialPage}
        workspaceSlug={workspaceSlug}
      />
    </WorkspaceShell>
  );
}
