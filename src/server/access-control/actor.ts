import "server-only";

import type { Prisma, User } from "@/generated/prisma/client";
import {
  getEffectivePermissions,
  permissionSetGrants,
  type EffectivePermissions
} from "@/server/access-control/effectivePermissions";
import { PERMISSIONS, type PermissionKey } from "@/server/access-control/permissions";
import { prisma } from "@/server/db/prisma";

const actorWorkspaceSelect = {
  id: true,
  name: true,
  slug: true,
  primaryCurrency: true,
  defaultPriceEntryMode: true,
  defaultTaxRate: true,
  activeSupplierProvider: true,
  archivedAt: true,
  deletionScheduledAt: true,
  createdAt: true,
  updatedAt: true
} as const;

/**
 * Who is acting, in which workspace, with which permissions (ADR 0030, #271).
 *
 * Every server action — and later every REST endpoint and MCP tool — authorizes against a
 * `WorkspaceActor`, whether the request carried a Better Auth session or an API token. Resolve one
 * with `resolveWorkspaceActor` (`src/server/auth/currentActor.ts`); never check a permission against
 * the session directly.
 */
export type WorkspaceActor = {
  source: "session" | "token";
  user: User;
  workspace: ActorWorkspace;
  permissions: EffectivePermissions;
};

export type ActorWorkspace = Prisma.WorkspaceGetPayload<{ select: typeof actorWorkspaceSelect }>;

export type ActorResolveOptions = {
  /**
   * Archived workspaces are denied (ADR 0016) unless the caller manages the workspace's own
   * lifecycle — archiving, restoring, scheduling deletion — and opts in.
   */
  allowArchived?: boolean;
};

/** What a verified API token says about itself. */
export type VerifiedApiToken = {
  userId: string;
  workspaceId: string;
  permissions: PermissionKey[];
};


const permissionKeys = new Set<string>(PERMISSIONS);

function loadMembership(
  userId: string,
  workspace: { id: string } | { slug: string }
) {
  return prisma.workspaceMember.findFirst({
    where: {
      userId,
      workspace: "id" in workspace ? { id: workspace.id } : { slug: workspace.slug }
    },
    select: {
      user: true,
      workspace: { select: actorWorkspaceSelect },
      roles: {
        select: {
          role: {
            select: {
              permissions: { select: { permissionKey: true } }
            }
          }
        }
      }
    }
  });
}

/**
 * Builds the actor for a known user in a workspace given by id or slug. `null` when the user is not
 * a member, or the workspace is archived and `allowArchived` is not set.
 *
 * `tokenPermissions` is `null` for a browser session and the token's permission set for an API
 * token; the effective permissions are then the intersection with the user's roles.
 */
export async function resolveMemberActor(
  {
    userId,
    workspace,
    tokenPermissions = null
  }: {
    userId: string;
    workspace: { id: string } | { slug: string };
    tokenPermissions?: PermissionKey[] | null;
  },
  options: ActorResolveOptions = {}
): Promise<WorkspaceActor | null> {
  const membership = await loadMembership(userId, workspace);

  if (!membership) {
    return null;
  }

  if (membership.workspace.archivedAt && !options.allowArchived) {
    return null;
  }

  const rolePermissions = membership.roles.flatMap(({ role }) =>
    role.permissions
      .map(({ permissionKey }) => permissionKey)
      .filter((key): key is PermissionKey => permissionKeys.has(key))
  );

  return {
    source: tokenPermissions === null ? "session" : "token",
    user: membership.user,
    workspace: membership.workspace,
    permissions: getEffectivePermissions({ rolePermissions, tokenPermissions })
  };
}

/**
 * Verifies a raw API token. A stub until the personal access tokens issue lands: no token is valid
 * yet, so every token request is unauthenticated.
 */
export async function verifyApiToken(token: string): Promise<VerifiedApiToken | null> {
  void token;

  return null;
}

export async function resolveTokenActor(
  token: string,
  options: ActorResolveOptions = {}
): Promise<WorkspaceActor | null> {
  const verified = await verifyApiToken(token);

  if (!verified) {
    return null;
  }

  return resolveMemberActor(
    {
      userId: verified.userId,
      workspace: { id: verified.workspaceId },
      tokenPermissions: verified.permissions
    },
    options
  );
}

export function actorHasPermission(actor: WorkspaceActor, permission: PermissionKey) {
  return permissionSetGrants(actor.permissions, permission);
}

export function requireActorPermission(actor: WorkspaceActor, permission: PermissionKey) {
  if (!actorHasPermission(actor, permission)) {
    throw new Error("workspace-permission-denied");
  }
}
