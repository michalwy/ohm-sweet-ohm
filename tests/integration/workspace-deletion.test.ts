import assert from "node:assert/strict";
import { describe, test, before, after } from "node:test";
import { randomBytes } from "node:crypto";

import { PgBoss } from "pg-boss";

import { prisma } from "../../src/server/db/prisma";
import { archiveWorkspace } from "../../src/server/workspaces/archiveMutations";
import { enqueueWorkspaceDeletion } from "../../src/server/workspaces/deletionQueue";
import { executeWorkspaceDeletion } from "../../src/server/workspaces/deletionMutations";
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
  // Queue creation is idempotent; ensure it exists for all tests
  await boss.createQueue("workspace-deletion");
});

after(async () => {
  await boss.stop();
  await prisma.$disconnect();
});

function uniqueSuffix() {
  return randomBytes(4).toString("hex");
}

async function createArchivedWorkspace(suffix: string) {
  await ensurePermissions();

  const { workspaceId } = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        email: `deletion-test-${suffix}@ohmsweetohm.local`,
        emailVerified: true,
        name: "Deletion Test Owner"
      }
    });

    const workspace = await tx.workspace.create({
      data: {
        name: `Deletion Test Workspace ${suffix}`,
        slug: `deletion-test-${suffix}`
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

  await archiveWorkspace(workspaceId);
  return workspaceId;
}

describe("enqueueWorkspaceDeletion", () => {
  test("sets deletionScheduledAt and returns without error", async () => {
    const workspaceId = await createArchivedWorkspace(uniqueSuffix());

    const before = await prisma.workspace.findUniqueOrThrow({
      where: { id: workspaceId },
      select: { deletionScheduledAt: true }
    });
    assert.equal(before.deletionScheduledAt, null);

    await enqueueWorkspaceDeletion(workspaceId, "manual", boss);

    const after = await prisma.workspace.findUniqueOrThrow({
      where: { id: workspaceId },
      select: { deletionScheduledAt: true }
    });
    assert.ok(after.deletionScheduledAt instanceof Date, "deletionScheduledAt should be set");
  });

  test("is idempotent when called twice", async () => {
    const workspaceId = await createArchivedWorkspace(uniqueSuffix());

    await enqueueWorkspaceDeletion(workspaceId, "manual", boss);
    const first = await prisma.workspace.findUniqueOrThrow({
      where: { id: workspaceId },
      select: { deletionScheduledAt: true }
    });

    await enqueueWorkspaceDeletion(workspaceId, "manual", boss);
    const second = await prisma.workspace.findUniqueOrThrow({
      where: { id: workspaceId },
      select: { deletionScheduledAt: true }
    });

    assert.deepEqual(first.deletionScheduledAt, second.deletionScheduledAt, "timestamp should not change on second call");
  });

  test("throws when workspace is not archived", async () => {
    await ensurePermissions();

    const workspace = await prisma.workspace.create({
      data: {
        name: `Active Workspace ${uniqueSuffix()}`,
        slug: `active-ws-${uniqueSuffix()}`
      }
    });

    await assert.rejects(
      () => enqueueWorkspaceDeletion(workspace.id, "manual", boss),
      /must be archived/
    );
  });
});

describe("executeWorkspaceDeletion", () => {
  test("deletes the workspace and all cascade data", async () => {
    const workspaceId = await createArchivedWorkspace(uniqueSuffix());
    await enqueueWorkspaceDeletion(workspaceId, "manual", boss);

    const before = await prisma.workspace.findUnique({ where: { id: workspaceId } });
    assert.ok(before !== null, "workspace should exist before deletion");

    await executeWorkspaceDeletion(workspaceId, "manual");

    const after = await prisma.workspace.findUnique({ where: { id: workspaceId } });
    assert.equal(after, null, "workspace should be gone after deletion");
  });

  test("is idempotent when workspace is already deleted", async () => {
    const workspaceId = await createArchivedWorkspace(uniqueSuffix());
    await enqueueWorkspaceDeletion(workspaceId, "manual", boss);
    await executeWorkspaceDeletion(workspaceId, "manual");

    // should not throw when called again on a deleted workspace
    await assert.doesNotReject(() => executeWorkspaceDeletion(workspaceId, "manual"));
  });

  test("is a no-op when deletionScheduledAt is null", async () => {
    const workspaceId = await createArchivedWorkspace(uniqueSuffix());

    const before = await prisma.workspace.findUniqueOrThrow({ where: { id: workspaceId } });
    assert.equal(before.deletionScheduledAt, null);

    await executeWorkspaceDeletion(workspaceId, "manual");

    const after = await prisma.workspace.findUnique({ where: { id: workspaceId } });
    assert.ok(after !== null, "workspace should still exist when deletionScheduledAt was null");
  });
});
