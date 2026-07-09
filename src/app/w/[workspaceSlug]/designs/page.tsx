import { notFound, redirect } from "next/navigation";

import { DesignsClient } from "@/app/designs-client";
import { WorkspaceShell } from "@/app/workspace-shell";
import { hasWorkspacePermission } from "@/server/access-control/authorize";
import {
  getCurrentSession,
  getCurrentWorkspaceContextBySlug
} from "@/server/auth/currentContext";
import { getDesignsForWorkspace } from "@/server/designs/designs";

export const dynamic = "force-dynamic";

const copy = {
  title: "Designs",
  intro: "Designs represent recipes for building parts in-house.",
  configureList: "Configure list",
  visibleColumns: "Visible columns",
  newDesign: "New design",
  newDesignTitle: "New design",
  editDesignTitle: "Edit design",
  name: "Name",
  namePlaceholder: "USB Hub v2",
  description: "Description",
  descriptionPlaceholder: "Optional description",
  catalogNumber: "Output part catalog number",
  catalogNumberPlaceholder: "DESIGN-0001",
  outputPart: "Output part",
  revisions: "Revisions",
  latestRevision: "Latest",
  createdAt: "Created",
  actions: "Actions",
  edit: "Edit",
  delete: "Delete",
  close: "Close",
  cancel: "Cancel",
  cancelDelete: "Cancel",
  confirmDelete: "Delete",
  deleteConfirmationBody: "This will delete the design and its output part. This cannot be undone.",
  createDesign: "Create design",
  saveChanges: "Save changes",
  noDesigns: "No designs yet",
  noDesignsBody: "Designs will appear here once created.",
  loadingDesigns: "Loading designs...",
  loadingMoreDesigns: "Loading more designs...",
  loadError: "Failed to load designs.",
  nameRequired: "Enter a name.",
  catalogNumberRequired: "Enter a catalog number.",
  catalogNumberTaken: "A part with this catalog number already exists.",
  outputPartHasStock: "The output part has stock and cannot be deleted.",
  outputPartHasInventoryHistory: "The output part has inventory history and cannot be deleted.",
  notFound: "Design not found.",
  permissionDenied: "You do not have permission to perform this action.",
  databaseUnavailable: "Database is not available.",
  createdToast: "Design created",
  updatedToast: "Design updated",
  deletedToast: "Design deleted",
  invalidInput: "Check the fields and try again.",
  detailsTab: "Details",
  revisionsTab: "Revisions",
  revisionNumber: "Revision",
  revisionNotes: "Notes",
  addRevision: "Add revision",
  addRevisionTitle: "New revision notes (optional)",
  notesPlaceholder: "What changed in this revision?",
  addRevisionConfirm: "Add revision",
  noRevisions: "No revisions yet.",
  editNotes: "Edit notes",
  saveNotes: "Save",
  cancelEdit: "Cancel",
  bomSection: "Bill of materials",
  addLineItem: "Add line item",
  noLineItems: "No line items yet.",
  selectRevisionForBom: "Select a revision to view its bill of materials.",
  lineItemDesignators: "Designators",
  lineItemQuantity: "Qty",
  lineItemSpec: "Spec",
  lineItemMatches: "Matches",
  pinnedLabel: "Pinned",
  deleteLineItem: "Delete line item",
  deleteLineItemBody: "This will remove the line item and its attribute matchers.",
  lineItemCreatedToast: "Line item added",
  lineItemUpdatedToast: "Line item updated",
  lineItemDeletedToast: "Line item removed",
  productionBuilds: "In Production",
  productionBuildsColBuild: "Build",
  productionBuildsColState: "State",
  productionBuildsColQty: "Qty",
  buildStates: {
    ALLOCATING: "Allocating",
    STARTED: "Started",
    IN_PROGRESS: "In progress",
    COMPLETED: "Completed",
    CANCELLED: "Cancelled"
  }
};

type DesignsPageProps = {
  params: Promise<{ workspaceSlug: string }>;
};

export default async function DesignsPage({ params }: DesignsPageProps) {
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

  const [initialPage, canWrite, canWriteShoppingLists, canReadBuilds] = await Promise.all([
    getDesignsForWorkspace({
      userId: context.user.id,
      workspaceId: context.workspace.id
    }).catch(() => emptyPage),
    hasWorkspacePermission({
      userId: context.user.id,
      workspaceId: context.workspace.id,
      permission: "designs:write"
    }).catch(() => false),
    hasWorkspacePermission({
      userId: context.user.id,
      workspaceId: context.workspace.id,
      permission: "shopping-lists:write"
    }).catch(() => false),
    hasWorkspacePermission({
      userId: context.user.id,
      workspaceId: context.workspace.id,
      permission: "builds:read"
    }).catch(() => false)
  ]);

  return (
    <WorkspaceShell
      activeNavItem="designs"
      intro={copy.intro}
      title={copy.title}
      userEmail={context.user.email}
      workspaceName={context.workspace.name}
      workspaceSlug={workspaceSlug}
    >
      <DesignsClient
        canReadBuilds={canReadBuilds}
        canWrite={canWrite}
        canWriteShoppingLists={canWriteShoppingLists}
        copy={copy}
        initialPage={initialPage}
        workspaceSlug={workspaceSlug}
      />
    </WorkspaceShell>
  );
}
