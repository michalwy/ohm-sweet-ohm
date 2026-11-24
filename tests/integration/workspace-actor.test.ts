import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { randomBytes } from "node:crypto";

import { prisma } from "../../src/server/db/prisma";
import {
  actorHasPermission,
  requireActorPermission,
  resolveMemberActor,
  resolveTokenActor
} from "../../src/server/access-control/actor";
import { hasWorkspacePermission } from "../../src/server/access-control/authorize";
import { defaultWorkspaceRoles } from "../../src/server/access-control/permissions";
import { ensurePermissions } from "../../src/server/workspaces/createWorkspace";
import { archiveWorkspace } from "../../src/server/workspaces/archiveMutations";

function uniqueSuffix() {
  return randomBytes(4).toString("hex");
}

async function createUser(label: string, suffix: string) {
  return prisma.user.create({
    data: {
      email: `actor-test-${label}-${suffix}@ohmsweetohm.local`,
      emailVerified: true,
      name: `Actor Test ${label}`
    }
  });
}

async function addMember(workspaceId: string, userId: string, roleName: string) {
  const role = await prisma.role.findFirstOrThrow({
    where: { workspaceId, name: roleName },
    select: { id: true }
  });

  await prisma.workspaceMember.create({
    data: {
      userId,
      workspaceId,
      roles: { create: { roleId: role.id } }
    }
  });
}

async function createWorkspace(suffix: string) {
  await ensurePermissions();

  const workspace = await prisma.workspace.create({
    data: { name: `Actor Test Workspace ${suffix}`, slug: `actor-test-${suffix}` }
  });

  for (const role of defaultWorkspaceRoles) {
    await prisma.role.create({
      data: {
        workspaceId: workspace.id,
        name: role.name,
        isSystem: true,
        permissions: {
          create: role.permissions.map((permissionKey) => ({ permissionKey }))
        }
      }
    });
  }

  const owner = await createUser("owner", suffix);
  await addMember(workspace.id, owner.id, "owner");

  return { workspace, owner };
}

describe("workspace actor", () => {
  test("a session member resolves by slug with the permissions of their roles, as before", async () => {
    const suffix = uniqueSuffix();
    const { workspace, owner } = await createWorkspace(suffix);
    const reader = await createUser("reader", suffix);
    await addMember(workspace.id, reader.id, "reader");

    const ownerActor = await resolveMemberActor({
      userId: owner.id,
      workspace: { slug: workspace.slug }
    });

    assert.ok(ownerActor);
    assert.equal(ownerActor.source, "session");
    assert.equal(ownerActor.user.id, owner.id);
    assert.equal(ownerActor.workspace.id, workspace.id);
    assert.equal(actorHasPermission(ownerActor, "admin"), true);
    assert.equal(actorHasPermission(ownerActor, "builds:write"), true);

    const readerActor = await resolveMemberActor({
      userId: reader.id,
      workspace: { slug: workspace.slug }
    });

    assert.ok(readerActor);
    assert.equal(actorHasPermission(readerActor, "parts:read"), true);
    assert.equal(actorHasPermission(readerActor, "parts:write"), false);
    assert.equal(actorHasPermission(readerActor, "admin"), false);
    assert.throws(
      () => requireActorPermission(readerActor, "parts:write"),
      /workspace-permission-denied/
    );

    for (const permission of ["parts:read", "parts:write", "admin"] as const) {
      assert.equal(
        actorHasPermission(readerActor, permission),
        await hasWorkspacePermission({ userId: reader.id, workspaceId: workspace.id, permission }),
        `the actor and the role-only check agree on ${permission}`
      );
    }
  });

  test("a non-member is denied", async () => {
    const suffix = uniqueSuffix();
    const { workspace } = await createWorkspace(suffix);
    const outsider = await createUser("outsider", suffix);

    assert.equal(
      await resolveMemberActor({ userId: outsider.id, workspace: { slug: workspace.slug } }),
      null
    );
    assert.equal(
      await resolveMemberActor({ userId: outsider.id, workspace: { id: workspace.id } }),
      null
    );
    assert.equal(
      await hasWorkspacePermission({
        userId: outsider.id,
        workspaceId: workspace.id,
        permission: "parts:read"
      }),
      false
    );
  });

  test("a member of another workspace is denied by slug", async () => {
    const first = await createWorkspace(uniqueSuffix());
    const second = await createWorkspace(uniqueSuffix());

    assert.equal(
      await resolveMemberActor({
        userId: first.owner.id,
        workspace: { slug: second.workspace.slug }
      }),
      null
    );
  });

  test("an archived workspace is denied unless the caller manages its lifecycle", async () => {
    const suffix = uniqueSuffix();
    const { workspace, owner } = await createWorkspace(suffix);
    await archiveWorkspace(workspace.id);

    assert.equal(
      await resolveMemberActor({ userId: owner.id, workspace: { slug: workspace.slug } }),
      null
    );

    const lifecycleActor = await resolveMemberActor(
      { userId: owner.id, workspace: { slug: workspace.slug } },
      { allowArchived: true }
    );

    assert.ok(lifecycleActor);
    assert.ok(lifecycleActor.workspace.archivedAt);
    assert.equal(actorHasPermission(lifecycleActor, "admin"), true);
  });

  test("token permissions are intersected with the user's roles", async () => {
    const suffix = uniqueSuffix();
    const { workspace } = await createWorkspace(suffix);
    const reader = await createUser("token-reader", suffix);
    await addMember(workspace.id, reader.id, "reader");

    const actor = await resolveMemberActor({
      userId: reader.id,
      workspace: { id: workspace.id },
      tokenPermissions: ["parts:read", "parts:write", "builds:write"]
    });

    assert.ok(actor);
    assert.equal(actor.source, "token");
    assert.deepEqual([...actor.permissions], ["parts:read"]);

    const adminToken = await resolveMemberActor({
      userId: reader.id,
      workspace: { id: workspace.id },
      tokenPermissions: ["admin"]
    });

    assert.ok(adminToken);
    assert.equal(actorHasPermission(adminToken, "admin"), false, "a token cannot lift a reader to admin");
    assert.equal(actorHasPermission(adminToken, "parts:read"), true);
    assert.equal(actorHasPermission(adminToken, "parts:write"), false);
  });

  test("an unknown API token resolves to no actor", async () => {
    assert.equal(await resolveTokenActor("oso_anything"), null);
  });
});
