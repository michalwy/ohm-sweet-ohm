import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { randomBytes } from "node:crypto";

import { prisma } from "../../src/server/db/prisma";
import {
  actorHasPermission,
  resolveTokenActor
} from "../../src/server/access-control/actor";
import { defaultWorkspaceRoles } from "../../src/server/access-control/permissions";
import {
  ApiTokenDomainError,
  createApiToken,
  listApiTokensForUser,
  revokeApiToken,
  verifyApiToken
} from "../../src/server/api-tokens/apiTokens";
import { hashApiTokenValue } from "../../src/server/api-tokens/apiTokenValue";
import { ensurePermissions } from "../../src/server/workspaces/createWorkspace";
import { archiveWorkspace } from "../../src/server/workspaces/archiveMutations";

function uniqueSuffix() {
  return randomBytes(4).toString("hex");
}

async function createUser(label: string, suffix: string) {
  return prisma.user.create({
    data: {
      email: `api-token-test-${label}-${suffix}@ohmsweetohm.local`,
      emailVerified: true,
      name: `API Token Test ${label}`
    }
  });
}

async function addMember(workspaceId: string, userId: string, roleName: string) {
  const role = await prisma.role.findFirstOrThrow({
    where: { workspaceId, name: roleName },
    select: { id: true }
  });

  return prisma.workspaceMember.create({
    data: { userId, workspaceId, roles: { create: { roleId: role.id } } }
  });
}

async function createWorkspace(suffix: string) {
  await ensurePermissions();

  const workspace = await prisma.workspace.create({
    data: { name: `API Token Workspace ${suffix}`, slug: `api-token-test-${suffix}` }
  });

  for (const role of defaultWorkspaceRoles) {
    await prisma.role.create({
      data: {
        workspaceId: workspace.id,
        name: role.name,
        isSystem: true,
        permissions: { create: role.permissions.map((permissionKey) => ({ permissionKey })) }
      }
    });
  }

  const owner = await createUser("owner", suffix);
  await addMember(workspace.id, owner.id, "owner");

  return { workspace, owner };
}

async function assertDomainError(promise: Promise<unknown>, code: string) {
  await assert.rejects(promise, (error: unknown) => {
    assert.ok(error instanceof ApiTokenDomainError, String(error));
    assert.equal(error.code, code);
    return true;
  });
}

