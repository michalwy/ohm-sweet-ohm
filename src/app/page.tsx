import { getPartsList } from "@/server/parts/getParts";
import { createPart } from "@/server/parts/createPart";

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
  createPart: "Create part",
  created: "Part created.",
  missingRequiredFields: "Enter both catalog number and manufacturer.",
  emptyTitle: "No parts yet",
  emptyBody: "Parts will appear here once they exist.",
  databaseUnavailable:
    "Database is not available, so the list is shown empty for now."
};

type HomePageProps = {
  searchParams?: {
    partCreated?: string;
    partFormError?: string;
  };
};

export default async function HomePage({ searchParams }: HomePageProps) {
  const { parts, isDatabaseAvailable } = await getPartsList();
  const partCreated = searchParams?.partCreated === "1";
  const partFormError = searchParams?.partFormError;

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

        <section aria-labelledby="new-part-heading">
          <div className="border border-zinc-800 bg-zinc-950 p-4 sm:p-5">
            <div className="mb-5">
              <h2
                id="new-part-heading"
                className="text-lg font-semibold text-zinc-100"
              >
                {copy.newPartTitle}
              </h2>
              <p className="mt-1 text-sm leading-6 text-zinc-400">
                {copy.newPartBody}
              </p>
            </div>

            {partCreated ? (
              <p className="mb-4 border border-emerald-400/30 bg-emerald-400/10 px-3 py-2 text-sm text-emerald-100">
                {copy.created}
              </p>
            ) : null}

            {partFormError ? (
              <p className="mb-4 border border-rose-400/30 bg-rose-400/10 px-3 py-2 text-sm text-rose-100">
                {partFormError === "missing-required-fields"
                  ? copy.missingRequiredFields
                  : copy.databaseUnavailable}
              </p>
            ) : null}

            <form
              action={createPart}
              className="grid gap-4 lg:grid-cols-[1fr_1fr_auto] lg:items-end"
            >
              <label className="grid gap-2 text-sm font-medium text-zinc-300">
                {copy.catalogNumber}
                <input
                  className="min-h-11 border border-zinc-700 bg-zinc-900 px-3 py-2 font-mono text-base text-zinc-100 outline-none transition focus:border-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
                  name="catalogNumber"
                  placeholder={copy.catalogNumberPlaceholder}
                  required
                  type="text"
                  disabled={!isDatabaseAvailable}
                />
              </label>
              <label className="grid gap-2 text-sm font-medium text-zinc-300">
                {copy.manufacturer}
                <input
                  className="min-h-11 border border-zinc-700 bg-zinc-900 px-3 py-2 text-base text-zinc-100 outline-none transition focus:border-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
                  name="manufacturerName"
                  placeholder={copy.manufacturerPlaceholder}
                  required
                  type="text"
                  disabled={!isDatabaseAvailable}
                />
              </label>
              <button
                className="min-h-11 border border-cyan-300 bg-cyan-300 px-4 py-2 text-sm font-semibold text-zinc-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:border-zinc-700 disabled:bg-zinc-800 disabled:text-zinc-500"
                type="submit"
                disabled={!isDatabaseAvailable}
              >
                {copy.createPart}
              </button>
            </form>
          </div>
        </section>

        <section aria-labelledby="parts-heading">
          <h2 id="parts-heading" className="sr-only">
            {copy.title}
          </h2>
          <div className="overflow-hidden border border-zinc-800">
            <table className="min-w-full divide-y divide-zinc-800 text-left text-sm">
              <thead className="bg-zinc-900">
                <tr>
                  <th
                    scope="col"
                    className="px-4 py-3 font-medium text-zinc-300"
                  >
                    {copy.catalogNumber}
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-3 font-medium text-zinc-300"
                  >
                    {copy.manufacturer}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-900 bg-zinc-950">
                {parts.length > 0 ? (
                  parts.map((part) => (
                    <tr key={part.id}>
                      <td className="px-4 py-4 font-mono text-zinc-100">
                        {part.catalogNumber}
                      </td>
                      <td className="px-4 py-4 text-zinc-300">
                        {part.manufacturerName}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td className="px-4 py-10" colSpan={2}>
                      <p className="text-base font-medium text-zinc-100">
                        {copy.emptyTitle}
                      </p>
                      <p className="mt-2 max-w-xl text-sm leading-6 text-zinc-400">
                        {copy.emptyBody}
                      </p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}
