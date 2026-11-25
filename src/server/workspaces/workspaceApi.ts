import "server-only";

import type { Workspace } from "@/generated/prisma/client";
import { actorHasPermission, type WorkspaceActor } from "@/server/access-control/actor";
import { implementOperation } from "@/server/api/execute";
import { API_TOKEN_PERMISSION_KEYS } from "@/server/api-tokens/apiTokenPermissions";
import { prisma } from "@/server/db/prisma";
import { setWorkspaceActiveSupplierProvider } from "@/server/integrations/providerSettings";
import type { SupplierProviderKey } from "@/server/integrations/types";
import {
  getDisplayPreferencesForUser,
  updateDisplayPreferencesForUser
} from "@/server/user/displayPreferenceMutations";
import { applyStarterDictionaries } from "@/server/workspaces/applyStarterDictionaries";
import {
  archiveUserWorkspace,
  createWorkspaceWithPreset,
  getUserWorkspace,
  listUserWorkspaces,
  requireUserWorkspaceAdmin,
  restoreUserWorkspace
} from "@/server/workspaces/workspaceLifecycle";
import {
  archiveWorkspaceOperation,
  createWorkspaceOperation,
  getDisplayPreferencesOperation,
  getWorkspaceOperation,
  listWorkspacesOperation,
  loadStarterDictionariesOperation,
  restoreWorkspaceOperation,
  updateDisplayPreferencesOperation,
  updateWorkspaceSettingsOperation,
  whoamiOperation
} from "@/server/workspaces/workspaceOperations";
import {
  parseDefaultTaxRate,
  updateWorkspaceDefaultLocationForWorkspace,
  updateWorkspaceOrderingDefaultsForWorkspace,
  type PriceEntryMode
} from "@/server/workspaces/workspaceSettings";

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

type WorkspaceDetailsSource = Pick<
  Workspace,
  | "id"
  | "name"
  | "slug"
  | "primaryCurrency"
  | "defaultPriceEntryMode"
  | "defaultTaxRate"
  | "activeSupplierProvider"
  | "defaultLocationId"
  | "createdAt"
  | "updatedAt"
>;

function toWorkspaceDetails(workspace: WorkspaceDetailsSource) {
  return {
    id: workspace.id,
    name: workspace.name,
    slug: workspace.slug,
    primaryCurrency: workspace.primaryCurrency,
    defaultPriceEntryMode: workspace.defaultPriceEntryMode,
    defaultTaxRate: workspace.defaultTaxRate === null ? null : workspace.defaultTaxRate.toString(),
    activeSupplierProvider: workspace.activeSupplierProvider,
    defaultLocationId: workspace.defaultLocationId,
    createdAt: workspace.createdAt.toISOString(),
    updatedAt: workspace.updatedAt.toISOString()
  };
}

/** Reads the actor's own workspace; the actor already carries it, scoped and authorized. */
export const getWorkspaceImplementation = implementOperation(
  getWorkspaceOperation,
  async (actor) => toWorkspaceDetails(actor.workspace)
);

type UserWorkspaceSource = {
  id: string;
  name: string;
  slug: string;
  primaryCurrency: string;
  archivedAt: Date | null;
  deletionScheduledAt: Date | null;
  createdAt: Date;
};

function toUserWorkspace(actor: WorkspaceActor, workspace: UserWorkspaceSource) {
  return {
    id: workspace.id,
    name: workspace.name,
    slug: workspace.slug,
    primaryCurrency: workspace.primaryCurrency,
    archivedAt: workspace.archivedAt?.toISOString() ?? null,
    deletionScheduledAt: workspace.deletionScheduledAt?.toISOString() ?? null,
    createdAt: workspace.createdAt.toISOString(),
    isTokenWorkspace: workspace.id === actor.workspace.id
  };
}

/*
 * The user's workspaces (#286). A token is bound to one workspace, but these act for its user on
 * any workspace they belong to, as the workspace picker does; archiving and restoring also need the
 * user's administrative role in the workspace acted on, read from their roles (a token never holds
 * `admin`). Archiving the token's own workspace is allowed: the token then stops working.
 */