describe("personal API tokens", () => {
  test("creation returns the value once and stores only its hash", async () => {
    const { workspace, owner } = await createWorkspace(uniqueSuffix());

    const { token, value } = await createApiToken(owner.id, {
      workspaceId: workspace.id,
      name: "  Claude  ",
      access: "read-only"
    });

    assert.match(value, /^oso_[A-Za-z0-9_-]{43}$/);
    assert.equal(token.name, "Claude");
    assert.equal(token.workspace.id, workspace.id);
    assert.equal(token.status, "active");

    const stored = await prisma.apiToken.findUniqueOrThrow({ where: { id: token.id } });

    assert.equal(stored.tokenHash, hashApiTokenValue(value));
    assert.ok(!JSON.stringify(stored).includes(value), "the value is not stored");

    const listed = await listApiTokensForUser(owner.id);

    assert.equal(listed.length, 1);
    assert.ok(!JSON.stringify(listed).includes(value), "listing never returns the value");
    assert.ok(!("tokenHash" in listed[0]!), "listing never returns the hash");
  });

  test("a valid token verifies and resolves to its user in its workspace", async () => {
    const { workspace, owner } = await createWorkspace(uniqueSuffix());
    const { token, value } = await createApiToken(owner.id, {
      workspaceId: workspace.id,
      name: "script",
      access: "read-write"
    });

    const verified = await verifyApiToken(value);

    assert.ok(verified);
    assert.equal(verified.tokenId, token.id);
    assert.equal(verified.userId, owner.id);
    assert.equal(verified.workspaceId, workspace.id);

    const actor = await resolveTokenActor(value);

    assert.ok(actor);
    assert.equal(actor.source, "token");
    assert.equal(actor.user.id, owner.id);
    assert.equal(actor.workspace.id, workspace.id);
    assert.equal(actorHasPermission(actor, "parts:write"), true);
    assert.equal(actorHasPermission(actor, "admin"), false, "a token never carries admin");

    const used = await prisma.apiToken.findUniqueOrThrow({ where: { id: token.id } });
    assert.ok(used.lastUsedAt, "the last-used time is recorded");
  });

  test("unknown and malformed tokens are rejected", async () => {
    assert.equal(await resolveTokenActor("oso_anything"), null);
    assert.equal(await resolveTokenActor(""), null);
    assert.equal(await resolveTokenActor(`oso_${"A".repeat(43)}`), null);
  });

  test("permissions are the token's set intersected with the user's roles", async () => {
    const suffix = uniqueSuffix();
    const { workspace } = await createWorkspace(suffix);
    const reader = await createUser("reader", suffix);
    const membership = await addMember(workspace.id, reader.id, "reader");

    const custom = await createApiToken(reader.id, {
      workspaceId: workspace.id,
      name: "custom",
      access: "custom",
      permissions: ["parts:read", "parts:write", "units:read"]
    });
    const readWrite = await createApiToken(reader.id, {
      workspaceId: workspace.id,
      name: "read-write",
      access: "read-write"
    });

    const customActor = await resolveTokenActor(custom.value);
    assert.ok(customActor);
    assert.deepEqual([...customActor.permissions].sort(), ["parts:read", "units:read"]);

    const readWriteActor = await resolveTokenActor(readWrite.value);
    assert.ok(readWriteActor);
    assert.equal(actorHasPermission(readWriteActor, "parts:read"), true);
    assert.equal(actorHasPermission(readWriteActor, "parts:write"), false, "a reader's token cannot write");

    // Granting the user the editor role widens the token up to its own set, on the next request.
    const editor = await prisma.role.findFirstOrThrow({
      where: { workspaceId: workspace.id, name: "editor" }
    });
    await prisma.workspaceMemberRole.create({
      data: { workspaceMemberId: membership.id, roleId: editor.id }
    });

    const widened = await resolveTokenActor(custom.value);
    assert.ok(widened);
    assert.deepEqual([...widened.permissions].sort(), ["parts:read", "parts:write", "units:read"]);
    assert.equal(actorHasPermission(widened, "builds:write"), false, "never beyond the token's set");
  });

  test("a read-only token cannot write even for the workspace owner", async () => {
    const { workspace, owner } = await createWorkspace(uniqueSuffix());
    const { value } = await createApiToken(owner.id, {
      workspaceId: workspace.id,
      name: "reader",
      access: "read-only"
    });

    const actor = await resolveTokenActor(value);

    assert.ok(actor);
    assert.equal(actorHasPermission(actor, "parts:read"), true);
    assert.equal(actorHasPermission(actor, "parts:write"), false);
  });

  test("a revoked token is rejected, and only its owner can revoke it", async () => {
    const suffix = uniqueSuffix();
    const { workspace, owner } = await createWorkspace(suffix);
    const other = await createUser("other", suffix);
    const { token, value } = await createApiToken(owner.id, {
      workspaceId: workspace.id,
      name: "to revoke",
      access: "read-only"
    });

    await assertDomainError(revokeApiToken(other.id, token.id), "api-token-not-found");
    assert.ok(await resolveTokenActor(value), "another user's revoke attempt changes nothing");

    await revokeApiToken(owner.id, token.id);

    assert.equal(await verifyApiToken(value), null);
    assert.equal(await resolveTokenActor(value), null);
    assert.deepEqual(await listApiTokensForUser(owner.id), []);
    await assertDomainError(revokeApiToken(owner.id, token.id), "api-token-not-found");
  });

  test("an expired token is rejected", async () => {
    const { workspace, owner } = await createWorkspace(uniqueSuffix());
    const now = new Date();
    const { token, value } = await createApiToken(
      owner.id,
      {
        workspaceId: workspace.id,
        name: "short-lived",
        access: "read-only",
        expiresAt: new Date(now.getTime() + 60_000).toISOString()
      },
      now
    );

    assert.ok(await verifyApiToken(value, now));
    assert.equal(await verifyApiToken(value, new Date(now.getTime() + 60_000)), null);

    await prisma.apiToken.update({
      where: { id: token.id },
      data: { expiresAt: new Date(Date.now() - 1000) }
    });

    assert.equal(await resolveTokenActor(value), null);
    assert.equal((await listApiTokensForUser(owner.id))[0]?.status, "expired");

    await assertDomainError(
      createApiToken(owner.id, {
        workspaceId: workspace.id,
        name: "past",
        access: "read-only",
        expiresAt: new Date(Date.now() - 1000).toISOString()
      }),
      "api-token-expiry-in-past"
    );
  });

  test("a token for an archived workspace is rejected, even for lifecycle callers", async () => {
    const { workspace, owner } = await createWorkspace(uniqueSuffix());
    const { value } = await createApiToken(owner.id, {
      workspaceId: workspace.id,
      name: "archived",
      access: "read-write"
    });

    await archiveWorkspace(workspace.id);

    assert.equal(await resolveTokenActor(value), null);
    assert.equal(await resolveTokenActor(value, { allowArchived: true }), null);
    assert.equal((await listApiTokensForUser(owner.id))[0]?.status, "workspace-archived");
    await assertDomainError(
      createApiToken(owner.id, { workspaceId: workspace.id, name: "new", access: "read-only" }),
      "workspace-not-found"
    );
  });

  test("a token of a user who has left the workspace is rejected", async () => {
    const suffix = uniqueSuffix();
    const { workspace } = await createWorkspace(suffix);
    const editor = await createUser("editor", suffix);
    const membership = await addMember(workspace.id, editor.id, "editor");
    const { value } = await createApiToken(editor.id, {
      workspaceId: workspace.id,
      name: "leaver",
      access: "read-write"
    });

    assert.ok(await resolveTokenActor(value));

    await prisma.workspaceMember.delete({ where: { id: membership.id } });

    assert.equal(await resolveTokenActor(value), null);
    assert.equal((await listApiTokensForUser(editor.id))[0]?.status, "no-access");
  });

  test("a token acts only in its own workspace", async () => {
    const suffix = uniqueSuffix();
    const first = await createWorkspace(`${suffix}a`);
    const second = await createWorkspace(`${suffix}b`);
    await addMember(second.workspace.id, first.owner.id, "owner");

    const { value } = await createApiToken(first.owner.id, {
      workspaceId: first.workspace.id,
      name: "first only",
      access: "read-write"
    });

    const actor = await resolveTokenActor(value);

    assert.ok(actor);
    assert.equal(actor.workspace.id, first.workspace.id, "bound to its workspace, not another membership");

    const outsider = await createUser("outsider", suffix);
    await assertDomainError(
      createApiToken(outsider.id, {
        workspaceId: first.workspace.id,
        name: "not mine",
        access: "read-only"
      }),
      "workspace-not-found"
    );
  });

  test("creation validates its input", async () => {
    const { workspace, owner } = await createWorkspace(uniqueSuffix());
    const base = { workspaceId: workspace.id, name: "valid", access: "custom" as const };

    await assertDomainError(createApiToken(owner.id, { ...base, name: "   " }), "api-token-name-required");
    await assertDomainError(
      createApiToken(owner.id, { ...base, name: "x".repeat(101) }),
      "api-token-name-too-long"
    );
    await assertDomainError(
      createApiToken(owner.id, { ...base, permissions: [] }),
      "api-token-permissions-required"
    );
    await assertDomainError(
      createApiToken(owner.id, { ...base, permissions: ["admin"] }),
      "api-token-invalid-permission"
    );
    await assertDomainError(
      createApiToken(owner.id, { ...base, access: "everything" as "custom" }),
      "invalid-input"
    );
  });
});
