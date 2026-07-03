import { notFound, redirect } from "next/navigation";

import { BuildsClient, type BuildsCopy } from "@/app/builds-client";
import { WorkspaceShell } from "@/app/workspace-shell";
import { hasWorkspacePermission } from "@/server/access-control/authorize";
import {
  getCurrentSession,
  getCurrentWorkspaceContextBySlug
} from "@/server/auth/currentContext";
import { getBuildsForWorkspace } from "@/server/builds/builds";

export const dynamic = "force-dynamic";

const copy: BuildsCopy = {
  title: "Builds",
  intro: "Builds are production runs of a design revision that consume stock and produce the output part.",
  configureList: "Configure list",
  visibleColumns: "Visible columns",
  newBuild: "New build",
  newBuildTitle: "New build",
  design: "Design",
  revision: "Revision",
  targetQuantity: "Target quantity",
  state: "State",
  progress: "Assembled",
  createdAt: "Created",
  close: "Close",
  cancel: "Cancel",
  outputLocation: "Output location",
  outputPart: "Output part",
  selectDesign: "Select a design",
  selectRevision: "Select a revision",
  selectLocation: "Select a location",
  createBuild: "Create build",
  noBuilds: "No builds yet",
  noBuildsBody: "Builds will appear here once created.",
  loadingBuilds: "Loading builds...",
  loadingMoreBuilds: "Loading more builds...",
  loadError: "Failed to load builds.",
  designRequired: "Select a design.",
  revisionRequired: "Select a revision.",
  targetQuantityRequired: "Enter a whole quantity of at least 1.",
  permissionDenied: "You do not have permission to perform this action.",
  databaseUnavailable: "Database is not available.",
  invalidInput: "Check the fields and try again.",
  createdToast: "Build created",
  bom: "Bill of materials",
  designators: "Designators",
  part: "Part",
  sourceLocation: "Source location",
  unassigned: "Unassigned",
  available: "available",
  quantity: "Qty",
  noAvailableParts: "No matching parts with available stock",
  addPartEntry: "Add part",
  removeEntry: "Remove",
  applyAllocation: "Apply",
  applyBeforeAllocate: "Apply your allocation changes first.",
  allocatedOfRequired: "Allocated",
  allocationTotalMismatch: "Allocated quantity must equal the required quantity.",
  invalidAllocationQuantity: "Each entry needs a whole quantity of at least 1.",
  partDoesNotMatchSpec: "That part does not match this line's spec.",
  changePart: "Change part",
  confirm: "Confirm",
  markAllocated: "Allocate",
  reopen: "Reopen",
  start: "Start",
  cancelBuild: "Cancel build",
  deleteBuild: "Delete",
  assembleOne: "Assemble one",
  assembleAll: "All",
  notFullyAllocated: "Every line needs a part and a source location.",
  insufficientAvailableStock: "Not enough available stock to reserve for this build.",
  insufficientLocationStock: "The chosen source location does not hold enough stock.",
  outputLocationRequired: "Set an output location before completing the build.",
  chooseLocation: "Choose a location",
  searchLocations: "Search locations",
  noMatchingLocations: "No matching locations",
  expandLocation: "Expand",
  collapseLocation: "Collapse",
  states: {
    CREATED: "Created",
    ALLOCATED: "Allocated",
    STARTED: "Started",
    IN_PROGRESS: "In progress",
    COMPLETED: "Completed",
    CANCELLED: "Cancelled"
  }
};

type BuildsPageProps = {
  params: Promise<{ workspaceSlug: string }>;
};

export default async function BuildsPage({ params }: BuildsPageProps) {
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
    getBuildsForWorkspace({
      userId: context.user.id,
      workspaceId: context.workspace.id
    }).catch(() => emptyPage),
    hasWorkspacePermission({
      userId: context.user.id,
      workspaceId: context.workspace.id,
      permission: "builds:write"
    }).catch(() => false)
  ]);

  return (
    <WorkspaceShell
      activeNavItem="builds"
      intro={copy.intro}
      title={copy.title}
      userEmail={context.user.email}
      workspaceName={context.workspace.name}
      workspaceSlug={workspaceSlug}
    >
      <BuildsClient
        canWrite={canWrite}
        copy={copy}
        initialPage={initialPage}
        workspaceSlug={workspaceSlug}
      />
    </WorkspaceShell>
  );
}
