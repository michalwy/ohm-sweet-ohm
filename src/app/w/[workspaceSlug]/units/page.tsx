import { notFound, redirect } from "next/navigation";

import { UnitsClient } from "@/app/units-client";
import { WorkspaceShell } from "@/app/workspace-shell";
import { actorHasPermission } from "@/server/access-control/actor";
import {
  getCurrentSession,
  getCurrentWorkspaceContextBySlug
} from "@/server/auth/currentContext";
import { getUnitsPageForWorkspace } from "@/server/units/unitMutations";
import type { UnitListItem } from "@/server/units/unitMutations";
import type { ListPage } from "@/server/pagination";

export const dynamic = "force-dynamic";

const copy = {
  appShortName: "OSO",
  appName: "OhmSweetOhm",
  signOut: "Sign out",
  switchWorkspace: "Switch workspace",
  parts: "Parts",
  partCategories: "Part categories",
  attributes: "Attributes",
  locations: "Locations",
  settingsIntegrations: "Integrations",
  title: "Units",
  intro: "Manage workspace units used by parts and inventory quantities.",
  addUnit: "Add unit",
  edit: "Edit",
  delete: "Delete",
  close: "Close",
  cancelDelete: "Cancel",
  confirmDelete: "Delete",
  deleteConfirmationBody: "This cannot be undone.",
  createUnit: "Create unit",
  saveChanges: "Save changes",
  newUnitTitle: "Add unit",
  editUnitTitle: "Edit unit",
  name: "Name",
  symbol: "Symbol",
  allowsFraction: "Allows fractional quantities",
  yes: "Yes",
  no: "No",
  actions: "Actions",
  duplicateUnitName: "A unit with this name already exists.",
  unitInUse: "This unit is used by parts and cannot be deleted.",
  unitNotFound: "This unit is no longer available.",
  permissionDenied: "You do not have permission to manage units.",
  databaseUnavailable: "Database is not available right now.",
  noUnits: "No units yet.",
  createdToast: "Unit created",
  updatedToast: "Unit updated",
  deletedToast: "Unit deleted",
  invalidInput: "Check the unit fields and try again.",
  configureList: "Configure list",
  visibleColumns: "Visible columns",
  listCountSummary: "{visible} of {total}",
  loadingUnits: "Loading units...",
  loadingMore: "Loading more units...",
  loadError: "Database is not available right now.",
  databaseUnavailableBanner:
    "Database is not available, so units cannot be managed right now."
};

type UnitsPageProps = {
  params: Promise<{
    workspaceSlug: string;
  }>;
};

export default async function UnitsPage({ params }: UnitsPageProps) {
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
  let unitsPage: ListPage<UnitListItem> = {
    items: [],
    nextCursor: null,
    totalCount: 0,
    filteredCount: 0
  };

  try {
    unitsPage = await getUnitsPageForWorkspace({
      workspaceId: context.workspace.id
    });
  } catch {
    isDatabaseAvailable = false;
  }

  const canWriteUnits = isDatabaseAvailable
    ? actorHasPermission(context, "units:write")
    : false;

  return (
    <WorkspaceShell
      activeNavItem="units"
      intro={copy.intro}
      title={copy.title}
      userEmail={context.user.email}
      workspaceName={context.workspace.name}
      workspaceSlug={workspaceSlug}
    >
      {!isDatabaseAvailable ? (
        <p className="rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {copy.databaseUnavailableBanner}
        </p>
      ) : null}

      <UnitsClient
        canWriteUnits={canWriteUnits}
        copy={copy}
        initialPage={unitsPage}
        isDatabaseAvailable={isDatabaseAvailable}
        workspaceSlug={workspaceSlug}
      />
    </WorkspaceShell>
  );
}
