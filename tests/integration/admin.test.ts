import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

import { POST as mcpPost } from "../../src/app/api/mcp/route";
import { adminListUsersImplementation } from "../../src/server/admin/adminApi";
import { deleteUserAs, deleteUserDataAs, setRegistrationOpenAs } from "../../src/server/admin/adminActionCore";
import { getStorageUsage } from "../../src/server/admin/adminStorage";
import { getAdminUser } from "../../src/server/admin/adminUsers";
import { isInstanceAdmin } from "../../src/server/admin/instanceAdmin";
import { resolveTokenActor } from "../../src/server/access-control/actor";
import { executeOperation } from "../../src/server/api/execute";
import { prisma } from "../../src/server/db/prisma";
import { adminMcpTools } from "../../src/server/mcp/tools";
import { bearer, createApiTestWorkspace, createTestToken, uniqueSuffix } from "./apiFixtures";

/** The instance admin panel and the admin MCP tools (#324). */

const endpoint = new URL("http://localhost/api/mcp");
const adminToolNames = adminMcpTools.map((tool) => tool.implementation.operation.name);

async function connect(token: string) {
  const transport = new StreamableHTTPClientTransport(endpoint, {
    requestInit: { headers: bearer(token) },
    fetch: async (input, init) => mcpPost(new Request(input, init))
  });
  const client = new Client({ name: "oso-admin-test", version: "1.0.0" });

  await client.connect(transport);

  return client;
}

/** A fresh instance administrator with a workspace of their own. */
async function createAdmin() {
  const { workspace, owner } = await createApiTestWorkspace("admin");

  await prisma.user.update({ where: { id: owner.id }, data: { isInstanceAdmin: true } });

  return { workspace, admin: owner };
}

async function createUser(label: string) {
  return prisma.user.create({
    data: { email: `admin-${label}-${uniqueSuffix()}@ohmsweetohm.local`, name: label }
  });
}

async function addMember(workspaceId: string, userId: string, roleName: "owner" | "reader") {
  const role = await prisma.role.findFirstOrThrow({ where: { workspaceId, name: roleName } });

  await prisma.workspaceMember.create({
    data: { userId, workspaceId, roles: { create: { roleId: role.id } } }
  });
}

async function seedPart(workspaceId: string) {
  const suffix = uniqueSuffix();
  const unit = await prisma.unit.create({
    data: { workspaceId, name: `unit-${suffix}`, normalizedName: `unit-${suffix}`, symbol: "u", allowsFraction: true }
  });
  const maker = await prisma.organization.create({
    data: {
      workspaceId,
      name: `Maker ${suffix}`,
      normalizedName: `maker ${suffix}`,
      roles: { create: [{ role: "manufacturer" }] }
    }
  });

  return prisma.part.create({
    data: { workspaceId, unitId: unit.id, manufacturerId: maker.id, catalogNumber: `CAT-${suffix}` }
  });
}

async function workspaceExists(id: string) {
  return (await prisma.workspace.count({ where: { id } })) === 1;
}

