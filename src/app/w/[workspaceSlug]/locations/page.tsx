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
  generateLocations: "Generate locations",
  generatedToast: "Locations created: {created}.",
  generatedWithReusedToast: "Locations created: {created}. Already existing, kept: {reused}.",
  generator: {
    title: "Generate locations",
    description:
      "Create a whole structure at once, such as a cabinet with rows and bins. Every location of a level gets the whole next level inside it.",
    generate: "Generate locations",
    parentLocation: "Create inside",
    rootLocation: "No parent",
    chooseParentLocation: "Choose a parent location",
    searchLocations: "Search locations",
    noMatchingLocations: "No matching locations",
    expandLocation: "Expand",
    collapseLocation: "Collapse",
    close: "Close",
    levels: "Levels",
    level: "Level",
    prefix: "Prefix",
    counter: "Counter",
    numbers: "Numbers",
    letters: "Letters",
    start: "Start",
    count: "Count",
    padding: "Zero padding",
    paddingAuto: "Auto",
    paddingNone: "None",
    paddingDigits: "{digits} digits",
    suffix: "Suffix",
    type: "Type",
    assignable: "Assignable",
    organizational: "Organizational",
    addLevel: "Add level",
    removeLevel: "Remove level",
    tokenHelp:
      "Use {1}, {2}, … in a prefix or suffix to insert the counter of that level, e.g. prefix R{1}C on level 2 gives R1C1. Names that already exist in the same place are kept and filled in, which is how you extend a structure.",
    preview: "Preview",
    previewSummary: "New: {new} · Already existing: {existing}",
    previewMore: "…and {count} more",
    exists: "Already exists",
    nothingNew: "Every location already exists; nothing new to create.",
    issueNoLevels: "Add at least one level.",
    issueCount: "Level {level}: count must be a whole number from 1 to {max}.",
    issueStart:
      "Level {level}: start must be a whole number for a number counter, or one to three letters for a letter counter.",
    issuePadding: "Level {level}: choose a zero padding.",
    issueToken:
      "Level {level}: a prefix or suffix can only insert the counter of this level or a level above it.",
    issueTooManyPlanned:
      "The structure describes more than {max} locations. Lower the counts.",
    issueTooManyNew: "New locations: {count}. At most {max} can be generated at once.",
    errorTooManyNew: "At most {max} locations can be generated at once.",
    errorParentMissing: "The parent location no longer exists.",
    errorDuplicate:
      "Some of these locations were created elsewhere at the same time. Close the dialog and try again.",
    errorGeneric: "The locations could not be generated. Try again."
  },
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
  chooseParentLocation: "Choose a parent location",
  searchLocations: "Search locations",
  noMatchingLocations: "No matching locations",
  expandLocation: "Expand",
  collapseLocation: "Collapse",
  noLocations: "No locations yet.",
  filterArchived: "Archived",
  filterParentLocation: "Parent location",
  actions: "Actions",
  invalidInput: "Check the location fields and try again.",
  duplicateLocationName: "A sibling location with this name already exists.",
  locationInUse: "This location is used and cannot be deleted.",
  locationHasChildren: "Delete child locations before deleting this location.",
  locationHasStock:
    "This location still has stock. Move or adjust stock to zero before archiving.",
  databaseUnavailable:
    "Database is not available, so locations cannot be managed right now.",
  storedParts: "Stored parts",
  includeSublocations: "Include sublocations",
  part: "Part",
  location: "Location",
  stock: "Stock",
  available: "Available",
  loadingStock: "Loading stock…",
  loadStockError: "Stock could not be loaded.",
  noStoredParts: "No parts are stored here.",
  noStoredPartsWithSublocations: "No parts are stored here or in any sublocation."
};

type LocationsPageProps = {
  params: Promise<{
    workspaceSlug: string;
  }>;
  searchParams?: Promise<{ selectedLocationId?: string }>;
};

export default async function LocationsPage({ params, searchParams }: LocationsPageProps) {
  const { workspaceSlug } = await params;
  const resolvedSearchParams = await searchParams;
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

  const [canWriteLocations, canReadInventory] = isDatabaseAvailable
    ? await Promise.all(
        (["locations:write", "inventory:read"] as const).map((permission) =>
          hasWorkspacePermission({
            userId: context.user.id,
            workspaceId: context.workspace.id,
            permission
          }).catch(() => false)
        )
      )
    : [false, false];

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
        canReadInventory={canReadInventory}
        canWriteLocations={canWriteLocations}
        copy={copy}
        initialLocations={locations}
        initialSelectedLocationId={resolvedSearchParams?.selectedLocationId ?? null}
        isDatabaseAvailable={isDatabaseAvailable}
        workspaceSlug={workspaceSlug}
      />
    </WorkspaceShell>
  );
}
