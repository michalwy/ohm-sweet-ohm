"use server";

import type { z } from "zod";

import type { PermissionKey } from "@/server/access-control/permissions";
import { parseOperationInput, type Operation } from "@/server/api/operations";
import { getAuthorizedSessionActor } from "@/server/auth/currentActor";
import type { ListPage } from "@/server/pagination";
import {
  createOrganizationForWorkspace,
  deleteOrganizationForWorkspace,
  getOrganizationsForWorkspace,
  updateOrganizationForWorkspace,
  type OrganizationSummary
} from "@/server/organizations/organizations";
import {
  createOrganizationOperation,
  deleteOrganizationOperation,
  listOrganizationsOperation,
  updateOrganizationOperation
} from "@/server/organizations/organizationOperations";

export type OrganizationActionResult<T> =
  | { ok: true; data: T; submittedAt: number }
  | { ok: false; error: string; submittedAt: number };

// --- Queries ---

export async function getOrganizationsPageForWorkspace(input: {
  workspaceSlug: string;
  cursor?: string | null;
  pageSize?: number | null;
  sortDir?: "asc" | "desc";
  searchQuery?: string | null;
  roleFilter?: string | null;
}): Promise<OrganizationActionResult<ListPage<OrganizationSummary>>> {
  try {
    const { workspaceSlug, ...data } = parse(listOrganizationsOperation, input);
    const context = await getContext(workspaceSlug, listOrganizationsOperation.permission);
    const page = await getOrganizationsForWorkspace({
      userId: context.user.id,
      workspaceId: context.workspace.id,
      ...data
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
  currency?: string | null;
  defaultPriceEntryMode?: string | null;
  defaultTaxRate?: string | null;
}): Promise<OrganizationActionResult<{ id: string }>> {
  try {
    const { workspaceSlug, ...data } = parse(createOrganizationOperation, input);
    const context = await getContext(workspaceSlug, createOrganizationOperation.permission);
    const result = await createOrganizationForWorkspace({
      userId: context.user.id,
      workspaceId: context.workspace.id,
      ...data
    });
    if (!result.ok) throw new Error(result.error);
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
  currency?: string | null;
  defaultPriceEntryMode?: string | null;
  defaultTaxRate?: string | null;
}): Promise<OrganizationActionResult<null>> {
  try {
    const { workspaceSlug, ...data } = parse(updateOrganizationOperation, input);
    const context = await getContext(workspaceSlug, updateOrganizationOperation.permission);
    const result = await updateOrganizationForWorkspace({
      userId: context.user.id,
      workspaceId: context.workspace.id,
      ...data
    });
    if (!result.ok) throw new Error(result.error);
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
    const { workspaceSlug, ...data } = parse(deleteOrganizationOperation, input);
    const context = await getContext(workspaceSlug, deleteOrganizationOperation.permission);
    const result = await deleteOrganizationForWorkspace({
      userId: context.user.id,
      workspaceId: context.workspace.id,
      id: data.id
    });
    if (!result.ok) throw new Error(result.error);
    return success(null);
  } catch (error) {
    return failure(error);
  }
}

// --- Helpers ---

/**
 * Validates an action's input through its operation's schema (#279), so the form, REST and MCP
 * accept the same shapes; the workspace slug is the session's and stays outside the schema.
 * Throws `invalid-input`.
 */
function parse<TInput extends z.ZodType>(
  operation: Operation<TInput, z.ZodType>,
  input: { workspaceSlug: string }
): { workspaceSlug: string } & z.output<TInput> {
  const { workspaceSlug, ...rawInput } = input;
  const parsed = parseOperationInput(operation, rawInput);

  if (!parsed.ok) {
    throw new Error(parsed.error.code);
  }

  return Object.assign({ workspaceSlug }, parsed.data);
}

async function getContext(workspaceSlug: string, permission: PermissionKey) {
  return getAuthorizedSessionActor(workspaceSlug, permission);
}


function success<T>(data: T): OrganizationActionResult<T> {
  return { ok: true, data, submittedAt: Date.now() };
}

function failure(error: unknown): OrganizationActionResult<never> {
  if (!(error instanceof Error))
    return { ok: false, error: "database-unavailable", submittedAt: Date.now() };
  return { ok: false, error: error.message.replaceAll("_", "-"), submittedAt: Date.now() };
}
