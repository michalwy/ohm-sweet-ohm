import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { randomBytes } from "node:crypto";

import { prisma } from "../../src/server/db/prisma";
import {
  archiveWorkspace,
  restoreWorkspace
} from "../../src/server/workspaces/archiveMutations";
import {
  OWNER_ROLE_NAME,
  defaultWorkspaceRoles
} from "../../src/server/access-control/permissions";
import { ensurePermissions } from "../../src/server/workspaces/createWorkspace";
import { hasWorkspacePermission } from "../../src/server/access-control/authorize";

function uniqueSuffix() {
  return randomBytes(4).toString("hex");
}

async function createWorkspaceWithOwner(suffix: string) {
  await ensurePermissions();

  return prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        email: `archive-test-owner-${suffix}@ohmsweetohm.local`,
        emailVerified: true,
        name: "Archive Test Owner"
      }
    });

    const workspace = await tx.workspace.create({
      data: {
        name: `Archive Test Workspace ${suffix}`,
        slug: `archive-test-${suffix}`
      }
    });

    let ownerRoleId: string | null = null;

    for (const role of defaultWorkspaceRoles) {
      const created = await tx.role.create({
        data: {
          workspaceId: workspace.id,
          name: role.name,
          isSystem: true,
          permissions: {
            create: role.permissions.map((permissionKey) => ({
              permissionKey
            }))
          }
        }
      });

      if (role.name === OWNER_ROLE_NAME) {
        ownerRoleId = created.id;
      }
    }

    if (!ownerRoleId) {
      throw new Error("Owner role was not created");
    }

    const member = await tx.workspaceMember.create({
      data: {
        userId: user.id,
        workspaceId: workspace.id
      },
      select: { id: true }
    });

    await tx.workspaceMemberRole.create({
      data: {
        workspaceMemberId: member.id,
        roleId: ownerRoleId
      }
    });

    return { user, workspace, userId: user.id, workspaceId: workspace.id };
  });
}

async function createNonAdminMember(workspaceId: string, suffix: string) {
  const user = await prisma.user.create({
    data: {
      email: `archive-test-member-${suffix}@ohmsweetohm.local`,
      emailVerified: true,
      name: "Archive Test Member"
    }
  });

  const readerRole = await prisma.role.findFirstOrThrow({
    where: { workspaceId, name: "reader" },
    select: { id: true }
  });

  const member = await prisma.workspaceMember.create({
    data: {
      userId: user.id,
      workspaceId
    },
    select: { id: true }
  });

  await prisma.workspaceMemberRole.create({
    data: {
      workspaceMemberId: member.id,
      roleId: readerRole.id
    }
  });

  return { user, userId: user.id };
}

describe("workspace archiving", () => {
  test("archiveWorkspace sets archivedAt to a non-null timestamp", async () => {
    const suffix = uniqueSuffix();
    const { workspaceId } = await createWorkspaceWithOwner(suffix);

    const before = await prisma.workspace.findUniqueOrThrow({
      where: { id: workspaceId },
      select: { archivedAt: true }
    });
    assert.equal(before.archivedAt, null);

    await archiveWorkspace(workspaceId);

    const after = await prisma.workspace.findUniqueOrThrow({
      where: { id: workspaceId },
      select: { archivedAt: true }
    });
    assert.ok(after.archivedAt instanceof Date, "archivedAt should be a Date");
  });

  test("restoreWorkspace sets archivedAt back to null", async () => {
    const suffix = uniqueSuffix();
    const { workspaceId } = await createWorkspaceWithOwner(suffix);

    await archiveWorkspace(workspaceId);

    const archived = await prisma.workspace.findUniqueOrThrow({
      where: { id: workspaceId },
      select: { archivedAt: true }
    });
    assert.ok(archived.archivedAt !== null, "should be archived");

    await restoreWorkspace(workspaceId);

    const restored = await prisma.workspace.findUniqueOrThrow({
      where: { id: workspaceId },
      select: { archivedAt: true }
    });
    assert.equal(restored.archivedAt, null);
  });

  test("archived workspace is excluded from active workspace query", async () => {
    const suffix = uniqueSuffix();
    const { userId, workspaceId } = await createWorkspaceWithOwner(suffix);

    await archiveWorkspace(workspaceId);

    const activeMemberships = await prisma.workspaceMember.findMany({
      where: {
        userId,
        workspace: { archivedAt: null }
      },
      select: { workspace: { select: { id: true } } }
    });

    const activeIds = activeMemberships.map((m) => m.workspace.id);
    assert.ok(!activeIds.includes(workspaceId), "archived workspace should not appear in active list");
  });

  test("archived workspace appears in archived workspace query", async () => {
    const suffix = uniqueSuffix();
    const { userId, workspaceId } = await createWorkspaceWithOwner(suffix);

    await archiveWorkspace(workspaceId);

    const archivedMemberships = await prisma.workspaceMember.findMany({
      where: {
        userId,
        workspace: { archivedAt: { not: null } }
      },
      select: { workspace: { select: { id: true, archivedAt: true } } }
    });

    const archivedIds = archivedMemberships.map((m) => m.workspace.id);
    assert.ok(archivedIds.includes(workspaceId), "archived workspace should appear in archived list");

    const match = archivedMemberships.find((m) => m.workspace.id === workspaceId);
    assert.ok(match?.workspace.archivedAt instanceof Date, "archivedAt should be a Date");
  });

  test("owner has admin permission before and after archive/restore", async () => {
    const suffix = uniqueSuffix();
    const { userId, workspaceId } = await createWorkspaceWithOwner(suffix);

    const canBefore = await hasWorkspacePermission({ userId, workspaceId, permission: "admin" });
    assert.equal(canBefore, true);

    await archiveWorkspace(workspaceId);

    const canAfterArchive = await hasWorkspacePermission({ userId, workspaceId, permission: "admin" });
    assert.equal(canAfterArchive, true, "owner should still have admin permission on archived workspace");

    await restoreWorkspace(workspaceId);

    const canAfterRestore = await hasWorkspacePermission({ userId, workspaceId, permission: "admin" });
    assert.equal(canAfterRestore, true);
  });

  test("non-admin member does not have admin permission", async () => {
    const suffix = uniqueSuffix();
    const { workspaceId } = await createWorkspaceWithOwner(suffix);
    const { userId: memberUserId } = await createNonAdminMember(workspaceId, suffix);

    const canArchive = await hasWorkspacePermission({
      userId: memberUserId,
      workspaceId,
      permission: "admin"
    });

    assert.equal(canArchive, false, "non-admin member should not have admin permission");
  });
});
