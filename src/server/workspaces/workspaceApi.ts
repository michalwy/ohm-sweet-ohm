import "server-only";

import { actorHasPermission, type WorkspaceActor } from "@/server/access-control/actor";
import { implementOperation } from "@/server/api/execute";
import { API_TOKEN_PERMISSION_KEYS } from "@/server/api-tokens/apiTokenPermissions";
import {
  getWorkspaceOperation,
  whoamiOperation
} from "@/server/workspaces/workspaceOperations";

/**
 * The permission keys an actor holds, expanded: `admin` (a session wildcard; never a token's) is
 * listed as every key it grants, so a caller sees what it may actually do.
 */
export function listActorPermissions(actor: WorkspaceActor) {
  return API_TOKEN_PERMISSION_KEYS.filter((key) => actorHasPermission(actor, key)).sort();
}

export const whoamiImplementation = implementOperation(whoamiOperation, async (actor) => ({
  user: { id: actor.user.id, name: actor.user.name, email: actor.user.email },
  workspace: {
    id: actor.workspace.id,
    name: actor.workspace.name,
    slug: actor.workspace.slug
  },
  permissions: listActorPermissions(actor)
}));

/** Reads the actor's own workspace; the actor already carries it, scoped and authorized. */
export const getWorkspaceImplementation = implementOperation(
  getWorkspaceOperation,
  async (actor) => {
    const workspace = actor.workspace;

    return {
      id: workspace.id,
      name: workspace.name,
      slug: workspace.slug,
      primaryCurrency: workspace.primaryCurrency,
      defaultPriceEntryMode: workspace.defaultPriceEntryMode,
      defaultTaxRate: workspace.defaultTaxRate === null ? null : workspace.defaultTaxRate.toString(),
      activeSupplierProvider: workspace.activeSupplierProvider,
      createdAt: workspace.createdAt.toISOString(),
      updatedAt: workspace.updatedAt.toISOString()
    };
  }
);
