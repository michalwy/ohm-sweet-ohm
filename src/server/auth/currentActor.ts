import "server-only";

import { headers } from "next/headers";

import {
  requireActorPermission,
  resolveMemberActor,
  resolveTokenActor,
  type ActorResolveOptions,
  type WorkspaceActor
} from "@/server/access-control/actor";
import type { PermissionKey } from "@/server/access-control/permissions";
import { auth } from "@/server/auth/auth";

export type ActorRequest =
  /** A browser request: the Better Auth session cookie plus the workspace slug from the URL. */
  | { kind: "session"; workspaceSlug: string }
  /** An API or MCP request: a bearer token, which is bound to its own workspace. */
  | { kind: "token"; token: string };

/**
 * The one server-side entry point that says who is acting, in which workspace, with which
 * permissions (ADR 0030, #271). `null` when the request is unauthenticated, the user is not a
 * member of the workspace, or the workspace is archived (unless `allowArchived`).
 */
export async function resolveWorkspaceActor(
  request: ActorRequest,
  options: ActorResolveOptions = {}
): Promise<WorkspaceActor | null> {
  if (request.kind === "token") {
    return resolveTokenActor(request.token, options);
  }

  const session = await auth.api.getSession({ headers: await headers() });

  if (!session) {
    return null;
  }

  return resolveMemberActor(
    { userId: session.user.id, workspace: { slug: request.workspaceSlug } },
    options
  );
}

/**
 * The session actor for a workspace slug, holding `permission`. Throws `workspace-not-found` when
 * there is no actor and `workspace-permission-denied` when it lacks the permission — the errors the
 * server actions have always reported.
 */
export async function getAuthorizedSessionActor(
  workspaceSlug: string,
  permission: PermissionKey,
  options: ActorResolveOptions = {}
): Promise<WorkspaceActor> {
  const actor = await getSessionActor(workspaceSlug, options);

  requireActorPermission(actor, permission);

  return actor;
}

/** The session actor for a workspace slug, before any permission check. Throws when there is none. */
export async function getSessionActor(
  workspaceSlug: string,
  options: ActorResolveOptions = {}
): Promise<WorkspaceActor> {
  const actor = await resolveWorkspaceActor({ kind: "session", workspaceSlug }, options);

  if (!actor) {
    throw new Error("workspace-not-found");
  }

  return actor;
}
