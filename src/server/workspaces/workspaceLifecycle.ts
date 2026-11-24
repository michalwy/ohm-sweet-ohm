import "server-only";

import { actorHasPermission, resolveMemberActor } from "@/server/access-control/actor";
import { prisma } from "@/server/db/prisma";
import { getDefaultPartUnitId } from "@/server/units/defaultUnits";
import { applyDemoPreset } from "@/server/workspaces/applyDemoPreset";
import { applyStarterDictionaries } from "@/server/workspaces/applyStarterDictionaries";
import {
  archiveWorkspace as archiveWorkspaceMutation,
  restoreWorkspace as restoreWorkspaceMutation
} from "@/server/workspaces/archiveMutations";
import { createWorkspaceForOwner } from "@/server/workspaces/createWorkspace";
import { DEMO_PRESET_FIXTURE } from "@/server/workspaces/demoPresetFixture";
import type { WorkspaceCreationPreset } from "@/server/workspaces/workspaceOptions";

/**
 * A user's workspaces as a whole — list, create, archive, restore (ADR 0016, #286). The server
 * actions of the workspace picker and Settings → General, and the API, share these.
 */

/** Creates a workspace owned by the user and fills it as the chosen preset says. */
export async function createWorkspaceWithPreset(input: {
  userId: string;
  name: string;
  primaryCurrency: string;
  preset: WorkspaceCreationPreset;
}) {
  const workspace = await createWorkspaceForOwner({
    userId: input.userId,
    name: input.name,
    primaryCurrency: input.primaryCurrency
  });

  if (input.preset === "starter-dictionaries") {
    await applyStarterDictionaries(prisma, workspace.id);
  } else if (input.preset !== "empty") {
    const unitId = await getDefaultPartUnitId(prisma, workspace.id);
    await applyDemoPreset(
      prisma,
      workspace.id,
      unitId,
      input.preset,
      DEMO_PRESET_FIXTURE,
      workspace.primaryCurrency
    );
  }

  return workspace;
}

const userWorkspaceSelect = {
  id: true,
  name: true,
  slug: true,
  primaryCurrency: true,
  archivedAt: true,
  deletionScheduledAt: true,
  createdAt: true
} as const;

/** Every workspace the user is a member of, oldest membership first; archived ones on request. */
export async function listUserWorkspaces(userId: string, { includeArchived = false } = {}) {
  const memberships = await prisma.workspaceMember.findMany({
    where: {
      userId,
      ...(includeArchived ? {} : { workspace: { archivedAt: null } })
    },
    orderBy: { createdAt: "asc" },
    select: { workspace: { select: userWorkspaceSelect } }
  });

  return memberships.map(({ workspace }) => workspace);
}

/**
 * The user's membership of a workspace, checked for the workspace's administrative access — what
 * Settings → General and the archived-workspace list require. Read from the user's **roles**, never
 * from a token's set (which never holds `admin`). Throws `workspace-not-found` when the user is not
 * a member (a workspace they cannot see does not exist for them) and `workspace-requires-admin`
 * when they are not an administrator there.
 */
export async function requireUserWorkspaceAdmin(userId: string, workspaceId: string) {
  const member = await resolveMemberActor(
    { userId, workspace: { id: workspaceId } },
    { allowArchived: true }
  );

  if (!member) {
    throw new Error("workspace-not-found");
  }

  if (!actorHasPermission(member, "admin")) {
    throw new Error("workspace-requires-admin");
  }

  return member.workspace;
}

/** Archives a workspace the user administers. */
export async function archiveUserWorkspace(userId: string, workspaceId: string) {
  const workspace = await requireUserWorkspaceAdmin(userId, workspaceId);

  if (workspace.archivedAt) {
    throw new Error("workspace-already-archived");
  }

  await archiveWorkspaceMutation(workspace.id);
}

/**
 * Restores an archived workspace the user administers. One whose deletion is already scheduled
 * cannot be restored: the picker offers no Restore for it either.
 */
export async function restoreUserWorkspace(userId: string, workspaceId: string) {
  const workspace = await requireUserWorkspaceAdmin(userId, workspaceId);

  if (!workspace.archivedAt) {
    throw new Error("workspace-not-archived");
  }

  if (workspace.deletionScheduledAt) {
    throw new Error("workspace-deletion-scheduled");
  }

  await restoreWorkspaceMutation(workspace.id);
}

/** Reads one of the user's workspaces, archived or not. */
export async function getUserWorkspace(userId: string, workspaceId: string) {
  const membership = await prisma.workspaceMember.findFirst({
    where: { userId, workspaceId },
    select: { workspace: { select: userWorkspaceSelect } }
  });

  if (!membership) {
    throw new Error("workspace-not-found");
  }

  return membership.workspace;
}
