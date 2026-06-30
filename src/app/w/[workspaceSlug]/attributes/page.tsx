import { notFound, redirect } from "next/navigation";

import { AttributesClient } from "@/app/attributes-client";
import { WorkspaceShell } from "@/app/workspace-shell";
import { hasWorkspacePermission } from "@/server/access-control/authorize";
import {
  getCurrentSession,
  getCurrentWorkspaceContextBySlug
} from "@/server/auth/currentContext";
import { getAttributeDictionaryPageForWorkspace } from "@/server/parts/attributeActions";
import type { AttributeListItem } from "@/server/parts/attributeMutations";
import type { ListPage } from "@/server/pagination";

export const dynamic = "force-dynamic";

const copy = {
  appShortName: "OSO",
  appName: "OhmSweetOhm",
  signOut: "Sign out",
  switchWorkspace: "Switch workspace",
  parts: "Parts",
  partCategories: "Part categories",
  units: "Units",
  locations: "Locations",
  settingsIntegrations: "Integrations",
  title: "Attributes",
  intro:
    "Manage the workspace dictionary of typed attributes used by part categories.",
  addAttribute: "Add attribute",
  actions: "Actions",
  edit: "Edit",
  delete: "Delete",
  close: "Close",
  cancelDelete: "Cancel",
  confirmDelete: "Delete",
  deleteConfirmationBody: "This cannot be undone.",
  createAttribute: "Create attribute",
  saveChanges: "Save changes",
  addOption: "Add option",
  deleteOption: "Delete",
  newAttributeTitle: "Add attribute",
  editAttributeTitle: "Edit attribute",
  name: "Name",
  description: "Description",
  type: "Type",
  baseUnit: "Base unit",
  options: "Options",
  noOptions: "No options",
  noAttributes: "No attributes yet",
  loadingAttributes: "Loading attributes...",
  loadingMoreAttributes: "Loading more attributes...",
  text: "Text",
  number: "Number",
  quantity: "Quantity",
  boolean: "Boolean",
  choice: "Choice",
  optionLabel: "Option label",
  sortOrder: "Sort order",
  createdToast: "Attribute created",
  updatedToast: "Attribute updated",
  deletedToast: "Attribute deleted",
  invalidInput: "Check the attribute fields and try again.",
  databaseUnavailable:
    "Database is not available, so the attribute dictionary is shown empty for now.",
  configureList: "Configure list",
  visibleColumns: "Visible columns",
  listCountSummary: "{visible} of {total}"
};

type AttributesPageProps = {
  params: Promise<{
    workspaceSlug: string;
  }>;
};

export default async function AttributesPage({ params }: AttributesPageProps) {
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
  let attributePage: ListPage<AttributeListItem> = {
    items: [],
    nextCursor: null,
    totalCount: 0,
    filteredCount: 0
  };

  try {
    const result = await getAttributeDictionaryPageForWorkspace({
      workspaceSlug
    });

    if (result.ok) {
      attributePage = result.data;
    } else {
      isDatabaseAvailable = false;
    }
  } catch {
    isDatabaseAvailable = false;
  }

  const canWriteAttributes = isDatabaseAvailable
    ? await hasWorkspacePermission({
        userId: context.user.id,
        workspaceId: context.workspace.id,
        permission: "attributes:write"
      }).catch(() => false)
    : false;

  return (
    <WorkspaceShell
      activeNavItem="attributes"
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

      <AttributesClient
        canWriteAttributes={canWriteAttributes}
        copy={copy}
        isDatabaseAvailable={isDatabaseAvailable}
        initialPage={attributePage}
        workspaceSlug={workspaceSlug}
      />
    </WorkspaceShell>
  );
}
