import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { UnitsClient } from "@/app/units-client";
import { hasWorkspacePermission } from "@/server/access-control/authorize";
import { signOut } from "@/server/auth/actions";
import {
  getCurrentSession,
  getCurrentWorkspaceContextBySlug
} from "@/server/auth/currentContext";
import { getWorkspaceUnits } from "@/server/units/unitMutations";
import type { UnitListItem } from "@/server/units/unitMutations";

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
  let units: UnitListItem[] = [];

  try {
    units = await getWorkspaceUnits(context.workspace.id);
  } catch {
    isDatabaseAvailable = false;
  }

  const canWriteUnits = isDatabaseAvailable
    ? await hasWorkspacePermission({
        userId: context.user.id,
        workspaceId: context.workspace.id,
        permission: "units:write"
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
              aria-current="page"
              className="flex min-h-10 items-center rounded-md bg-[var(--color-accent-soft)] px-3 text-sm font-semibold text-slate-950"
              href={`/w/${workspaceSlug}/units`}
            >
              {copy.title}
            </Link>
            <Link
              className="flex min-h-10 items-center rounded-md px-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
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
                {copy.databaseUnavailableBanner}
              </p>
            ) : null}

            <UnitsClient
              canWriteUnits={canWriteUnits}
              copy={copy}
              initialUnits={units}
              isDatabaseAvailable={isDatabaseAvailable}
              workspaceSlug={workspaceSlug}
            />
          </div>
        </div>
      </div>
    </main>
  );
}
