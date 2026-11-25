import { notFound, redirect } from "next/navigation";

import { WorkspaceShell } from "@/app/workspace-shell";
import { InventoryDefaultsClient } from "@/app/inventory-defaults-client";
import {
  getCurrentSession,
  getCurrentWorkspaceContextBySlug
} from "@/server/auth/currentContext";
import { actorHasPermission } from "@/server/access-control/actor";
import { getStorageLocations } from "@/server/inventory/locationMutations";

export const dynamic = "force-dynamic";

const copy = {
  title: "Inventory defaults",
  intro: "Set the default storage location used for parts that have no default location of their own.",
  defaultLocation: "Default location",
  chooseLocation: "No default location",
  searchLocations: "Search locations",
  noMatchingLocations: "No matching locations",
  expandLocation: "Expand location",
  collapseLocation: "Collapse location",
  defaultLocationHelp:
    "Preselected when receiving a purchase order or creating a build, for parts without their own default location. A part's own default location always takes precedence.",
  saveChanges: "Save changes",
  saved: "Saved",
  noPermission: "Only workspace admins can update inventory defaults.",
  permissionDenied: "You do not have permission to perform this action.",
  databaseUnavailable: "Database is not available.",
  invalidDefaultLocation: "Choose a valid, non-archived location as the default."
};

type InventoryDefaultsPageProps = {
  params: Promise<{ workspaceSlug: string }>;
};

export default async function InventoryDefaultsPage({ params }: InventoryDefaultsPageProps) {
  const { workspaceSlug } = await params;
  const session = await getCurrentSession();

  if (!session) {
    redirect("/sign-in");
  }

  const context = await getCurrentWorkspaceContextBySlug(workspaceSlug);

  if (!context) {
    notFound();
  }

  const canManage = actorHasPermission(context, "admin");
  const locations = (await getStorageLocations(context.workspace.id).catch(() => [])).filter(
    (location) => !location.isArchived
  );

  return (
    <WorkspaceShell
      activeNavItem="settings-inventory"
      intro={copy.intro}
      title={copy.title}
      userEmail={context.user.email}
      workspaceName={context.workspace.name}
      workspaceSlug={workspaceSlug}
    >
      <InventoryDefaultsClient
        canManage={canManage}
        copy={copy}
        initialDefaultLocationId={
          locations.some((location) => location.id === context.workspace.defaultLocationId)
            ? (context.workspace.defaultLocationId ?? "")
            : ""
        }
        locations={locations}
        workspaceSlug={workspaceSlug}
      />
    </WorkspaceShell>
  );
}
