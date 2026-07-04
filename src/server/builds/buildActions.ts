"use server";

import { getCurrentWorkspaceContextBySlug } from "@/server/auth/currentContext";
import type { ListPage } from "@/server/pagination";
import {
  assembleDesignator,
  cancelBuild,
  createBuild,
  deleteBuild,
  getBuildCreateOptions,
  getBuildDetail,
  getBuildsForWorkspace,
  markBuildAllocated,
  reassignDesignatorAssignment,
  reopenBuild,
  setBuildAllocations,
  setBuildLineAllocations,
  startBuild,
  type BuildCreateOptions,
  type BuildDetail,
  type BuildSummary
} from "@/server/builds/builds";

export type BuildActionResult<T> =
  | { ok: true; data: T; submittedAt: number }
  | { ok: false; error: string; submittedAt: number };

// --- Queries ---

export async function getBuildsPageForWorkspace(input: {
  workspaceSlug: string;
  cursor?: string | null;
  pageSize?: number | null;
}): Promise<BuildActionResult<ListPage<BuildSummary>>> {
  try {
    const context = await getContext(input.workspaceSlug);
    const page = await getBuildsForWorkspace({
      userId: context.user.id,
      workspaceId: context.workspace.id,
      cursor: input.cursor,
      pageSize: input.pageSize
    });
    return success(page);
  } catch (error) {
    return failure(error);
  }
}

export async function getBuildDetailAction(input: {
  workspaceSlug: string;
  buildId: string;
}): Promise<BuildActionResult<BuildDetail | null>> {
  try {
    const context = await getContext(input.workspaceSlug);
    const detail = await getBuildDetail({
      userId: context.user.id,
      workspaceId: context.workspace.id,
      buildId: input.buildId
    });
    return success(detail);
  } catch (error) {
    return failure(error);
  }
}

export async function getBuildCreateOptionsAction(input: {
  workspaceSlug: string;
}): Promise<BuildActionResult<BuildCreateOptions>> {
  try {
    const context = await getContext(input.workspaceSlug);
    const options = await getBuildCreateOptions({
      userId: context.user.id,
      workspaceId: context.workspace.id
    });
    return success(options);
  } catch (error) {
    return failure(error);
  }
}

// --- Mutations ---

export async function createBuildAction(input: {
  workspaceSlug: string;
  designRevisionId: string;
  targetQuantity: number;
  outputLocationId?: string | null;
}): Promise<BuildActionResult<{ id: string }>> {
  try {
    const context = await getContext(input.workspaceSlug);
    const result = await createBuild({
      userId: context.user.id,
      workspaceId: context.workspace.id,
      designRevisionId: input.designRevisionId,
      targetQuantity: input.targetQuantity,
      outputLocationId: input.outputLocationId,
      createdByUserId: context.user.id
    });
    if (!result.ok) throw new Error(result.error);
    return success(result.data);
  } catch (error) {
    return failure(error);
  }
}

export async function deleteBuildAction(input: {
  workspaceSlug: string;
  buildId: string;
}): Promise<BuildActionResult<null>> {
  try {
    const context = await getContext(input.workspaceSlug);
    const result = await deleteBuild({
      userId: context.user.id,
      workspaceId: context.workspace.id,
      buildId: input.buildId
    });
    if (!result.ok) throw new Error(result.error);
    return success(null);
  } catch (error) {
    return failure(error);
  }
}

export async function setBuildLineAllocationsAction(input: {
  workspaceSlug: string;
  buildLineItemId: string;
  entries: { partId: string; sourceLocationId: string | null; quantity: number }[];
}): Promise<BuildActionResult<null>> {
  try {
    const context = await getContext(input.workspaceSlug);
    const result = await setBuildLineAllocations({
      userId: context.user.id,
      workspaceId: context.workspace.id,
      buildLineItemId: input.buildLineItemId,
      entries: input.entries
    });
    if (!result.ok) throw new Error(result.error);
    return success(null);
  } catch (error) {
    return failure(error);
  }
}

