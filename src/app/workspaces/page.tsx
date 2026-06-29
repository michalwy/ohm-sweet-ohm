import Link from "next/link";
import { redirect } from "next/navigation";

import { signOut } from "@/server/auth/actions";
import {
  getCurrentSession,
  getCurrentUserWorkspaces,
  getCurrentUserArchivedWorkspaces
} from "@/server/auth/currentContext";
import { createWorkspace } from "@/server/workspaces/actions";
import { getRetentionDays } from "@/server/workspaces/retentionConfig";
import { ArchivedWorkspacesSection } from "@/app/workspaces/archived-workspaces-section";
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
  presetPartsOnly: "Demo parts & designs",
  presetPartsOnlyHelp:
    "~250 real parts with categories, attributes, and stock, plus example designs with bills of materials.",
  presetPartsAndOrders: "Demo parts + orders",
  presetPartsAndOrdersHelp: "Everything above, plus shopping lists and purchase orders.",
  create: "Create workspace",
  emptyTitle: "No workspaces yet",
  emptyBody: "Create a workspace to start tracking parts.",
  open: "Open",
  missingName: "Enter a workspace name.",
  missingCurrency: "Choose a primary currency.",
  unavailable: "Workspace could not be created. Try again.",
  archivedSection: "Archived workspaces",
  archivedNotice: "This workspace has been archived and is no longer accessible."
};


type WorkspacesPageProps = {
  searchParams?: Promise<{
    error?: string;
    notice?: string;
  }>;
};