describe("instance administrator (#324)", () => {
  test("a flagged account is an administrator and an ordinary account is not", async () => {
    const { admin } = await createAdmin();
    const { owner } = await createApiTestWorkspace("admin-plain");

    assert.equal(await isInstanceAdmin(admin.id), true);
    assert.equal(await isInstanceAdmin(owner.id), false);
  });

  test("a non-administrator gets no admin tools, and the implementations refuse them anyway", async () => {
    const { workspace, owner } = await createApiTestWorkspace("admin-mcp-denied");
    const { value } = await createTestToken(owner.id, workspace.id, { access: "read-write" });
    const client = await connect(value);
    const { tools } = await client.listTools();

    assert.deepEqual(
      tools.filter((tool) => tool.name.startsWith("admin_")).map((tool) => tool.name),
      []
    );
    await assert.rejects(client.callTool({ name: "admin_list_users", arguments: {} }));
    await client.close();

    const actor = await resolveTokenActor(value);
    assert.ok(actor);

    const result = await executeOperation(actor, adminListUsersImplementation, {});
    assert.equal(result.ok, false);
    assert.equal(!result.ok && result.error.code, "permission-denied");
  });

  test("a non-administrator's panel actions are refused and change nothing", async () => {
    const { owner } = await createApiTestWorkspace("admin-actions-denied");
    const victim = await createUser("victim");

    assert.deepEqual(await deleteUserAs(owner.id, victim.id, true), { ok: false, error: "not-instance-admin" });
    assert.deepEqual(await deleteUserDataAs(owner.id, victim.id), { ok: false, error: "not-instance-admin" });
    assert.deepEqual(await setRegistrationOpenAs(owner.id, true), { ok: false, error: "not-instance-admin" });
    assert.deepEqual(await deleteUserAs(null, victim.id, false), { ok: false, error: "not-instance-admin" });
    assert.equal(await prisma.user.count({ where: { id: victim.id } }), 1);
  });

  test("an administrator lists accounts with what they own over MCP; a read-only token cannot delete", async () => {
    const { workspace, admin } = await createAdmin();
    const target = await createApiTestWorkspace("admin-listed");
    await addMember(target.workspace.id, admin.id, "reader");

    const readWrite = await createTestToken(admin.id, workspace.id, { access: "read-write" });
    const client = await connect(readWrite.value);
    const { tools } = await client.listTools();

    assert.deepEqual(
      tools.filter((tool) => tool.name.startsWith("admin_")).map((tool) => tool.name),
      adminToolNames
    );

    const listed = await client.callTool({ name: "admin_list_users", arguments: {} });
    assert.ok(!listed.isError, JSON.stringify(listed));

    const users = (listed.structuredContent as { users: Array<{ id: string; instanceAdmin: boolean; workspaces: Array<{ id: string; roles: string[]; memberCount: number; owner: boolean; solelyOwned: boolean }> }> }).users;
    const owner = users.find((user) => user.id === target.owner.id);

    assert.ok(owner);
    assert.equal(owner.instanceAdmin, false);
    assert.deepEqual(owner.workspaces, [
      {
        id: target.workspace.id,
        name: target.workspace.name,
        slug: target.workspace.slug,
        roles: ["owner"],
        owner: true,
        solelyOwned: true,
        memberCount: 2,
        archived: false
      }
    ]);
    assert.equal(users.find((user) => user.id === admin.id)?.instanceAdmin, true);
    await client.close();

    const readOnly = await createTestToken(admin.id, workspace.id, { access: "read-only" });
    const readOnlyClient = await connect(readOnly.value);
    const refused = await readOnlyClient.callTool({
      name: "admin_delete_user",
      arguments: { userId: target.owner.id }
    });

    assert.equal(refused.isError, true);
    assert.match(JSON.stringify(refused.content), /permission-denied/);
    assert.equal(await prisma.user.count({ where: { id: target.owner.id } }), 1);
    await readOnlyClient.close();
  });

  test("deleting a user's data deletes the workspaces they solely own and keeps the rest", async () => {
    const { admin } = await createAdmin();
    const sole = await createApiTestWorkspace("admin-data-sole");
    await seedPart(sole.workspace.id);
    const shared = await createApiTestWorkspace("admin-data-shared");
    const coOwner = await createUser("co-owner");
    await addMember(shared.workspace.id, coOwner.id, "owner");
    // `sole.owner` also co-owns `shared`.
    await addMember(shared.workspace.id, sole.owner.id, "owner");

    const result = await deleteUserDataAs(admin.id, sole.owner.id);

    assert.ok(result.ok, JSON.stringify(result));
    assert.deepEqual(result.data.deletedWorkspaces.map(({ id }) => id), [sole.workspace.id]);
    assert.equal(result.data.userDeleted, false);
    assert.equal(await workspaceExists(sole.workspace.id), false);
    assert.equal(await prisma.part.count({ where: { workspaceId: sole.workspace.id } }), 0);
    assert.equal(await workspaceExists(shared.workspace.id), true);
    assert.equal(await prisma.user.count({ where: { id: sole.owner.id } }), 1);
  });

  test("deleting a user removes the account and the workspaces only they could reach", async () => {
    const { admin } = await createAdmin();
    const alone = await createApiTestWorkspace("admin-user-alone");
    await seedPart(alone.workspace.id);
    const withReader = await createApiTestWorkspace("admin-user-reader");
    const reader = await createUser("reader");
    await addMember(withReader.workspace.id, reader.id, "reader");
    await addMember(withReader.workspace.id, alone.owner.id, "owner");
    // Leave `alone.owner` its only owner, with a reader still using it.
    await prisma.workspaceMember.deleteMany({
      where: { workspaceId: withReader.workspace.id, userId: withReader.owner.id }
    });
    await prisma.session.create({
      data: { userId: alone.owner.id, token: `admin-test-${uniqueSuffix()}`, expiresAt: new Date(Date.now() + 60_000) }
    });

    const result = await deleteUserAs(admin.id, alone.owner.id, false);

    assert.ok(result.ok, JSON.stringify(result));
    assert.equal(result.data.userDeleted, true);
    assert.deepEqual(result.data.deletedWorkspaces.map(({ id }) => id), [alone.workspace.id]);
    assert.equal(await prisma.user.count({ where: { id: alone.owner.id } }), 0);
    assert.equal(await prisma.session.count({ where: { userId: alone.owner.id } }), 0);
    assert.equal(await workspaceExists(alone.workspace.id), false);
    // Solely owned, but another member still uses it: kept without deleteData.
    assert.equal(await workspaceExists(withReader.workspace.id), true);
    assert.equal(await prisma.workspaceMember.count({ where: { workspaceId: withReader.workspace.id } }), 1);
  });

  test("deleting a user with their data also deletes the workspaces they solely own", async () => {
    const { admin } = await createAdmin();
    const owned = await createApiTestWorkspace("admin-user-data");
    const reader = await createUser("reader-data");
    await addMember(owned.workspace.id, reader.id, "reader");

    const result = await deleteUserAs(admin.id, owned.owner.id, true);

    assert.ok(result.ok, JSON.stringify(result));
    assert.deepEqual(result.data.deletedWorkspaces.map(({ id }) => id), [owned.workspace.id]);
    assert.equal(await workspaceExists(owned.workspace.id), false);
    assert.equal(await prisma.user.count({ where: { id: reader.id } }), 1);
  });

  test("an administrator cannot delete themselves or another administrator", async () => {
    const { admin } = await createAdmin();
    const { admin: other } = await createAdmin();

    assert.deepEqual(await deleteUserAs(admin.id, admin.id, true), { ok: false, error: "cannot-delete-self" });
    assert.deepEqual(await deleteUserDataAs(admin.id, other.id), {
      ok: false,
      error: "cannot-delete-instance-admin"
    });
    assert.deepEqual(await deleteUserAs(admin.id, "no-such-user", false), { ok: false, error: "user-not-found" });
    assert.equal(await prisma.user.count({ where: { id: { in: [admin.id, other.id] } } }), 2);
  });

  test("storage is measured per workspace and per user", async () => {
    const { admin, workspace: adminWorkspace } = await createAdmin();
    const empty = await createApiTestWorkspace("admin-storage-empty");
    const full = await createApiTestWorkspace("admin-storage-full");

    for (let index = 0; index < 5; index += 1) {
      await seedPart(full.workspace.id);
    }

    await addMember(full.workspace.id, admin.id, "reader");

    const usage = await getStorageUsage();
    const bytesOf = (id: string) => usage.workspaces.find((workspace) => workspace.id === id)?.bytes ?? -1;

    assert.ok(bytesOf(empty.workspace.id) > 0);
    assert.ok(bytesOf(full.workspace.id) > bytesOf(empty.workspace.id));
    assert.equal(
      usage.users.find((user) => user.id === admin.id)?.bytes,
      bytesOf(adminWorkspace.id) + bytesOf(full.workspace.id)
    );
    assert.ok(usage.databaseBytes > bytesOf(full.workspace.id));

    const viaMcp = await createTestToken(admin.id, adminWorkspace.id, { access: "read-only" });
    const client = await connect(viaMcp.value);
    const result = await client.callTool({ name: "admin_get_storage_usage", arguments: {} });

    assert.ok(!result.isError, JSON.stringify(result));
    assert.ok((result.structuredContent as { databaseBytes: number }).databaseBytes > 0);
    await client.close();

    // getAdminUser reports the same workspaces the storage figure sums.
    const detail = await getAdminUser(admin.id);
    assert.deepEqual(
      detail.workspaces.map(({ id }) => id).sort(),
      [adminWorkspace.id, full.workspace.id].sort()
    );
  });
});
