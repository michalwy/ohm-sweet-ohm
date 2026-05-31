import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { LocationsClient } from "@/app/locations-client";
import { hasWorkspacePermission } from "@/server/access-control/authorize";
import { signOut } from "@/server/auth/actions";
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
            <Link
              className="flex min-h-10 items-center rounded-md px-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              href={`/w/${workspaceSlug}/units`}
            >
              {copy.units}
            </Link>
            <Link
              aria-current="page"
              className="flex min-h-10 items-center rounded-md bg-[var(--color-accent-soft)] px-3 text-sm font-semibold text-slate-950"
              href={`/w/${workspaceSlug}/locations`}
            >
              {copy.locations}
            </Link>
            <Link
              className="flex min-h-10 items-center rounded-md px-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              href={`/w/${workspaceSlug}/settings/integrations`}
            >
              {copy.settingsIntegrations}
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

            <LocationsClient
              canWriteLocations={canWriteLocations}
              copy={copy}
              initialLocations={locations}
              isDatabaseAvailable={isDatabaseAvailable}
              workspaceSlug={workspaceSlug}
            />
          </div>
        </div>
      </div>
    </main>
  );
}
