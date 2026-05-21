import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { PartCategoriesClient } from "@/app/part-categories-client";
import { hasWorkspacePermission } from "@/server/access-control/authorize";
import { signOut } from "@/server/auth/actions";
import {
  getCurrentSession,
  getCurrentWorkspaceContextBySlug
} from "@/server/auth/currentContext";
import {
  getPartCategoriesForManagement,
  type PartCategoryListItem
} from "@/server/parts/categories";

export const dynamic = "force-dynamic";

const copy = {
  appShortName: "OSO",
  appName: "OhmSweetOhm",
  signOut: "Sign out",
  switchWorkspace: "Switch workspace",
  parts: "Parts",
  title: "Part categories",
  intro:
    "Manage the category tree used to organize real purchasable electronic parts.",
  addRootCategory: "Add root category",
  addChild: "Add child",
  edit: "Edit",
  actions: "Actions",
  newCategoryTitle: "Add category",
  newCategoryBody: "Create a category in the parts category tree.",
  editCategoryTitle: "Edit category",
  editCategoryBody: "Update this category's name, parent, and assignment type.",
  name: "Name",
  namePlaceholder: "Resistors",
  parentCategory: "Parent category",
  rootCategory: "No parent",
  type: "Type",
  organizational: "Organizational",
  assignable: "Assignable",
  createCategory: "Create category",
  saveChanges: "Save changes",
  close: "Close",
  created: "Category created.",
  updated: "Category updated.",
  missingRequiredFields: "Enter a category name.",
  invalidParentCategory: "Choose a valid parent category.",
  categoryNotFound: "This category is no longer available.",
  categoryTreeCycle: "Choose a parent outside this category branch.",
  permissionDenied: "You do not have permission to manage categories.",
  emptyTitle: "No categories yet",
  emptyBody: "Create a root category to start organizing the parts tree.",
  databaseUnavailable:
    "Database is not available, so the category tree is shown empty for now."
};

type PartCategoriesPageProps = {
  params: Promise<{
    workspaceSlug: string;
  }>;
  searchParams?: Promise<{
    categoryCreated?: string;
    categoryDialog?: string;
    categoryEditDialog?: string;
    categoryError?: string;
    categoryUpdated?: string;
    categoryUpdateError?: string;
  }>;
};

export default async function PartCategoriesPage({
  params,
  searchParams
}: PartCategoriesPageProps) {
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
  let categories: PartCategoryListItem[] = [];

  try {
    categories = await getPartCategoriesForManagement(context);
  } catch {
    isDatabaseAvailable = false;
  }

  const canWriteCategories = isDatabaseAvailable
    ? await hasWorkspacePermission({
        userId: context.user.id,
        workspaceId: context.workspace.id,
        permission: "part-categories:write"
      }).catch(() => false)
    : false;
  const resolvedSearchParams = await searchParams;
  const categoryCreated = resolvedSearchParams?.categoryCreated === "1";
  const categoryDialogOpen = resolvedSearchParams?.categoryDialog === "create";
  const categoryEditDialog = resolvedSearchParams?.categoryEditDialog;
  const categoryError = resolvedSearchParams?.categoryError;
  const categoryUpdated = resolvedSearchParams?.categoryUpdated === "1";
  const categoryUpdateError = resolvedSearchParams?.categoryUpdateError;

  return (
    <main className="min-h-screen bg-slate-100 text-slate-950">
      <div className="flex min-h-screen">
        <aside className="hidden w-60 shrink-0 border-r border-slate-200 bg-white md:flex md:flex-col">
          <div className="flex min-h-14 items-center gap-3 border-b border-slate-200 px-4">
            <div className="grid h-8 w-8 place-items-center rounded-md bg-slate-950 text-sm font-semibold text-white">
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
            className="flex flex-1 flex-col gap-1 p-3"
            aria-label="Main navigation"
          >
            <Link
              className="flex min-h-10 items-center rounded-md px-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              href={`/w/${workspaceSlug}/parts`}
            >
              {copy.parts}
            </Link>
            <Link
              className="flex min-h-10 items-center rounded-md bg-slate-100 px-3 text-sm font-semibold text-slate-950"
              href={`/w/${workspaceSlug}/part-categories`}
              aria-current="page"
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

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="border-b border-slate-200 bg-white md:hidden">
            <div className="flex min-h-14 items-center justify-between gap-4 px-4 sm:px-6">
              <div className="flex min-w-0 items-center gap-3">
                <div className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-slate-950 text-sm font-semibold text-white">
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
              <Link
                className="min-h-9 shrink-0 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2"
                href="/workspaces"
              >
                {copy.switchWorkspace}
              </Link>
            </div>
            <nav
              className="flex gap-1 border-t border-slate-200 px-3 py-2"
              aria-label="Main navigation"
            >
              <Link
                className="flex min-h-9 items-center rounded-md px-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                href={`/w/${workspaceSlug}/parts`}
              >
                {copy.parts}
              </Link>
              <Link
                className="flex min-h-9 items-center rounded-md bg-slate-100 px-3 text-sm font-semibold text-slate-950"
                href={`/w/${workspaceSlug}/part-categories`}
                aria-current="page"
              >
                {copy.title}
              </Link>
            </nav>
          </header>

          <div className="flex min-h-0 flex-1 flex-col gap-4 p-4 sm:p-6">
            <header className="flex flex-col gap-2 border-b border-slate-200 pb-4 sm:flex-row sm:items-end sm:justify-between">
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

            <PartCategoriesClient
              categories={categories}
              categoryCreated={categoryCreated}
              categoryDialogOpen={categoryDialogOpen}
              categoryEditDialog={categoryEditDialog}
              categoryError={categoryError}
              categoryUpdated={categoryUpdated}
              categoryUpdateError={categoryUpdateError}
              canWriteCategories={canWriteCategories}
              copy={copy}
              isDatabaseAvailable={isDatabaseAvailable}
              workspaceSlug={workspaceSlug}
            />
          </div>
        </div>
      </div>
    </main>
  );
}
