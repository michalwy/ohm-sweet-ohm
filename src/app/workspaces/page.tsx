import Link from "next/link";
import { redirect } from "next/navigation";

import { signOut } from "@/server/auth/actions";
import {
  getCurrentSession,
  getCurrentUserWorkspaces
} from "@/server/auth/currentContext";
import { createWorkspace } from "@/server/workspaces/actions";
import { CURRENCIES } from "@/app/currencies";

export const dynamic = "force-dynamic";

const copy = {
  appShortName: "OSO",
  appName: "OhmSweetOhm",
  appSubtitle: "Home electronics workshop",
  title: "Workspaces",
  intro: "Choose a workshop space or create a new one.",
  signOut: "Sign out",
  createTitle: "Create workspace",
  name: "Workspace name",
  namePlaceholder: "Bench projects",
  currency: "Primary currency",
  currencyHelp: "Used for valuations and cost tracking. Cannot be changed after creation.",
  preset: "Starting data",
  presetEmpty: "Empty workspace",
  presetEmptyHelp: "Start from scratch with no data.",
  presetPartsOnly: "Demo parts",
  presetPartsOnlyHelp: "~250 real parts with categories, attributes, and stock.",
  presetPartsAndOrders: "Demo parts + orders",
  presetPartsAndOrdersHelp: "Everything above, plus shopping lists and purchase orders.",
  create: "Create workspace",
  emptyTitle: "No workspaces yet",
  emptyBody: "Create a workspace to start tracking parts.",
  open: "Open",
  missingName: "Enter a workspace name.",
  missingCurrency: "Choose a primary currency.",
  unavailable: "Workspace could not be created. Try again."
};


type WorkspacesPageProps = {
  searchParams?: Promise<{
    error?: string;
  }>;
};

