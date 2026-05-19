import { getPartsList } from "@/server/parts/getParts";

export const dynamic = "force-dynamic";

const copy = {
  appShortName: "OSO",
  appName: "OhmSweetOhm",
  title: "Parts",
  intro:
    "Real purchasable electronic parts tracked by manufacturer and catalog number.",
  catalogNumber: "Catalog number",
  manufacturer: "Manufacturer",
  emptyTitle: "No parts yet",
  emptyBody: "Parts will appear here once they exist.",
  databaseUnavailable:
    "Database is not available, so the list is shown empty for now."
};

export default async function HomePage() {
  const { parts, isDatabaseAvailable } = await getPartsList();

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