export default async function WorkspacesPage({
  searchParams
}: WorkspacesPageProps) {
  const session = await getCurrentSession();

  if (!session) {
    redirect("/sign-in");
  }

  const [memberships, archivedMemberships] = await Promise.all([
    getCurrentUserWorkspaces(),
    getCurrentUserArchivedWorkspaces()
  ]);
  const retentionDays = getRetentionDays();
  const workspaces = memberships?.map(({ workspace }) => workspace) ?? [];
  const archivedWorkspaces =
    archivedMemberships?.map(({ workspace }) => workspace) ?? [];
  const resolvedSearchParams = await searchParams;
  const error = resolvedSearchParams?.error;
  const notice = resolvedSearchParams?.notice;

  return (
    <main className="min-h-screen bg-[var(--color-bg-page)] text-[var(--color-text-primary)]">
      <div className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-6 py-6">
        <header className="flex min-h-14 items-center justify-between gap-4 border-b border-[var(--color-border)] pb-4">
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-md bg-[var(--color-accent)] text-sm font-semibold text-white">
              {copy.appShortName}
            </div>
            <div>
              <p className="text-sm font-semibold leading-5 text-[var(--color-text-primary)]">
                {copy.appName}
              </p>
              <p className="text-xs leading-4 text-[var(--color-text-muted)]">
                {copy.appSubtitle}
              </p>
            </div>
          </div>
          <form action={signOut}>
            <button
              className="min-h-10 rounded-md border border-[var(--color-border-strong)] bg-[var(--color-bg-elevated)] px-3 py-2 text-sm font-medium text-[var(--color-text-secondary)] transition hover:border-[var(--color-border-hover)] hover:bg-[var(--color-bg-subtle)] focus:outline-none focus:ring-2 focus:ring-[var(--color-ring-strong)] focus:ring-offset-2"
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
                className="text-2xl font-semibold tracking-normal text-[var(--color-text-primary)]"
              >
                {copy.title}
              </h1>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-[var(--color-text-secondary)]">
                {copy.intro}
              </p>
            </div>

            {notice === "workspace-archived" && (
              <p className="mb-4 rounded-md border border-[var(--color-warning-border)] bg-[var(--color-warning-soft)] px-3 py-2 text-sm text-[var(--color-warning)]">
                {copy.archivedNotice}
              </p>
            )}

            {workspaces.length > 0 ? (
              <div className="overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elevated)] shadow-sm">
                <ul className="divide-y divide-[var(--color-border)]">
                  {workspaces.map((workspace) => (
                    <li
                      className="flex items-center justify-between gap-3 px-4 py-4"
                      key={workspace.id}
                    >
                      <div className="min-w-0">
                        <p className="truncate text-base font-semibold text-[var(--color-text-primary)]">
                          {workspace.name}
                        </p>
                        <p className="mt-1 truncate font-mono text-xs text-[var(--color-text-muted)]">
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
              <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elevated)] p-6 shadow-sm">
                <p className="text-base font-semibold text-[var(--color-text-primary)]">
                  {copy.emptyTitle}
                </p>
                <p className="mt-2 text-sm leading-6 text-[var(--color-text-muted)]">
                  {copy.emptyBody}
                </p>
              </div>
            )}

            <ArchivedWorkspacesSection
              workspaces={archivedWorkspaces}
              retentionDays={retentionDays}
              sectionLabel={copy.archivedSection}
            />
          </section>

          <section
            aria-labelledby="create-workspace-heading"
            className="h-fit rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elevated)] p-5 shadow-sm"
          >
            <h2
              id="create-workspace-heading"
              className="text-lg font-semibold text-[var(--color-text-primary)]"
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
              <label className="grid gap-2 text-sm font-medium text-[var(--color-text-secondary)]">
                {copy.name}
                <input
                  className="min-h-11 rounded-md border border-[var(--color-border-strong)] bg-[var(--color-bg-elevated)] px-3 py-2 text-base text-[var(--color-text-primary)] outline-none transition placeholder:text-[var(--color-text-placeholder)] hover:border-[var(--color-border-hover)] focus:border-[var(--color-border-hover)] focus:ring-2 focus:ring-[var(--color-ring)]"
                  name="name"
                  placeholder={copy.namePlaceholder}
                  required
                  type="text"
                />
              </label>
              <div className="grid gap-2">
                <label className="text-sm font-medium text-[var(--color-text-secondary)]" htmlFor="workspace-currency">
                  {copy.currency}
                </label>
                <select
                  id="workspace-currency"
                  name="currency"
                  required
                  defaultValue="EUR"
                  className="min-h-11 rounded-md border border-[var(--color-border-strong)] bg-[var(--color-bg-elevated)] px-3 py-2 text-base text-[var(--color-text-primary)] outline-none transition hover:border-[var(--color-border-hover)] focus:border-[var(--color-border-hover)] focus:ring-2 focus:ring-[var(--color-ring)]"
                >
                  {CURRENCIES.map((c) => (
                    <option key={c.code} value={c.code}>{c.label}</option>
                  ))}
                </select>
                <p className="text-xs text-[var(--color-text-muted)]">{copy.currencyHelp}</p>
              </div>
              <fieldset className="grid gap-2">
                <legend className="text-sm font-medium text-[var(--color-text-secondary)]">{copy.preset}</legend>
                {(
                  [
                    { value: "empty", label: copy.presetEmpty, help: copy.presetEmptyHelp },
                    { value: "parts-only", label: copy.presetPartsOnly, help: copy.presetPartsOnlyHelp },
                    { value: "parts-and-orders", label: copy.presetPartsAndOrders, help: copy.presetPartsAndOrdersHelp }
                  ] as const
                ).map(({ value, label, help }) => (
                  <label
                    key={value}
                    className="flex cursor-pointer items-start gap-3 rounded-md border border-[var(--color-border)] px-3 py-2.5 transition hover:border-[var(--color-border-hover)] hover:bg-[var(--color-bg-subtle)] has-[:checked]:border-[var(--color-accent)] has-[:checked]:bg-[color-mix(in_srgb,var(--color-accent)_6%,var(--color-bg-elevated))]"
                  >
                    <input
                      className="mt-0.5 shrink-0 accent-[var(--color-accent)]"
                      defaultChecked={value === "empty"}
                      name="preset"
                      type="radio"
                      value={value}
                    />
                    <span className="grid gap-0.5">
                      <span className="text-sm font-medium text-[var(--color-text-primary)]">{label}</span>
                      <span className="text-xs text-[var(--color-text-muted)]">{help}</span>
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