export const listWorkspacesImplementation = implementOperation(
  listWorkspacesOperation,
  async (actor, input) => ({
    items: (await listUserWorkspaces(actor.user.id, { includeArchived: input.includeArchived })).map(
      (workspace) => toUserWorkspace(actor, workspace)
    )
  })
);

export const createWorkspaceImplementation = implementOperation(
  createWorkspaceOperation,
  async (actor, input) => {
    const name = input.name.trim();

    if (!name) {
      throw new Error("missing-name");
    }

    const workspace = await createWorkspaceWithPreset({
      userId: actor.user.id,
      name,
      primaryCurrency: input.primaryCurrency,
      preset: input.preset ?? "empty"
    });

    return toUserWorkspace(actor, await getUserWorkspace(actor.user.id, workspace.id));
  }
);

export const archiveWorkspaceImplementation = implementOperation(
  archiveWorkspaceOperation,
  async (actor, { id }) => {
    await archiveUserWorkspace(actor.user.id, id);
    return toUserWorkspace(actor, await getUserWorkspace(actor.user.id, id));
  }
);

export const restoreWorkspaceImplementation = implementOperation(
  restoreWorkspaceOperation,
  async (actor, { id }) => {
    await restoreUserWorkspace(actor.user.id, id);
    return toUserWorkspace(actor, await getUserWorkspace(actor.user.id, id));
  }
);

const supplierProviderKeys: Record<"DIGIKEY" | "MOUSER" | "TME", SupplierProviderKey> = {
  DIGIKEY: "digikey",
  MOUSER: "mouser",
  TME: "tme"
};

/**
 * Settings → Ordering, Settings → Inventory and the supplier choice of Settings → Integrations, for the token's
 * workspace. Every input is checked before anything is written, so a bad tax rate changes nothing.
 */
export const updateWorkspaceSettingsImplementation = implementOperation(
  updateWorkspaceSettingsOperation,
  async (actor, input) => {
    const workspace = actor.workspace;

    await requireUserWorkspaceAdmin(actor.user.id, workspace.id);

    const defaultTaxRate =
      input.defaultTaxRate === undefined
        ? workspace.defaultTaxRate
        : parseDefaultTaxRate(input.defaultTaxRate);

    // Validated before it is written, so an unknown location changes nothing either.
    if (input.defaultLocationId !== undefined) {
      await updateWorkspaceDefaultLocationForWorkspace(workspace.id, input.defaultLocationId);
    }

    if (input.defaultPriceEntryMode !== undefined || input.defaultTaxRate !== undefined) {
      await updateWorkspaceOrderingDefaultsForWorkspace(workspace.id, {
        defaultPriceEntryMode:
          input.defaultPriceEntryMode ?? (workspace.defaultPriceEntryMode as PriceEntryMode),
        defaultTaxRate
      });
    }

    if (input.activeSupplierProvider !== undefined) {
      await setWorkspaceActiveSupplierProvider({
        workspaceId: workspace.id,
        provider: supplierProviderKeys[input.activeSupplierProvider]
      });
    }

    return toWorkspaceDetails(
      await prisma.workspace.findUniqueOrThrow({ where: { id: workspace.id } })
    );
  }
);

export const loadStarterDictionariesImplementation = implementOperation(
  loadStarterDictionariesOperation,
  async (actor) => {
    await requireUserWorkspaceAdmin(actor.user.id, actor.workspace.id);
    return applyStarterDictionaries(prisma, actor.workspace.id);
  }
);

/** The user's own display preferences; they are not the workspace's, and apply in every one. */
export const getDisplayPreferencesImplementation = implementOperation(
  getDisplayPreferencesOperation,
  async (actor) => getDisplayPreferencesForUser(actor.user.id)
);

export const updateDisplayPreferencesImplementation = implementOperation(
  updateDisplayPreferencesOperation,
  async (actor, input) => updateDisplayPreferencesForUser(actor.user.id, input)
);