export async function setBuildAllocationsAction(input: {
  workspaceSlug: string;
  buildId: string;
  lines: {
    buildLineItemId: string;
    entries: { partId: string; sourceLocationId: string | null; quantity: number }[];
  }[];
}): Promise<BuildActionResult<null>> {
  try {
    const context = await getContext(input.workspaceSlug);
    const result = await setBuildAllocations({
      userId: context.user.id,
      workspaceId: context.workspace.id,
      buildId: input.buildId,
      lines: input.lines
    });
    if (!result.ok) throw new Error(result.error);
    return success(null);
  } catch (error) {
    return failure(error);
  }
}

export async function reassignDesignatorAssignmentAction(input: {
  workspaceSlug: string;
  assignmentId: string;
  partId: string;
  sourceLocationId: string | null;
}): Promise<BuildActionResult<null>> {
  try {
    const context = await getContext(input.workspaceSlug);
    const result = await reassignDesignatorAssignment({
      userId: context.user.id,
      workspaceId: context.workspace.id,
      assignmentId: input.assignmentId,
      partId: input.partId,
      sourceLocationId: input.sourceLocationId
    });
    if (!result.ok) throw new Error(result.error);
    return success(null);
  } catch (error) {
    return failure(error);
  }
}

export async function markBuildAllocatedAction(input: {
  workspaceSlug: string;
  buildId: string;
}): Promise<BuildActionResult<null>> {
  try {
    const context = await getContext(input.workspaceSlug);
    const result = await markBuildAllocated({
      userId: context.user.id,
      workspaceId: context.workspace.id,
      buildId: input.buildId
    });
    if (!result.ok) throw new Error(result.error);
    return success(null);
  } catch (error) {
    return failure(error);
  }
}

export async function reopenBuildAction(input: {
  workspaceSlug: string;
  buildId: string;
}): Promise<BuildActionResult<null>> {
  try {
    const context = await getContext(input.workspaceSlug);
    const result = await reopenBuild({
      userId: context.user.id,
      workspaceId: context.workspace.id,
      buildId: input.buildId
    });
    if (!result.ok) throw new Error(result.error);
    return success(null);
  } catch (error) {
    return failure(error);
  }
}

export async function startBuildAction(input: {
  workspaceSlug: string;
  buildId: string;
}): Promise<BuildActionResult<null>> {
  try {
    const context = await getContext(input.workspaceSlug);
    const result = await startBuild({
      userId: context.user.id,
      workspaceId: context.workspace.id,
      buildId: input.buildId
    });
    if (!result.ok) throw new Error(result.error);
    return success(null);
  } catch (error) {
    return failure(error);
  }
}

export async function assembleDesignatorAction(input: {
  workspaceSlug: string;
  assignmentId: string;
  quantity?: number;
}): Promise<BuildActionResult<{ completed: boolean }>> {
  try {
    const context = await getContext(input.workspaceSlug);
    const result = await assembleDesignator({
      userId: context.user.id,
      workspaceId: context.workspace.id,
      assignmentId: input.assignmentId,
      quantity: input.quantity
    });
    if (!result.ok) throw new Error(result.error);
    return success(result.data);
  } catch (error) {
    return failure(error);
  }
}

export async function cancelBuildAction(input: {
  workspaceSlug: string;
  buildId: string;
}): Promise<BuildActionResult<null>> {
  try {
    const context = await getContext(input.workspaceSlug);
    const result = await cancelBuild({
      userId: context.user.id,
      workspaceId: context.workspace.id,
      buildId: input.buildId
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

function success<T>(data: T): BuildActionResult<T> {
  return { ok: true, data, submittedAt: Date.now() };
}

function failure(error: unknown): BuildActionResult<never> {
  if (!(error instanceof Error))
    return { ok: false, error: "database-unavailable", submittedAt: Date.now() };
  return { ok: false, error: error.message.replaceAll("_", "-"), submittedAt: Date.now() };
}
