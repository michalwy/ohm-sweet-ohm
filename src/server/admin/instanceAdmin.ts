import "server-only";

import type { User } from "@/generated/prisma/client";
import type { WorkspaceActor } from "@/server/access-control/actor";
import { actorHasPermission } from "@/server/access-control/actor";
import { getCurrentSession } from "@/server/auth/currentContext";
import { prisma } from "@/server/db/prisma";

import { isInstanceAdministrator } from "./instanceAdminPolicy";

/**
 * Who administers the instance (#324). An instance administrator is not a workspace role: it sees
 * every account and every workspace, and is checked here, in server-side code, before any admin
 * panel page, server action or admin MCP tool does anything.
 */
export async function isInstanceAdmin(userId: string): Promise<boolean> {
  return (await getInstanceAdminChecker())(userId);
}

/** One read of who administers the instance, then a check per user (for listings). */
export async function getInstanceAdminChecker(): Promise<(userId: string) => boolean> {
  const [flagged, oldest] = await Promise.all([
    prisma.user.findMany({ where: { isInstanceAdmin: true }, select: { id: true, isInstanceAdmin: true } }),
    prisma.user.findFirst({
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      select: { id: true, isInstanceAdmin: true }
    })
  ]);

  return (userId) => isInstanceAdministrator({ userId, flagged, oldest });
}

/** The signed-in user when they are an instance administrator; null otherwise (or signed out). */
export async function getSessionInstanceAdmin(): Promise<Pick<User, "id" | "email" | "name"> | null> {
  const session = await getCurrentSession();

  if (!session || !(await isInstanceAdmin(session.user.id))) {
    return null;
  }

  return { id: session.user.id, email: session.user.email, name: session.user.name };
}

/**
 * Admin MCP tools (#324): the token's user must be an instance administrator, and a tool that
 * changes anything also needs a token that may write (`workspace:write`, which the `read-write`
 * preset holds) — a read-only token or connection never deletes an account. Throws
 * `permission-denied`.
 */
export async function requireInstanceAdminActor(
  actor: WorkspaceActor,
  { write }: { write: boolean }
): Promise<void> {
  if (!(await isInstanceAdmin(actor.user.id))) {
    throw new Error("permission-denied");
  }

  if (write && !actorHasPermission(actor, "workspace:write")) {
    throw new Error("permission-denied");
  }
}
