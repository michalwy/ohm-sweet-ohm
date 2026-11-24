import "server-only";

import { actorHasPermission, resolveMemberActor } from "@/server/access-control/actor";
import type { PermissionKey } from "@/server/access-control/permissions";

type WorkspacePermissionInput = {
  userId: string;
  workspaceId: string;
  permission: PermissionKey;
};

/**
 * A role-only check for a user in a workspace, archived or not.
 *
 * Domain functions that take `{ userId, workspaceId }` re-check with it as defence in depth. It
 * knows nothing of API tokens, so it is never the authorization of a request: the adapter in front
 * of the domain function — a server action, a REST endpoint, an MCP tool — checks the request's
 * `WorkspaceActor` first (ADR 0030, `docs/agents/architecture.md`).
 */
export async function hasWorkspacePermission({
  userId,
  workspaceId,
  permission
}: WorkspacePermissionInput) {
  const actor = await resolveMemberActor(
    { userId, workspace: { id: workspaceId } },
    { allowArchived: true }
  );

  return actor !== null && actorHasPermission(actor, permission);
}

export async function authorizeWorkspacePermission(
  input: WorkspacePermissionInput
) {
  const isAllowed = await hasWorkspacePermission(input);

  if (!isAllowed) {
    throw new Error("workspace-permission-denied");
  }
}
