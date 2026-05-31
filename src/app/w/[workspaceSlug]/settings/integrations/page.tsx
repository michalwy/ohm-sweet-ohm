import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { signOut } from "@/server/auth/actions";
import {
  getCurrentSession,
  getCurrentWorkspaceContextBySlug
} from "@/server/auth/currentContext";
import { hasWorkspacePermission } from "@/server/access-control/authorize";
import { getWorkspaceDigiKeyIntegration } from "@/server/integrations/digikey";
import { getWorkspaceActiveSupplierProvider } from "@/server/integrations/providerSettings";
import { getWorkspaceTmeIntegration } from "@/server/integrations/tme";
import { DigiKeyIntegrationSettingsClient } from "@/app/digikey-integration-settings-client";

export const dynamic = "force-dynamic";

const copy = {
  appShortName: "OSO",
  appName: "OhmSweetOhm",
  signOut: "Sign out",
  switchWorkspace: "Switch workspace",
  parts: "Parts",
  partCategories: "Part categories",
  attributes: "Attributes",
  units: "Units",
  locations: "Locations",
  settingsIntegrations: "Integrations",
  title: "Integrations",
  intro:
    "Configure workspace-level integrations used by the parts workflow.",
  sectionTitle: "Supplier integrations",
  sectionBody:
    "Configure supplier credentials and select one active provider for part search suggestions.",
  providerSectionTitle: "Active provider",
  providerSectionBody: "Only the active provider is used to suggest parts in the Add part dialog.",
  digikey: "DigiKey",
  tme: "TME",
  clientId: "Client ID",
  clientSecret: "Client secret",
  tmeApiToken: "API token (50 chars)",
  tmeApplicationSecret: "Application secret (20 chars)",
  saveChanges: "Save changes",
  setActiveProvider: "Set active provider",
  saved: "Saved",
  noPermission:
    "Only workspace admins can update integration credentials.",
  missingRequiredFields: "Enter all required credentials.",
  invalidProvider: "Choose a valid provider.",
  permissionDenied: "You do not have permission to update integrations.",
  databaseUnavailable:
    "Database is not available, so integrations cannot be updated right now."
};

type IntegrationsPageProps = {
  params: Promise<{
    workspaceSlug: string;
  }>;
};

export default async function IntegrationsPage({ params }: IntegrationsPageProps) {
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
  let canManageIntegrations = false;
  let initialDigiKeyClientId = "";
  let hasSavedDigiKeyClientSecret = false;
  let initialTmeClientId = "";
  let hasSavedTmeClientSecret = false;
  let initialActiveProvider = null;

  try {
    canManageIntegrations = await hasWorkspacePermission({
      userId: context.user.id,
      workspaceId: context.workspace.id,
      permission: "admin"
    });

    const [digiKeyIntegration, tmeIntegration, activeProvider] = await Promise.all([
      getWorkspaceDigiKeyIntegration(context.workspace.id),
      getWorkspaceTmeIntegration(context.workspace.id),
      getWorkspaceActiveSupplierProvider(context.workspace.id)
    ]);

    initialDigiKeyClientId = digiKeyIntegration?.clientId ?? "";
    hasSavedDigiKeyClientSecret = Boolean(digiKeyIntegration?.clientSecret);
    initialTmeClientId = tmeIntegration?.clientId ?? "";
    hasSavedTmeClientSecret = Boolean(tmeIntegration?.clientSecret);
    initialActiveProvider = activeProvider;
  } catch {
    isDatabaseAvailable = false;
  }

  return (
    <main className="h-screen overflow-hidden bg-slate-100 text-slate-950">
      <div className="flex h-full min-h-0">
        <aside className="flex h-full w-60 shrink-0 flex-col border-r border-slate-200 bg-white">
          <div className="flex min-h-14 items-center gap-3 border-b border-slate-200 px-4">
            <div className="grid h-8 w-8 place-items-center rounded-md bg-[var(--color-accent)] text-sm font-semibold text-white">
              {copy.appShortName}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold leading-5 text-slate-950">{copy.appName}</p>
              <p className="truncate text-xs leading-4 text-slate-500">{context.workspace.name}</p>
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
              className="flex min-h-10 items-center rounded-md px-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              href={`/w/${workspaceSlug}/units`}
            >
              {copy.units}
            </Link>
            <Link
              className="flex min-h-10 items-center rounded-md px-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              href={`/w/${workspaceSlug}/locations`}
            >
              {copy.locations}
            </Link>
            <Link
              aria-current="page"
              className="flex min-h-10 items-center rounded-md bg-[var(--color-accent-soft)] px-3 text-sm font-semibold text-slate-950"
              href={`/w/${workspaceSlug}/settings/integrations`}
            >
              {copy.settingsIntegrations}
            </Link>
          </nav>
          <div className="border-t border-slate-200 p-3">
            <p className="mb-2 truncate text-xs leading-5 text-slate-500">{context.user.email}</p>
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
                <h1 className="text-2xl font-semibold tracking-normal text-slate-950">{copy.title}</h1>
                <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">{copy.intro}</p>
              </div>
            </header>

            {!isDatabaseAvailable ? (
              <p className="rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                {copy.databaseUnavailable}
              </p>
            ) : null}

            <DigiKeyIntegrationSettingsClient
              canManageIntegrations={canManageIntegrations}
              copy={copy}
              hasSavedDigiKeyClientSecret={hasSavedDigiKeyClientSecret}
              hasSavedTmeClientSecret={hasSavedTmeClientSecret}
              initialActiveProvider={initialActiveProvider}
              initialDigiKeyClientId={initialDigiKeyClientId}
              initialTmeClientId={initialTmeClientId}
              isDatabaseAvailable={isDatabaseAvailable}
              workspaceSlug={workspaceSlug}
            />
          </div>
        </div>
      </div>
    </main>
  );
}
