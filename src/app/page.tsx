import { getPartsList } from "@/server/parts/getParts";
import { PartsListClient } from "@/app/parts-list-client";

export const dynamic = "force-dynamic";

const copy = {
  appShortName: "OSO",
  appName: "OhmSweetOhm",
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
    <main className="min-h-screen bg-zinc-950 px-6 py-8 text-zinc-100">
      <div className="mx-auto flex max-w-6xl flex-col gap-8">
        <header className="border-b border-zinc-800 pb-6">
          <p className="text-sm font-medium uppercase tracking-wide text-cyan-300">
            {copy.appShortName}
          </p>
          <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-4xl font-semibold tracking-normal">
                {copy.title}
              </h1>
              <p className="mt-3 max-w-2xl text-base leading-7 text-zinc-300">
                {copy.intro}
              </p>
            </div>
            <p className="text-sm text-zinc-500">{copy.appName}</p>
          </div>
        </header>

        {!isDatabaseAvailable ? (
          <p className="border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
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
    </main>
  );
}
