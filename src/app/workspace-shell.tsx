import Link from "next/link";
import type { ReactNode } from "react";

import { signOut } from "@/server/auth/actions";
import { ThemeToggle } from "@/app/theme-toggle";

type WorkspaceNavItem =
  | "parts"
  | "locations"
  | "organizations"
  | "shopping-lists"
  | "purchase-orders"
  | "part-categories"
  | "attributes"
  | "units"
  | "settings-general"
  | "settings-integrations"
  | "settings-ordering";

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
  userGuide: "User guide",
  switchWorkspace: "Switch workspace",
  signOut: "Sign out",
  inventorySection: "Inventory",
  parts: "Parts",
  locations: "Storage Locations",
  purchasesSection: "Purchases",
  shoppingLists: "Shopping Lists",
  purchaseOrders: "Purchase Orders",
  configurationSection: "Configuration",
  organizations: "Organizations",
  partCategories: "Part categories",
  attributes: "Attributes",
  units: "Units",
  general: "General",
  integrations: "Integrations",
  ordering: "Ordering"
};

function getNavLinkClass(isActive: boolean) {
  if (isActive) {
    return "flex min-h-10 items-center rounded-md bg-[var(--color-accent-soft)] px-3 text-sm font-semibold text-[var(--color-text-primary)]";
  }

  return "flex min-h-10 items-center rounded-md px-3 text-sm font-medium text-[var(--color-text-secondary)] transition hover:bg-[var(--color-bg-subtle)]";
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
    <main className="h-screen overflow-hidden bg-[var(--color-bg-page)] text-[var(--color-text-primary)]">
      <div className="flex h-full min-h-0">
        <aside className="flex h-full w-60 shrink-0 flex-col border-r border-[var(--color-border)] bg-[var(--color-bg-elevated)]">
          <div className="flex min-h-14 items-center gap-3 border-b border-[var(--color-border)] px-4">
            <div className="grid h-8 w-8 place-items-center rounded-md bg-[var(--color-accent)] text-sm font-semibold text-white">
              {copy.appShortName}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold leading-5 text-[var(--color-text-primary)]">
                {copy.appName}
              </p>
              <p className="truncate text-xs leading-4 text-[var(--color-text-muted)]">
                {workspaceName}
              </p>
            </div>
          </div>
          <nav
            className="flex min-h-0 flex-1 flex-col gap-1 overflow-auto p-3"
            aria-label="Main navigation"
          >
            <p className="px-3 pb-1 pt-1 text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
              {copy.inventorySection}
            </p>
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
            <div className="my-2 border-t border-[var(--color-border)]" />
            <p className="px-3 pb-1 pt-1 text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
              {copy.purchasesSection}
            </p>
            <Link
              className={getNavLinkClass(activeNavItem === "shopping-lists")}
              href={`/w/${workspaceSlug}/shopping-lists`}
              aria-current={activeNavItem === "shopping-lists" ? "page" : undefined}
            >
              {copy.shoppingLists}
            </Link>
            <Link
              className={getNavLinkClass(activeNavItem === "purchase-orders")}
              href={`/w/${workspaceSlug}/purchase-orders`}
              aria-current={activeNavItem === "purchase-orders" ? "page" : undefined}
            >
              {copy.purchaseOrders}
            </Link>
            <div className="my-2 border-t border-[var(--color-border)]" />
            <p className="px-3 pb-1 pt-1 text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
              {copy.configurationSection}
            </p>
            <Link
              className={getNavLinkClass(activeNavItem === "organizations")}
              href={`/w/${workspaceSlug}/organizations`}
              aria-current={activeNavItem === "organizations" ? "page" : undefined}
            >
              {copy.organizations}
            </Link>
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
              className={getNavLinkClass(activeNavItem === "settings-general")}
              href={`/w/${workspaceSlug}/settings/general`}
              aria-current={
                activeNavItem === "settings-general" ? "page" : undefined
              }
            >
              {copy.general}
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
            <Link
              className={getNavLinkClass(activeNavItem === "settings-ordering")}
              href={`/w/${workspaceSlug}/settings/ordering`}
              aria-current={
                activeNavItem === "settings-ordering" ? "page" : undefined
              }
            >
              {copy.ordering}
            </Link>
          </nav>
          <div className="border-t border-[var(--color-border)] p-3">
            <p className="mb-2 truncate text-xs leading-5 text-[var(--color-text-muted)]">{userEmail}</p>
            <ThemeToggle />
            <Link
              className="mb-2 flex min-h-10 items-center gap-2 rounded-md border border-[var(--color-border-strong)] bg-[var(--color-bg-elevated)] px-3 text-sm font-medium text-[var(--color-text-secondary)] transition hover:border-[var(--color-border-hover)] hover:bg-[var(--color-bg-subtle)] focus:outline-none focus:ring-2 focus:ring-[var(--color-ring-strong)] focus:ring-offset-2"
              href="https://github.com/michalwy/ohm-sweet-ohm/blob/main/docs/user-guide.md"
              target="_blank"
              rel="noreferrer"
            >
              <svg
                aria-hidden="true"
                className="h-4 w-4 text-[var(--color-text-muted)]"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path d="M5 2.5A1.5 1.5 0 0 0 3.5 4v12A1.5 1.5 0 0 0 5 17.5h10A1.5 1.5 0 0 0 16.5 16V7.879a1.5 1.5 0 0 0-.44-1.06l-3.879-3.88A1.5 1.5 0 0 0 11.12 2.5H5Zm6 1.56c.067.02.13.057.182.11l3.648 3.648a.5.5 0 0 1 .11.182H11.5a.5.5 0 0 1-.5-.5V4.06ZM6.75 10a.75.75 0 0 1 .75-.75h5a.75.75 0 0 1 0 1.5h-5a.75.75 0 0 1-.75-.75Zm0 3a.75.75 0 0 1 .75-.75h5a.75.75 0 0 1 0 1.5h-5a.75.75 0 0 1-.75-.75Z" />
              </svg>
              {copy.userGuide}
            </Link>
            <Link
              className="mb-2 flex min-h-10 items-center rounded-md border border-[var(--color-border-strong)] bg-[var(--color-bg-elevated)] px-3 text-sm font-medium text-[var(--color-text-secondary)] transition hover:border-[var(--color-border-hover)] hover:bg-[var(--color-bg-subtle)] focus:outline-none focus:ring-2 focus:ring-[var(--color-ring-strong)] focus:ring-offset-2"
              href="/workspaces"
            >
              {copy.switchWorkspace}
            </Link>
            <form action={signOut}>
              <button
                className="min-h-10 w-full rounded-md border border-[var(--color-border-strong)] bg-[var(--color-bg-elevated)] px-3 text-left text-sm font-medium text-[var(--color-text-secondary)] transition hover:border-[var(--color-border-hover)] hover:bg-[var(--color-bg-subtle)] focus:outline-none focus:ring-2 focus:ring-[var(--color-ring-strong)] focus:ring-offset-2"
                type="submit"
              >
                {copy.signOut}
              </button>
            </form>
          </div>
        </aside>

        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          <div className="flex min-h-0 flex-1 flex-col gap-4 p-6">
            <header className="flex items-end justify-between gap-2 border-b border-[var(--color-border)] pb-4">
              <div>
                <h1 className="text-2xl font-semibold tracking-normal text-[var(--color-text-primary)]">
                  {title}
                </h1>
                <p className="mt-1 max-w-3xl text-sm leading-6 text-[var(--color-text-secondary)]">
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
