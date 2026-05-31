import { notFound, redirect } from "next/navigation";

import { LocationsClient } from "@/app/locations-client";
import { WorkspaceShell } from "@/app/workspace-shell";
import { hasWorkspacePermission } from "@/server/access-control/authorize";
import {
  getCurrentSession,
  getCurrentWorkspaceContextBySlug
} from "@/server/auth/currentContext";
import { getStorageLocations } from "@/server/inventory/locationMutations";
import type { StorageLocationListItem } from "@/server/inventory/locationMutations";

export const dynamic = "force-dynamic";

const copy = {
  appShortName: "OSO",
  appName: "OhmSweetOhm",
  signOut: "Sign out",
  switchWorkspace: "Switch workspace",
  parts: "Parts",
  partCategories: "Part categories",
  attributes: "Attributes",
  units: "Units",
  locations: "Locations",
  settingsIntegrations: "Integrations",
  title: "Storage locations",
  intro: "Manage the location tree used to track inventory balances.",
  addLocation: "Add location",
  addChild: "Add child",
  edit: "Edit",
  delete: "Delete",
  close: "Close",
  cancelDelete: "Cancel",
  confirmDelete: "Delete",
  deleteConfirmationBody: "This cannot be undone.",
  createLocation: "Create location",
  saveChanges: "Save changes",
  newLocationTitle: "Add location",
  editLocationTitle: "Edit location",
  name: "Name",
  parentLocation: "Parent location",
  rootLocation: "No parent",
  type: "Type",
  assignable: "Assignable",
  organizational: "Organizational",
  archived: "Archived",
  yes: "Yes",
  no: "No",
  expandLocation: "Expand",
  collapseLocation: "Collapse",
  noLocations: "No locations yet.",
  actions: "Actions",
  invalidInput: "Check the location fields and try again.",
  duplicateLocationName: "A sibling location with this name already exists.",
  locationInUse: "This location is used and cannot be deleted.",
  locationHasChildren: "Delete child locations before deleting this location.",
  databaseUnavailable:
    "Database is not available, so locations cannot be managed right now."
};

type LocationsPageProps = {
  params: Promise<{
    workspaceSlug: string;
  }>;
};

export default async function LocationsPage({ params }: LocationsPageProps) {
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
  let locations: StorageLocationListItem[] = [];

  try {
    locations = await getStorageLocations(context.workspace.id);
  } catch {
    isDatabaseAvailable = false;
  }

  const canWriteLocations = isDatabaseAvailable
    ? await hasWorkspacePermission({
        userId: context.user.id,
        workspaceId: context.workspace.id,
        permission: "locations:write"
      }).catch(() => false)
    : false;

  return (
    <WorkspaceShell
      activeNavItem="locations"
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

      <LocationsClient
        canWriteLocations={canWriteLocations}
        copy={copy}
        initialLocations={locations}
        isDatabaseAvailable={isDatabaseAvailable}
        workspaceSlug={workspaceSlug}
      />
    </WorkspaceShell>
  );
}
