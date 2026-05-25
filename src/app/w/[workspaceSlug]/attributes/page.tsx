import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { AttributesClient } from "@/app/attributes-client";
import { hasWorkspacePermission } from "@/server/access-control/authorize";
import { signOut } from "@/server/auth/actions";
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
  title: "Attributes",
  intro:
    "Manage the workspace dictionary of typed attributes used by part categories.",
  addAttribute: "Add attribute",
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
    "Database is not available, so the attribute dictionary is shown empty for now."
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
                {context.workspace.name}
              </p>
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
              aria-current="page"
              className="flex min-h-10 items-center rounded-md bg-[var(--color-accent-soft)] px-3 text-sm font-semibold text-slate-950"
              href={`/w/${workspaceSlug}/attributes`}
            >
              {copy.title}
            </Link>
          </nav>
          <div className="border-t border-slate-200 p-3">
            <p className="mb-2 truncate text-xs leading-5 text-slate-500">
              {context.user.email}
            </p>
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
                  {copy.title}
                </h1>
                <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">
                  {copy.intro}
                </p>
              </div>
            </header>

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
          </div>
        </div>
      </div>
    </main>
  );
}
