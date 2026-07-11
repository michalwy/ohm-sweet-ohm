"use server";

import { getCurrentWorkspaceContextBySlug } from "@/server/auth/currentContext";
import { getDefaultPartUnitId } from "@/server/units/defaultUnits";
import { prisma } from "@/server/db/prisma";
import type { ListPage } from "@/server/pagination";
import {
  addRevisionToDesign,
  createDesign,
  deleteDesign,
  getDesignDetail,
  getDesignsForWorkspace,
  getNextDesignCatalogNumber,
  updateDesign,
  updateDesignRevision,
  type DesignDetail,
  type DesignSortBy,
  type DesignSummary
} from "@/server/designs/designs";

export type DesignActionResult<T> =
  | { ok: true; data: T; submittedAt: number }
  | { ok: false; error: string; submittedAt: number };

// --- Queries ---

export async function getDesignsPageForWorkspace(input: {
  workspaceSlug: string;
  cursor?: string | null;
  pageSize?: number | null;
  sortBy?: DesignSortBy;
  sortDir?: "asc" | "desc";
  searchQuery?: string | null;
}): Promise<DesignActionResult<ListPage<DesignSummary>>> {
  try {
    const context = await getContext(input.workspaceSlug);
    const page = await getDesignsForWorkspace({
      userId: context.user.id,
      workspaceId: context.workspace.id,
      cursor: input.cursor,
      pageSize: input.pageSize,
      sortBy: input.sortBy,
      sortDir: input.sortDir,
      searchQuery: input.searchQuery
    });
    return success(page);
  } catch (error) {
    return failure(error);
  }
}

export async function getDesignDetailAction(input: {
  workspaceSlug: string;
  designId: string;
}): Promise<DesignActionResult<DesignDetail | null>> {
  try {
    const context = await getContext(input.workspaceSlug);
    const detail = await getDesignDetail({
      userId: context.user.id,
      workspaceId: context.workspace.id,
      designId: input.designId
    });
    return success(detail);
  } catch (error) {
    return failure(error);
  }
}

export async function getNextDesignCatalogNumberAction(input: {
  workspaceSlug: string;
}): Promise<DesignActionResult<string>> {
  try {
    const context = await getContext(input.workspaceSlug);
    const catalogNumber = await getNextDesignCatalogNumber(context.workspace.id);
    return success(catalogNumber);
  } catch (error) {
    return failure(error);
  }
}

// --- Mutations ---

export async function createDesignAction(input: {
  workspaceSlug: string;
  name: string;
  description?: string | null;
  catalogNumber: string;
}): Promise<DesignActionResult<{ id: string }>> {
  try {
    const context = await getContext(input.workspaceSlug);
    const unitId = await getDefaultPartUnitId(prisma, context.workspace.id);
    if (!unitId) throw new Error("no_default_unit");
    const result = await createDesign({
      userId: context.user.id,
      workspaceId: context.workspace.id,
      workspaceName: context.workspace.name,
      name: input.name,
      description: input.description,
      catalogNumber: input.catalogNumber,
      unitId
    });
    if (!result.ok) throw new Error(result.error);
    return success({ id: result.id });
  } catch (error) {
    return failure(error);
  }
}

export async function updateDesignAction(input: {
  workspaceSlug: string;
  designId: string;
  name: string;
  description?: string | null;
}): Promise<DesignActionResult<null>> {
  try {
    const context = await getContext(input.workspaceSlug);
    const result = await updateDesign({
      userId: context.user.id,
      workspaceId: context.workspace.id,
      designId: input.designId,
      name: input.name,
      description: input.description
    });
    if (!result.ok) throw new Error(result.error);
    return success(null);
  } catch (error) {
    return failure(error);
  }
}

export async function deleteDesignAction(input: {
  workspaceSlug: string;
  designId: string;
}): Promise<DesignActionResult<null>> {
  try {
    const context = await getContext(input.workspaceSlug);
    const result = await deleteDesign({
      userId: context.user.id,
      workspaceId: context.workspace.id,
      designId: input.designId
    });
    if (!result.ok) throw new Error(result.error);
    return success(null);
  } catch (error) {
    return failure(error);
  }
}

export async function addRevisionToDesignAction(input: {
  workspaceSlug: string;
  designId: string;
  notes?: string | null;
}): Promise<DesignActionResult<{ id: string }>> {
  try {
    const context = await getContext(input.workspaceSlug);
    const result = await addRevisionToDesign({
      userId: context.user.id,
      workspaceId: context.workspace.id,
      designId: input.designId,
      notes: input.notes
    });
    if (!result.ok) throw new Error(result.error);
    return success({ id: result.id });
  } catch (error) {
    return failure(error);
  }
}

export async function updateDesignRevisionAction(input: {
  workspaceSlug: string;
  revisionId: string;
  notes: string | null;
}): Promise<DesignActionResult<null>> {
  try {
    const context = await getContext(input.workspaceSlug);
    const result = await updateDesignRevision({
      userId: context.user.id,
      workspaceId: context.workspace.id,
      revisionId: input.revisionId,
      notes: input.notes
    });
    if (!result.ok) throw new Error(result.error);
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

function success<T>(data: T): DesignActionResult<T> {
  return { ok: true, data, submittedAt: Date.now() };
}

function failure(error: unknown): DesignActionResult<never> {
  if (!(error instanceof Error))
    return { ok: false, error: "database-unavailable", submittedAt: Date.now() };
  return { ok: false, error: error.message.replaceAll("_", "-"), submittedAt: Date.now() };
}
