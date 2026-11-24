import "server-only";

import type { WorkspaceActor } from "@/server/access-control/actor";
import { implementOperation } from "@/server/api/execute";
import {
  createOrganizationOperation,
  deleteOrganizationOperation,
  getOrganizationOperation,
  listOrganizationsOperation,
  updateOrganizationOperation
} from "@/server/organizations/organizationOperations";
import {
  createOrganizationForWorkspace,
  deleteOrganizationForWorkspace,
  getOrganizationForWorkspace,
  getOrganizationsForWorkspace,
  updateOrganizationForWorkspace,
  type OrganizationSummary
} from "@/server/organizations/organizations";

/**
 * The organization operations (#279), over the same domain functions as the server actions in
 * `organizationActions.ts`. Every call is scoped to the actor's workspace; the permission is checked
 * by `executeOperation` before the function runs.
 */

function toOrganizationOutput(organization: OrganizationSummary) {
  return { ...organization, createdAt: organization.createdAt.toISOString() };
}

/**
 * A domain error code as the API reports it: snake_case becomes kebab-case, and the bare
 * `not_found` names its record, so REST answers 404.
 */
export function toOrganizationErrorCode(error: string) {
  return error === "not_found" ? "organization-not-found" : error.replaceAll("_", "-");
}

async function readOrganization(actor: WorkspaceActor, id: string) {
  const organization = await getOrganizationForWorkspace({
    userId: actor.user.id,
    workspaceId: actor.workspace.id,
    id
  });

  if (!organization) {
    throw new Error("organization-not-found");
  }

  return toOrganizationOutput(organization);
}

export const listOrganizationsImplementation = implementOperation(
  listOrganizationsOperation,
  async (actor, input) => {
    const page = await getOrganizationsForWorkspace({
      userId: actor.user.id,
      workspaceId: actor.workspace.id,
      ...input
    });

    return { ...page, items: page.items.map(toOrganizationOutput) };
  }
);

export const getOrganizationImplementation = implementOperation(
  getOrganizationOperation,
  async (actor, input) => readOrganization(actor, input.id)
);

export const createOrganizationImplementation = implementOperation(
  createOrganizationOperation,
  async (actor, input) => {
    const result = await createOrganizationForWorkspace({
      userId: actor.user.id,
      workspaceId: actor.workspace.id,
      ...input
    });

    if (!result.ok) {
      throw new Error(toOrganizationErrorCode(result.error));
    }

    return readOrganization(actor, result.id);
  }
);

export const updateOrganizationImplementation = implementOperation(
  updateOrganizationOperation,
  async (actor, input) => {
    const result = await updateOrganizationForWorkspace({
      userId: actor.user.id,
      workspaceId: actor.workspace.id,
      ...input
    });

    if (!result.ok) {
      throw new Error(toOrganizationErrorCode(result.error));
    }

    return readOrganization(actor, input.id);
  }
);

export const deleteOrganizationImplementation = implementOperation(
  deleteOrganizationOperation,
  async (actor, input) => {
    const result = await deleteOrganizationForWorkspace({
      userId: actor.user.id,
      workspaceId: actor.workspace.id,
      id: input.id
    });

    if (!result.ok) {
      throw new Error(toOrganizationErrorCode(result.error));
    }

    return { id: input.id };
  }
);
