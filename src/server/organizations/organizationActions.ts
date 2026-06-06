"use server";

import { getCurrentWorkspaceContextBySlug } from "@/server/auth/currentContext";
import type { ListPage } from "@/server/pagination";
import {
  createOrganizationForWorkspace,
  deleteOrganizationForWorkspace,
  getOrganizationsForWorkspace,
  updateOrganizationForWorkspace,
  type OrganizationSummary
} from "@/server/organizations/organizations";

export type { OrganizationSummary };
import { revalidatePath } from "next/cache";

export type OrganizationActionResult<T> =
  | { ok: true; data: T; submittedAt: number }
  | { ok: false; error: string; submittedAt: number };

// --- Queries ---

export async function getOrganizationsPageForWorkspace(input: {
  workspaceSlug: string;
  cursor?: string | null;
  pageSize?: number | null;
  sortDir?: "asc" | "desc";
}): Promise<OrganizationActionResult<ListPage<OrganizationSummary>>> {
  try {
    const context = await getContext(input.workspaceSlug);
    const page = await getOrganizationsForWorkspace({
      userId: context.user.id,
      workspaceId: context.workspace.id,
      cursor: input.cursor,
      pageSize: input.pageSize,
      sortDir: input.sortDir
    });
    return success(page);
  } catch (error) {
    return failure(error);
  }
}

// --- Mutations ---

export async function createOrganizationAction(input: {
  workspaceSlug: string;
  name: string;
  roles: string[];
}): Promise<OrganizationActionResult<{ id: string }>> {
  try {
    const context = await getContext(input.workspaceSlug);
    const result = await createOrganizationForWorkspace({
      userId: context.user.id,
      workspaceId: context.workspace.id,
      name: input.name,
      roles: input.roles
    });
    if (!result.ok) throw new Error(result.error);
    revalidatePath(workspacePath(input.workspaceSlug));
    return success({ id: result.id });
  } catch (error) {
    return failure(error);
  }
}

export async function updateOrganizationAction(input: {
  workspaceSlug: string;
  id: string;
  name: string;
  roles: string[];
}): Promise<OrganizationActionResult<null>> {
  try {
    const context = await getContext(input.workspaceSlug);
    const result = await updateOrganizationForWorkspace({
      userId: context.user.id,
      workspaceId: context.workspace.id,
      id: input.id,
      name: input.name,
      roles: input.roles
    });
    if (!result.ok) throw new Error(result.error);
    revalidatePath(workspacePath(input.workspaceSlug));
    return success(null);
  } catch (error) {
    return failure(error);
  }
}

export async function deleteOrganizationAction(input: {
  workspaceSlug: string;
  id: string;
}): Promise<OrganizationActionResult<null>> {
  try {
    const context = await getContext(input.workspaceSlug);
    const result = await deleteOrganizationForWorkspace({
      userId: context.user.id,
      workspaceId: context.workspace.id,
      id: input.id
    });
    if (!result.ok) throw new Error(result.error);
    revalidatePath(workspacePath(input.workspaceSlug));
    return success(null);
  } catch (error) {
    return failure(error);
  }
}

// --- Helpers ---

async function getContext(workspaceSlug: string) {
  const context = await getCurrentWorkspaceContextBySlug(workspaceSlug);
  if (!context) throw new Error("workspace-not-found");
  return context;
}

function workspacePath(workspaceSlug: string) {
  return `/w/${encodeURIComponent(workspaceSlug)}`;
}

function success<T>(data: T): OrganizationActionResult<T> {
  return { ok: true, data, submittedAt: Date.now() };
}

function failure(error: unknown): OrganizationActionResult<never> {
  if (!(error instanceof Error))
    return { ok: false, error: "database-unavailable", submittedAt: Date.now() };
  return { ok: false, error: error.message.replaceAll("_", "-"), submittedAt: Date.now() };
}
