import Link from "next/link";

import { getPartsList } from "@/server/parts/getParts";
import { PartsListClient } from "@/app/parts-list-client";

export const dynamic = "force-dynamic";

const copy = {
  appShortName: "OSO",
  appName: "OhmSweetOhm",
  appSubtitle: "Home electronics workshop",
  title: "Parts",
  intro:
    "Real purchasable electronic parts tracked by manufacturer and catalog number.",
  catalogNumber: "Catalog number",
  manufacturer: "Manufacturer",
  newPartTitle: "Add part",
  newPartBody: "Create a real purchasable electronic part.",
  catalogNumberPlaceholder: "NE555P",
  manufacturerPlaceholder: "Texas Instruments",
  addPart: "Add part",
  createPart: "Create part",
  close: "Close",
  created: "Part created.",
  updated: "Part updated.",
  missingRequiredFields: "Enter both catalog number and manufacturer.",
  unsupportedField: "This field cannot be updated inline.",
  emptyTitle: "No parts yet",
  emptyBody: "Parts will appear here once they exist.",
  databaseUnavailable:
    "Database is not available, so the list is shown empty for now."
};

type HomePageProps = {
  searchParams?: Promise<{
    partCreated?: string;
    partDialog?: string;
    partFormError?: string;
    partUpdated?: string;
    partUpdateError?: string;
  }>;
};

export default async function HomePage({ searchParams }: HomePageProps) {
  const { parts, isDatabaseAvailable } = await getPartsList();
  const resolvedSearchParams = await searchParams;
  const partCreated = resolvedSearchParams?.partCreated === "1";
  const partDialogOpen = resolvedSearchParams?.partDialog === "open";
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
            <div>
              <p className="text-sm font-semibold leading-5 text-slate-950">
                {copy.appName}
              </p>
              <p className="text-xs leading-4 text-slate-500">
                {copy.appSubtitle}
              </p>
            </div>
          </div>
          <nav className="flex-1 p-3" aria-label="Main navigation">
            <Link
              className="flex min-h-10 items-center rounded-md bg-slate-100 px-3 text-sm font-semibold text-slate-950"
              href="/"
              aria-current="page"
            >
              {copy.title}
            </Link>
          </nav>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="border-b border-slate-200 bg-white md:hidden">
            <div className="flex min-h-14 items-center justify-between gap-4 px-4 sm:px-6">
              <div className="flex items-center gap-3">
                <div className="grid h-8 w-8 place-items-center rounded-md bg-slate-950 text-sm font-semibold text-white">
                  {copy.appShortName}
                </div>
                <div>
                  <p className="text-sm font-semibold leading-5 text-slate-950">
                    {copy.appName}
                  </p>
                  <p className="text-xs leading-4 text-slate-500">
                    {copy.appSubtitle}
                  </p>
                </div>
              </div>
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
              partFormError={partFormError}
              partUpdated={partUpdated}
              partUpdateError={partUpdateError}
              parts={parts}
            />
          </div>
        </div>
      </div>
    </main>
  );
}
