import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { PartsListClient } from "@/app/parts-list-client";
import { signOut } from "@/server/auth/actions";
import {
  getCurrentSession,
  getCurrentWorkspaceContextBySlug
} from "@/server/auth/currentContext";
import { getPartsList } from "@/server/parts/getParts";

export const dynamic = "force-dynamic";

const copy = {
  appShortName: "OSO",
  appName: "OhmSweetOhm",
  appSubtitle: "Home electronics workshop",
  signOut: "Sign out",
  switchWorkspace: "Switch workspace",
  title: "Parts",
  intro:
    "Real purchasable electronic parts tracked by manufacturer and catalog number.",
  catalogNumber: "Catalog number",
  manufacturer: "Manufacturer",
  actions: "Actions",
  newPartTitle: "Add part",
  newPartBody: "Create a real purchasable electronic part.",
  editPartTitle: "Edit part",
  editPartBody: "Update this part's manufacturer and catalog number.",
  catalogNumberPlaceholder: "NE555P",
  manufacturerPlaceholder: "Texas Instruments",
  addPart: "Add part",
  createPart: "Create part",
  editPart: "Edit",
  saveChanges: "Save changes",
  close: "Close",
  created: "Part created.",
  updated: "Part updated.",
  missingRequiredFields: "Enter both catalog number and manufacturer.",
  emptyTitle: "No parts yet",
  emptyBody: "Parts will appear here once they exist.",
  databaseUnavailable:
    "Database is not available, so the list is shown empty for now."
};

type PartsPageProps = {
  params: Promise<{
    workspaceSlug: string;
  }>;
  searchParams?: Promise<{
    partCreated?: string;
    partDialog?: string;
    partEditDialog?: string;
    partFormError?: string;
    partUpdated?: string;
    partUpdateError?: string;
  }>;
};

export default async function PartsPage({
  params,
  searchParams
}: PartsPageProps) {
  const { workspaceSlug } = await params;
  const session = await getCurrentSession();

  if (!session) {
    redirect("/sign-in");
  }

  const context = await getCurrentWorkspaceContextBySlug(workspaceSlug);

  if (!context) {
    notFound();
  }

  const { parts, isDatabaseAvailable } = await getPartsList(context);
  const resolvedSearchParams = await searchParams;
  const partCreated = resolvedSearchParams?.partCreated === "1";
  const partDialogOpen = resolvedSearchParams?.partDialog === "open";
  const partEditDialog = resolvedSearchParams?.partEditDialog;
  const partFormError = resolvedSearchParams?.partFormError;
  const partUpdated = resolvedSearchParams?.partUpdated === "1";
  const partUpdateError = resolvedSearchParams?.partUpdateError;

  return (
    <main className="min-h-screen bg-slate-100 text-slate-950">
      <div className="flex min-h-screen">
        <aside className="hidden w-60 shrink-0 border-r border-slate-200 bg-white md:flex md:flex-col">
          <div className="flex min-h-14 items-center gap-3 border-b border-slate-200 px-4">
            <div className="grid h-8 w-8 place-items-center rounded-md bg-slate-950 text-sm font-semibold text-white">
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
          <nav className="flex-1 p-3" aria-label="Main navigation">
            <Link
              className="flex min-h-10 items-center rounded-md bg-slate-100 px-3 text-sm font-semibold text-slate-950"
              href={`/w/${workspaceSlug}/parts`}
              aria-current="page"
            >
              {copy.title}
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

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="border-b border-slate-200 bg-white md:hidden">
            <div className="flex min-h-14 items-center justify-between gap-4 px-4 sm:px-6">
              <div className="flex min-w-0 items-center gap-3">
                <div className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-slate-950 text-sm font-semibold text-white">
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
              <Link
                className="min-h-9 shrink-0 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2"
                href="/workspaces"
              >
                {copy.switchWorkspace}
              </Link>
            </div>
          </header>

          <div className="flex min-h-0 flex-1 flex-col gap-4 p-4 sm:p-6">
            <header className="flex flex-col gap-2 border-b border-slate-200 pb-4 sm:flex-row sm:items-end sm:justify-between">
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

            <PartsListClient
              copy={copy}
              isDatabaseAvailable={isDatabaseAvailable}
              partCreated={partCreated}
              partDialogOpen={partDialogOpen}
              partEditDialog={partEditDialog}
              partFormError={partFormError}
              partUpdated={partUpdated}
              partUpdateError={partUpdateError}
              parts={parts}
              workspaceSlug={workspaceSlug}
            />
          </div>
        </div>
      </div>
    </main>
  );
}