export default async function WorkspacesPage({
  searchParams
}: WorkspacesPageProps) {
  const session = await getCurrentSession();

  if (!session) {
    redirect("/sign-in");
  }

  const memberships = await getCurrentUserWorkspaces();
  const workspaces = memberships?.map(({ workspace }) => workspace) ?? [];
  const resolvedSearchParams = await searchParams;
  const error = resolvedSearchParams?.error;

  return (
    <main className="min-h-screen bg-slate-100 text-slate-950">
      <div className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-6 py-6">
        <header className="flex min-h-14 items-center justify-between gap-4 border-b border-slate-200 pb-4">
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-md bg-[var(--color-accent)] text-sm font-semibold text-white">
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
          <form action={signOut}>
            <button
              className="min-h-10 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2"
              type="submit"
            >
              {copy.signOut}
            </button>
          </form>
        </header>

        <div className="grid flex-1 grid-cols-[1fr_22rem] gap-6 py-6">
          <section aria-labelledby="workspaces-heading">
            <div className="mb-5">
              <h1
                id="workspaces-heading"
                className="text-2xl font-semibold tracking-normal text-slate-950"
              >
                {copy.title}
              </h1>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600">
                {copy.intro}
              </p>
            </div>

            {workspaces.length > 0 ? (
              <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
                <ul className="divide-y divide-slate-200">
                  {workspaces.map((workspace) => (
                    <li
                      className="flex items-center justify-between gap-3 px-4 py-4"
                      key={workspace.id}
                    >
                      <div className="min-w-0">
                        <p className="truncate text-base font-semibold text-slate-950">
                          {workspace.name}
                        </p>
                        <p className="mt-1 truncate font-mono text-xs text-slate-500">
                          /w/{workspace.slug}
                        </p>
                      </div>
                      <Link
                        className="inline-flex min-h-9 items-center justify-center rounded-md border border-[var(--color-action-primary)] bg-[var(--color-action-primary)] px-3 py-1.5 text-sm font-semibold text-white transition hover:border-[var(--color-action-primary-hover)] hover:bg-[var(--color-action-primary-hover)] focus:outline-none focus:ring-2 focus:ring-[var(--color-action-focus)] focus:ring-offset-2"
                        href={`/w/${workspace.slug}/parts`}
                      >
                        {copy.open}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
                <p className="text-base font-semibold text-slate-950">
                  {copy.emptyTitle}
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  {copy.emptyBody}
                </p>
              </div>
            )}
          </section>

          <section
            aria-labelledby="create-workspace-heading"
            className="h-fit rounded-lg border border-slate-200 bg-white p-5 shadow-sm"
          >
            <h2
              id="create-workspace-heading"
              className="text-lg font-semibold text-slate-950"
            >
              {copy.createTitle}
            </h2>

            {error ? (
              <p className="mt-4 rounded-md border border-[var(--color-error-border)] bg-[var(--color-error-soft)] px-3 py-2 text-sm text-[var(--color-error)]">
                {error === "missing-name"
                  ? copy.missingName
                  : error === "missing-currency"
                    ? copy.missingCurrency
                    : copy.unavailable}
              </p>
            ) : null}

            <form action={createWorkspace} className="mt-5 grid gap-4">
              <label className="grid gap-2 text-sm font-medium text-slate-700">
                {copy.name}
                <input
                  className="min-h-11 rounded-md border border-slate-300 bg-white px-3 py-2 text-base text-slate-950 outline-none transition placeholder:text-slate-400 hover:border-slate-400 focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                  name="name"
                  placeholder={copy.namePlaceholder}
                  required
                  type="text"
                />
              </label>
              <div className="grid gap-2">
                <label className="text-sm font-medium text-slate-700" htmlFor="workspace-currency">
                  {copy.currency}
                </label>
                <select
                  id="workspace-currency"
                  name="currency"
                  required
                  defaultValue="EUR"
                  className="min-h-11 rounded-md border border-slate-300 bg-white px-3 py-2 text-base text-slate-950 outline-none transition hover:border-slate-400 focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                >
                  {CURRENCIES.map((c) => (
                    <option key={c.code} value={c.code}>{c.label}</option>
                  ))}
                </select>
                <p className="text-xs text-slate-500">{copy.currencyHelp}</p>
              </div>
              <fieldset className="grid gap-2">
                <legend className="text-sm font-medium text-slate-700">{copy.preset}</legend>
                {(
                  [
                    { value: "empty", label: copy.presetEmpty, help: copy.presetEmptyHelp },
                    { value: "parts-only", label: copy.presetPartsOnly, help: copy.presetPartsOnlyHelp },
                    { value: "parts-and-orders", label: copy.presetPartsAndOrders, help: copy.presetPartsAndOrdersHelp }
                  ] as const
                ).map(({ value, label, help }) => (
                  <label
                    key={value}
                    className="flex cursor-pointer items-start gap-3 rounded-md border border-slate-200 px-3 py-2.5 transition hover:border-slate-400 hover:bg-slate-50 has-[:checked]:border-[var(--color-accent)] has-[:checked]:bg-[color-mix(in_srgb,var(--color-accent)_6%,white)]"
                  >
                    <input
                      className="mt-0.5 shrink-0 accent-[var(--color-accent)]"
                      defaultChecked={value === "empty"}
                      name="preset"
                      type="radio"
                      value={value}
                    />
                    <span className="grid gap-0.5">
                      <span className="text-sm font-medium text-slate-900">{label}</span>
                      <span className="text-xs text-slate-500">{help}</span>
                    </span>
                  </label>
                ))}
              </fieldset>
              <button
                className="min-h-10 rounded-md border border-[var(--color-action-primary)] bg-[var(--color-action-primary)] px-4 py-2 text-sm font-semibold text-white transition hover:border-[var(--color-action-primary-hover)] hover:bg-[var(--color-action-primary-hover)] focus:outline-none focus:ring-2 focus:ring-[var(--color-action-focus)] focus:ring-offset-2"
                type="submit"
              >
                {copy.create}
              </button>
            </form>
          </section>
        </div>
      </div>
    </main>
  );
}
