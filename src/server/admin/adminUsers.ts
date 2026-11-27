import "server-only";

import { OWNER_ROLE_NAME } from "@/server/access-control/permissions";
import { prisma } from "@/server/db/prisma";
import { deleteWorkspaceRows } from "@/server/workspaces/deletionMutations";

import { getInstanceAdminChecker } from "./instanceAdmin";
import { isSolelyOwnedWorkspace } from "./instanceAdminPolicy";

/**
 * The admin panel's view of accounts (#324): every user, the workspaces they belong to (with their
 * role there and the member count), and the two deletions. Callers have checked that the acting
 * user is an instance administrator.
 */

export type AdminUserWorkspace = {
  id: string;
  name: string;
  slug: string;
  /** The user's role names in the workspace, sorted. */
  roles: string[];
  /** Whether the user holds the owner role there. */
  owner: boolean;
  /** Whether "delete the user's data" deletes it: the user owns it and no other member does. */
  solelyOwned: boolean;
  memberCount: number;
  archived: boolean;
};

export type AdminUser = {
  id: string;
  email: string;
  name: string | null;
  createdAt: Date;
  instanceAdmin: boolean;
  workspaces: AdminUserWorkspace[];
};

const membershipSelect = {
  workspace: {
    select: {
      id: true,
      name: true,
      slug: true,
      archivedAt: true,
      _count: { select: { members: true } },
      members: {
        where: { roles: { some: { role: { name: OWNER_ROLE_NAME } } } },
        select: { userId: true }
      }
    }
  },
  roles: { select: { role: { select: { name: true } } } }
} as const;

type MembershipRow = {
  workspace: {
    id: string;
    name: string;
    slug: string;
    archivedAt: Date | null;
    _count: { members: number };
    members: { userId: string }[];
  };
  roles: { role: { name: string } }[];
};

function toAdminUserWorkspace(userId: string, membership: MembershipRow): AdminUserWorkspace {
  const roles = membership.roles.map(({ role }) => role.name).sort();
  const owner = roles.includes(OWNER_ROLE_NAME);
  const otherOwnerCount = membership.workspace.members.filter((member) => member.userId !== userId).length;

  return {
    id: membership.workspace.id,
    name: membership.workspace.name,
    slug: membership.workspace.slug,
    roles,
    owner,
    solelyOwned: isSolelyOwnedWorkspace({ userIsOwner: owner, otherOwnerCount }),
    memberCount: membership.workspace._count.members,
    archived: membership.workspace.archivedAt !== null
  };
}

async function loadUsers(where: { id?: string }): Promise<AdminUser[]> {
  const users = await prisma.user.findMany({
    where,
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: {
      id: true,
      email: true,
      name: true,
      createdAt: true,
      memberships: { select: membershipSelect, orderBy: { createdAt: "asc" } }
    }
  });

  const isAdmin = await getInstanceAdminChecker();

  return users.map((user) => ({
    id: user.id,
    email: user.email,
    name: user.name,
    createdAt: user.createdAt,
    instanceAdmin: isAdmin(user.id),
    workspaces: user.memberships.map((membership) => toAdminUserWorkspace(user.id, membership))
  }));
}

/** Every account, oldest first, with what it owns. */
export function listAdminUsers(): Promise<AdminUser[]> {
  return loadUsers({});
}

/** One account; throws `user-not-found`. */
export async function getAdminUser(userId: string): Promise<AdminUser> {
  const [user] = await loadUsers({ id: userId });

  if (!user) {
    throw new Error("user-not-found");
  }

  return user;
}

export type AdminDeletionResult = {
  /** The workspaces deleted, with everything in them. */
  deletedWorkspaces: { id: string; name: string; slug: string }[];
  /** Whether the account itself was deleted. */
  userDeleted: boolean;
};

/** Generous: a demo workspace has a few thousand rows, and the deletion runs in one transaction. */
const DELETION_TIMEOUT_MS = 120_000;

async function guardDeletion(actingUserId: string, userId: string): Promise<AdminUser> {
  if (actingUserId === userId) {
    throw new Error("cannot-delete-self");
  }

  const user = await getAdminUser(userId);

  if (user.instanceAdmin) {
    throw new Error("cannot-delete-instance-admin");
  }

  return user;
}

/**
 * Deletes a user's data entirely (#324): every workspace the user solely owns, and everything in
 * it, at once — not restorable. Co-owned workspaces stay with their other owners, and the account
 * stays. Throws `cannot-delete-self`, `cannot-delete-instance-admin` or `user-not-found`.
 */
export async function deleteAdminUserData(actingUserId: string, userId: string): Promise<AdminDeletionResult> {
  const user = await guardDeletion(actingUserId, userId);
  const doomed = user.workspaces.filter((workspace) => workspace.solelyOwned);

  await prisma.$transaction(
    async (tx) => {
      for (const workspace of doomed) {
        await deleteWorkspaceRows(tx, workspace.id);
      }
    },
    { timeout: DELETION_TIMEOUT_MS }
  );

  logDeletion("admin-user-data-deleted", actingUserId, userId, doomed);

  return { deletedWorkspaces: doomed.map(({ id, name, slug }) => ({ id, name, slug })), userDeleted: false };
}

/**
 * Deletes a user (#324), at once — not restorable: the account, its sessions, API tokens, connected
 * apps and memberships. Workspaces the user was the only member of are deleted with it (nobody could
 * reach them any more); with `deleteData`, so is every workspace the user solely owns. Records the
 * user created in shared workspaces stay, without their creator. Throws `cannot-delete-self`,
 * `cannot-delete-instance-admin` or `user-not-found`.
 */
export async function deleteAdminUser(
  actingUserId: string,
  userId: string,
  { deleteData }: { deleteData: boolean }
): Promise<AdminDeletionResult> {
  const user = await guardDeletion(actingUserId, userId);
  const doomed = user.workspaces.filter(
    (workspace) => workspace.memberCount === 1 || (deleteData && workspace.solelyOwned)
  );

  await prisma.$transaction(
    async (tx) => {
      for (const workspace of doomed) {
        await deleteWorkspaceRows(tx, workspace.id);
      }

      await tx.user.delete({ where: { id: userId } });
    },
    { timeout: DELETION_TIMEOUT_MS }
  );

  logDeletion("admin-user-deleted", actingUserId, userId, doomed);

  return { deletedWorkspaces: doomed.map(({ id, name, slug }) => ({ id, name, slug })), userDeleted: true };
}

function logDeletion(
  event: string,
  actingUserId: string,
  userId: string,
  workspaces: readonly { id: string }[]
) {
  console.log(
    JSON.stringify({ event, actingUserId, userId, workspaceIds: workspaces.map(({ id }) => id) })
  );
}
