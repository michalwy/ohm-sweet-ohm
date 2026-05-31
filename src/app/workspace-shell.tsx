import Link from "next/link";
import type { ReactNode } from "react";

import { signOut } from "@/server/auth/actions";

type WorkspaceNavItem =
  | "parts"
  | "locations"
  | "part-categories"
  | "attributes"
  | "units"
  | "settings-integrations";

type WorkspaceShellProps = {
  workspaceSlug: string;
  workspaceName: string;
  userEmail: string;
  title: string;
  intro: string;
  activeNavItem: WorkspaceNavItem;
  children: ReactNode;
};

const copy = {
  appShortName: "OSO",
  appName: "OhmSweetOhm",
  switchWorkspace: "Switch workspace",
  signOut: "Sign out",
  parts: "Parts",
  locations: "Locations",
  configurationSection: "Configuration",
  partCategories: "Part categories",
  attributes: "Attributes",
  units: "Units",
  integrations: "Integrations"
};

function getNavLinkClass(isActive: boolean) {
  if (isActive) {
    return "flex min-h-10 items-center rounded-md bg-[var(--color-accent-soft)] px-3 text-sm font-semibold text-slate-950";
  }

  return "flex min-h-10 items-center rounded-md px-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50";
}

export function WorkspaceShell({
  workspaceSlug,
  workspaceName,
  userEmail,
  title,
  intro,
  activeNavItem,
  children
}: WorkspaceShellProps) {
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
                {workspaceName}
              </p>
            </div>
          </div>
          <nav
            className="flex min-h-0 flex-1 flex-col gap-1 overflow-auto p-3"
            aria-label="Main navigation"
          >
            <Link
              className={getNavLinkClass(activeNavItem === "parts")}
              href={`/w/${workspaceSlug}/parts`}
              aria-current={activeNavItem === "parts" ? "page" : undefined}
            >
              {copy.parts}
            </Link>
            <Link
              className={getNavLinkClass(activeNavItem === "locations")}
              href={`/w/${workspaceSlug}/locations`}
              aria-current={activeNavItem === "locations" ? "page" : undefined}
            >
              {copy.locations}
            </Link>
            <div className="my-2 border-t border-slate-200" />
            <p className="px-3 pb-1 pt-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
              {copy.configurationSection}
            </p>
            <Link
              className={getNavLinkClass(activeNavItem === "part-categories")}
              href={`/w/${workspaceSlug}/part-categories`}
              aria-current={activeNavItem === "part-categories" ? "page" : undefined}
            >
              {copy.partCategories}
            </Link>
            <Link
              className={getNavLinkClass(activeNavItem === "attributes")}
              href={`/w/${workspaceSlug}/attributes`}
              aria-current={activeNavItem === "attributes" ? "page" : undefined}
            >
              {copy.attributes}
            </Link>
            <Link
              className={getNavLinkClass(activeNavItem === "units")}
              href={`/w/${workspaceSlug}/units`}
              aria-current={activeNavItem === "units" ? "page" : undefined}
            >
              {copy.units}
            </Link>
            <Link
              className={getNavLinkClass(activeNavItem === "settings-integrations")}
              href={`/w/${workspaceSlug}/settings/integrations`}
              aria-current={
                activeNavItem === "settings-integrations" ? "page" : undefined
              }
            >
              {copy.integrations}
            </Link>
          </nav>
          <div className="border-t border-slate-200 p-3">
            <p className="mb-2 truncate text-xs leading-5 text-slate-500">{userEmail}</p>
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
                  {title}
                </h1>
                <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">
                  {intro}
                </p>
              </div>
            </header>

            {children}
          </div>
        </div>
      </div>
    </main>
  );
}
