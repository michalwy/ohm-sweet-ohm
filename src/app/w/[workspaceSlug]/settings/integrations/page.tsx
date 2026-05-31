import { notFound, redirect } from "next/navigation";

import { WorkspaceShell } from "@/app/workspace-shell";
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
    <WorkspaceShell
      activeNavItem="settings-integrations"
      intro={copy.intro}
      title={copy.title}
      userEmail={context.user.email}
      workspaceName={context.workspace.name}
      workspaceSlug={workspaceSlug}
    >
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
    </WorkspaceShell>
  );
}
