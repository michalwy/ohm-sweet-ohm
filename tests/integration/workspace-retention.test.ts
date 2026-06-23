import assert from "node:assert/strict";
import { describe, test, before, after, beforeEach, afterEach } from "node:test";
import { randomBytes } from "node:crypto";

import { PgBoss } from "pg-boss";

import { prisma } from "../../src/server/db/prisma";
import { archiveWorkspace } from "../../src/server/workspaces/archiveMutations";
import { enqueueExpiredArchivedWorkspaces } from "../../src/server/workspaces/retentionSweep";
import {
  OWNER_ROLE_NAME,
  defaultWorkspaceRoles
} from "../../src/server/access-control/permissions";
import { ensurePermissions } from "../../src/server/workspaces/createWorkspace";

const connectionString =
  process.env.DATABASE_URL ??
  "postgresql://oso:oso_e2e_password@localhost:5433/ohm_sweet_ohm_e2e?schema=public";

let boss: PgBoss;

before(async () => {
  boss = new PgBoss(connectionString);
  await boss.start();
  await boss.createQueue("workspace-deletion");
});

after(async () => {
  await boss.stop();
  await prisma.$disconnect();
});

function uniqueSuffix() {
  return randomBytes(4).toString("hex");
}

async function createWorkspaceWithOwner(suffix: string): Promise<string> {
  await ensurePermissions();

  const { workspaceId } = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        email: `retention-test-${suffix}@ohmsweetohm.local`,
        emailVerified: true,
        name: "Retention Test Owner"
      }
    });

    const workspace = await tx.workspace.create({
      data: {
        name: `Retention Test Workspace ${suffix}`,
        slug: `retention-test-${suffix}`
      }
    });

    for (const role of defaultWorkspaceRoles) {
      const created = await tx.role.create({
        data: {
          workspaceId: workspace.id,
          name: role.name,
          isSystem: true,
          permissions: {
            create: role.permissions.map((permissionKey) => ({ permissionKey }))
          }
        }
      });

      if (role.name === OWNER_ROLE_NAME) {
        const member = await tx.workspaceMember.create({
          data: { userId: user.id, workspaceId: workspace.id },
          select: { id: true }
        });
        await tx.workspaceMemberRole.create({
          data: { workspaceMemberId: member.id, roleId: created.id }
        });
      }
    }

    return { workspaceId: workspace.id };
  });

  return workspaceId;
}

async function setArchivedAt(workspaceId: string, archivedAt: Date) {
  await prisma.workspace.update({
    where: { id: workspaceId },
    data: { archivedAt }
  });
}

const originalRetentionDays = process.env.WORKSPACE_RETENTION_DAYS;

describe("enqueueExpiredArchivedWorkspaces", () => {
  beforeEach(() => {
    process.env.WORKSPACE_RETENTION_DAYS = "30";
  });

  afterEach(() => {
    if (originalRetentionDays === undefined) {
      delete process.env.WORKSPACE_RETENTION_DAYS;
    } else {
      process.env.WORKSPACE_RETENTION_DAYS = originalRetentionDays;
    }
  });

  test("enqueues a workspace archived beyond the retention window", async () => {
    const workspaceId = await createWorkspaceWithOwner(uniqueSuffix());
    await archiveWorkspace(workspaceId);

    const pastCutoff = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000);
    await setArchivedAt(workspaceId, pastCutoff);

    const count = await enqueueExpiredArchivedWorkspaces(boss);

    assert.ok(count >= 1, "at least one workspace should have been enqueued");

    const workspace = await prisma.workspace.findUniqueOrThrow({
      where: { id: workspaceId },
      select: { deletionScheduledAt: true }
    });
    assert.ok(
      workspace.deletionScheduledAt instanceof Date,
      "deletionScheduledAt should be set for expired archived workspace"
    );
  });

  test("does not enqueue a workspace archived within the retention window", async () => {
    const workspaceId = await createWorkspaceWithOwner(uniqueSuffix());
    await archiveWorkspace(workspaceId);

    const recentArchive = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
    await setArchivedAt(workspaceId, recentArchive);

    await enqueueExpiredArchivedWorkspaces(boss);

    const workspace = await prisma.workspace.findUniqueOrThrow({
      where: { id: workspaceId },
      select: { deletionScheduledAt: true }
    });
    assert.equal(
      workspace.deletionScheduledAt,
      null,
      "deletionScheduledAt should remain null for recently archived workspace"
    );
  });

  test("does not re-enqueue a workspace already scheduled for deletion", async () => {
    const workspaceId = await createWorkspaceWithOwner(uniqueSuffix());
    await archiveWorkspace(workspaceId);

    const pastCutoff = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000);
    await setArchivedAt(workspaceId, pastCutoff);

    await enqueueExpiredArchivedWorkspaces(boss);

    const first = await prisma.workspace.findUniqueOrThrow({
      where: { id: workspaceId },
      select: { deletionScheduledAt: true }
    });

    await enqueueExpiredArchivedWorkspaces(boss);

    const second = await prisma.workspace.findUniqueOrThrow({
      where: { id: workspaceId },
      select: { deletionScheduledAt: true }
    });

    assert.deepEqual(
      first.deletionScheduledAt,
      second.deletionScheduledAt,
      "deletionScheduledAt should not change on a second sweep"
    );
  });

  test("does not enqueue a non-archived workspace", async () => {
    const workspaceId = await createWorkspaceWithOwner(uniqueSuffix());

    const before = await prisma.workspace.findUniqueOrThrow({
      where: { id: workspaceId },
      select: { archivedAt: true, deletionScheduledAt: true }
    });
    assert.equal(before.archivedAt, null, "workspace should not be archived");

    await enqueueExpiredArchivedWorkspaces(boss);

    const after = await prisma.workspace.findUniqueOrThrow({
      where: { id: workspaceId },
      select: { deletionScheduledAt: true }
    });
    assert.equal(
      after.deletionScheduledAt,
      null,
      "non-archived workspace should never be enqueued"
    );
  });
});
