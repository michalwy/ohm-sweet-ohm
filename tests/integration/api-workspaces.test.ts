import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

import { prisma } from "../../src/server/db/prisma";
import { POST as mcpPost } from "../../src/app/api/mcp/route";
import { GET as getMe } from "../../src/app/api/v1/me/route";
import {
  GET as getDisplayPreferences,
  PATCH as updateDisplayPreferences
} from "../../src/app/api/v1/me/display-preferences/route";
import { GET as getOpenApi } from "../../src/app/api/v1/openapi.json/route";
import {
  GET as getWorkspace,
  PATCH as updateWorkspaceSettings
} from "../../src/app/api/v1/workspace/route";
import { POST as loadStarterDictionaries } from "../../src/app/api/v1/workspace/starter-dictionaries/route";
import {
  GET as listWorkspaces,
  POST as createWorkspace
} from "../../src/app/api/v1/workspaces/route";
import { POST as archiveWorkspace } from "../../src/app/api/v1/workspaces/[id]/archive/route";
import { POST as restoreWorkspace } from "../../src/app/api/v1/workspaces/[id]/restore/route";
import { bearer, createApiTestWorkspace, createTestToken, uniqueSuffix } from "./apiFixtures";

/** Workspaces, workspace settings and display preferences in the REST API and MCP (#286). */

const base = "http://localhost/api/v1";

type UserWorkspace = {
  id: string;
  name: string;
  slug: string;
  primaryCurrency: string;
  archivedAt: string | null;
  deletionScheduledAt: string | null;
  createdAt: string;
  isTokenWorkspace: boolean;
};

type WorkspaceDetails = {
  id: string;
  defaultPriceEntryMode: string;
  defaultTaxRate: string | null;
  activeSupplierProvider: string | null;
};

type DisplayPreferences = { dateFormat: string; timeFormat: string; relativeFormat: boolean };

type ErrorBody = { error: { code: string; message: string } };

function params(id: string) {
  return { params: Promise.resolve({ id }) };
}

const noParams = { params: Promise.resolve({}) };

function jsonRequest(url: string, method: string, token: string, body?: unknown) {
  return new Request(url, {
    method,
    headers: { ...bearer(token), "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
}

async function errorCode(response: Response) {
  return ((await response.json()) as ErrorBody).error.code;
}

async function setup(label: string) {
  const { workspace, owner } = await createApiTestWorkspace(label);
  const readWrite = await createTestToken(owner.id, workspace.id, { access: "read-write" });
  const readOnly = await createTestToken(owner.id, workspace.id, { access: "read-only" });

  return { workspace, owner, readWrite: readWrite.value, readOnly: readOnly.value };
}

/** Adds a user with the given system role to a workspace, and a read-write token for them there. */
async function addMember(workspaceId: string, roleName: "editor" | "owner" | "reader", userId?: string) {
  const user =
    userId === undefined
      ? await prisma.user.create({
          data: {
            email: `api-ws-${roleName}-${uniqueSuffix()}@ohmsweetohm.local`,
            emailVerified: true,
            name: `API ${roleName}`
          }
        })
      : await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  const role = await prisma.role.findFirstOrThrow({
    where: { workspaceId, name: roleName },
    select: { id: true }
  });

  await prisma.workspaceMember.create({
    data: { userId: user.id, workspaceId, roles: { create: { roleId: role.id } } }
  });

  const token = await createTestToken(user.id, workspaceId, { access: "read-write" });

  return { user, token: token.value };
}

async function connect(token: string) {
  const transport = new StreamableHTTPClientTransport(new URL("http://localhost/api/mcp"), {
    requestInit: { headers: bearer(token) },
    fetch: async (input, init) => mcpPost(new Request(input, init))
  });
  const client = new Client({ name: "oso-integration-test", version: "1.0.0" });

  await client.connect(transport);

  return client;
}

async function list(token: string, query = "") {
  const response = await listWorkspaces(
    new Request(`${base}/workspaces${query}`, { headers: bearer(token) }),
    noParams
  );

  assert.equal(response.status, 200);

  return ((await response.json()) as { items: UserWorkspace[] }).items;
}

describe("REST /api/v1/workspace settings", () => {
  test("read, change only the fields sent, and reject a bad tax rate without writing", async () => {
    const { workspace, readWrite } = await setup("ws-settings");

    const updated = await updateWorkspaceSettings(
      jsonRequest(`${base}/workspace`, "PATCH", readWrite, {
        defaultPriceEntryMode: "gross",
        defaultTaxRate: "23",
        activeSupplierProvider: "TME"
      }),
      noParams
    );

    assert.equal(updated.status, 200);

    const details = (await updated.json()) as WorkspaceDetails;

    assert.equal(details.id, workspace.id);
    assert.equal(details.defaultPriceEntryMode, "gross");
    assert.equal(details.defaultTaxRate, "23");
    assert.equal(details.activeSupplierProvider, "TME");

    const partial = await updateWorkspaceSettings(
      jsonRequest(`${base}/workspace`, "PATCH", readWrite, { defaultPriceEntryMode: "net" }),
      noParams
    );
    const partialDetails = (await partial.json()) as WorkspaceDetails;

    assert.equal(partialDetails.defaultPriceEntryMode, "net");
    assert.equal(partialDetails.defaultTaxRate, "23");
    assert.equal(partialDetails.activeSupplierProvider, "TME");

    const invalid = await updateWorkspaceSettings(
      jsonRequest(`${base}/workspace`, "PATCH", readWrite, {
        defaultTaxRate: "100",
        activeSupplierProvider: "DIGIKEY"
      }),
      noParams
    );

    assert.equal(invalid.status, 400);
    assert.equal(await errorCode(invalid), "invalid-tax-rate");

    const unchanged = await getWorkspace(
      new Request(`${base}/workspace`, { headers: bearer(readWrite) }),
      noParams
    );
    const unchangedDetails = (await unchanged.json()) as WorkspaceDetails;

    assert.equal(unchangedDetails.defaultTaxRate, "23");
    assert.equal(unchangedDetails.activeSupplierProvider, "TME");

    const cleared = await updateWorkspaceSettings(
      jsonRequest(`${base}/workspace`, "PATCH", readWrite, { defaultTaxRate: null }),
      noParams
    );

    assert.equal(((await cleared.json()) as WorkspaceDetails).defaultTaxRate, null);
  });

  test("a read-only token, and a non-administrator's token, cannot change settings", async () => {
    const { workspace, readOnly } = await setup("ws-settings-denied");
    const editor = await addMember(workspace.id, "editor");

    const readOnlyDenied = await updateWorkspaceSettings(
      jsonRequest(`${base}/workspace`, "PATCH", readOnly, { defaultPriceEntryMode: "gross" }),
      noParams
    );

    assert.equal(readOnlyDenied.status, 403);
    assert.equal(await errorCode(readOnlyDenied), "permission-denied");

    const editorDenied = await updateWorkspaceSettings(
      jsonRequest(`${base}/workspace`, "PATCH", editor.token, { defaultPriceEntryMode: "gross" }),
      noParams
    );

    assert.equal(editorDenied.status, 403);
    assert.equal(await errorCode(editorDenied), "workspace-requires-admin");

    const starterDenied = await loadStarterDictionaries(
      jsonRequest(`${base}/workspace/starter-dictionaries`, "POST", editor.token, {}),
      noParams
    );

    assert.equal(starterDenied.status, 403);
    assert.equal(await errorCode(starterDenied), "workspace-requires-admin");

    const stored = await prisma.workspace.findUniqueOrThrow({ where: { id: workspace.id } });

    assert.equal(stored.defaultPriceEntryMode, "net");
  });

  test("a token changes only its own workspace's settings", async () => {
    const a = await setup("ws-settings-a");
    const b = await setup("ws-settings-b");

    await updateWorkspaceSettings(
      jsonRequest(`${base}/workspace`, "PATCH", a.readWrite, { activeSupplierProvider: "MOUSER" }),
      noParams
    );

    const storedB = await prisma.workspace.findUniqueOrThrow({ where: { id: b.workspace.id } });

    assert.equal(storedB.activeSupplierProvider, null);
  });

  test("load the starter dictionaries, safely twice; a read-only token cannot", async () => {
    const { workspace, readWrite, readOnly } = await setup("ws-starter");

    const loaded = await loadStarterDictionaries(
      jsonRequest(`${base}/workspace/starter-dictionaries`, "POST", readWrite, {}),
      noParams
    );

    assert.equal(loaded.status, 200);

    const counts = (await loaded.json()) as Record<string, number>;

    assert.ok(counts.categoriesCreated > 0);
    assert.ok(counts.attributesCreated > 0);

    const again = await loadStarterDictionaries(
      jsonRequest(`${base}/workspace/starter-dictionaries`, "POST", readWrite, {}),
      noParams
    );

    assert.equal(((await again.json()) as Record<string, number>).categoriesCreated, 0);
    assert.ok((await prisma.partCategory.count({ where: { workspaceId: workspace.id } })) > 0);

    const denied = await loadStarterDictionaries(
      jsonRequest(`${base}/workspace/starter-dictionaries`, "POST", readOnly, {}),
      noParams
    );

    assert.equal(denied.status, 403);
    assert.equal(await errorCode(denied), "permission-denied");
  });
});

describe("REST /api/v1/workspaces", () => {
  test("create, list, archive and restore a workspace", async () => {
    const { workspace, owner, readWrite } = await setup("ws-lifecycle");
    const name = `Bench ${uniqueSuffix()}`;

    const created = await createWorkspace(
      jsonRequest(`${base}/workspaces`, "POST", readWrite, {
        name: `  ${name}  `,
        primaryCurrency: "PLN",
        preset: "starter-dictionaries"
      }),
      noParams
    );

    assert.equal(created.status, 200);

    const newWorkspace = (await created.json()) as UserWorkspace;

    assert.equal(newWorkspace.name, name);
    assert.equal(newWorkspace.primaryCurrency, "PLN");
    assert.equal(newWorkspace.isTokenWorkspace, false);
    assert.equal(newWorkspace.archivedAt, null);

    const ownerRole = await prisma.workspaceMember.findFirstOrThrow({
      where: { userId: owner.id, workspaceId: newWorkspace.id },
      select: { roles: { select: { role: { select: { name: true } } } } }
    });

    assert.deepEqual(
      ownerRole.roles.map(({ role }) => role.name),
      ["owner"]
    );
    assert.ok(
      (await prisma.partCategory.count({ where: { workspaceId: newWorkspace.id } })) > 0,
      "the starter-dictionaries preset was applied"
    );

    const active = await list(readWrite);

    assert.deepEqual(
      active.map((item) => [item.id, item.isTokenWorkspace]),
      [
        [workspace.id, true],
        [newWorkspace.id, false]
      ]
    );

    const archived = await archiveWorkspace(
      jsonRequest(`${base}/workspaces/${newWorkspace.id}/archive`, "POST", readWrite, {}),
      params(newWorkspace.id)
    );

    assert.equal(archived.status, 200);
    assert.notEqual(((await archived.json()) as UserWorkspace).archivedAt, null);
    assert.deepEqual(
      (await list(readWrite)).map((item) => item.id),
      [workspace.id]
    );
    assert.deepEqual(
      (await list(readWrite, "?includeArchived=true")).map((item) => item.id),
      [workspace.id, newWorkspace.id]
    );

    const twice = await archiveWorkspace(
      jsonRequest(`${base}/workspaces/${newWorkspace.id}/archive`, "POST", readWrite, {}),
      params(newWorkspace.id)
    );

    assert.equal(twice.status, 409);
    assert.equal(await errorCode(twice), "workspace-already-archived");

    const restored = await restoreWorkspace(
      jsonRequest(`${base}/workspaces/${newWorkspace.id}/restore`, "POST", readWrite, {}),
      params(newWorkspace.id)
    );

    assert.equal(restored.status, 200);
    assert.equal(((await restored.json()) as UserWorkspace).archivedAt, null);

    const notArchived = await restoreWorkspace(
      jsonRequest(`${base}/workspaces/${newWorkspace.id}/restore`, "POST", readWrite, {}),
      params(newWorkspace.id)
    );

    assert.equal(notArchived.status, 409);
    assert.equal(await errorCode(notArchived), "workspace-not-archived");
  });

  test("an unsupported currency or a blank name is refused", async () => {
    const { readWrite } = await setup("ws-create-invalid");

    const currency = await createWorkspace(
      jsonRequest(`${base}/workspaces`, "POST", readWrite, { name: "X", primaryCurrency: "XYZ" }),
      noParams
    );

    assert.equal(currency.status, 400);
    assert.equal(await errorCode(currency), "invalid-input");

    const blank = await createWorkspace(
      jsonRequest(`${base}/workspaces`, "POST", readWrite, { name: "   ", primaryCurrency: "EUR" }),
      noParams
    );

    assert.equal(blank.status, 400);
    assert.equal(await errorCode(blank), "missing-name");
  });

  test("archiving the token's own workspace ends the token", async () => {
    const { workspace, readWrite } = await setup("ws-archive-self");

    const archived = await archiveWorkspace(
      jsonRequest(`${base}/workspaces/${workspace.id}/archive`, "POST", readWrite, {}),
      params(workspace.id)
    );

    assert.equal(archived.status, 200);
    assert.equal(((await archived.json()) as UserWorkspace).isTokenWorkspace, true);

    const after = await getMe(new Request(`${base}/me`, { headers: bearer(readWrite) }), noParams);

    assert.equal(after.status, 401);
  });

  test("a workspace whose deletion is scheduled cannot be restored", async () => {
    const { owner, readWrite } = await setup("ws-deletion");
    const other = await createApiTestWorkspace("ws-deletion-other");

    await addMember(other.workspace.id, "owner", owner.id);
    await prisma.workspace.update({
      where: { id: other.workspace.id },
      data: { archivedAt: new Date(), deletionScheduledAt: new Date() }
    });

    const refused = await restoreWorkspace(
      jsonRequest(`${base}/workspaces/${other.workspace.id}/restore`, "POST", readWrite, {}),
      params(other.workspace.id)
    );

    assert.equal(refused.status, 409);
    assert.equal(await errorCode(refused), "workspace-deletion-scheduled");
  });

  test("permissions: a read-only token, a non-administrator, and another user's workspace", async () => {
    const a = await setup("ws-perm-a");
    const b = await setup("ws-perm-b");

    const readOnlyCreate = await createWorkspace(
      jsonRequest(`${base}/workspaces`, "POST", a.readOnly, { name: "Nope", primaryCurrency: "EUR" }),
      noParams
    );

    assert.equal(readOnlyCreate.status, 403);
    assert.equal(await errorCode(readOnlyCreate), "permission-denied");

    const readOnlyArchive = await archiveWorkspace(
      jsonRequest(`${base}/workspaces/${a.workspace.id}/archive`, "POST", a.readOnly, {}),
      params(a.workspace.id)
    );

    assert.equal(readOnlyArchive.status, 403);

    // Workspace isolation: A's owner is not a member of B, so B does not exist for A's token.
    const foreign = await archiveWorkspace(
      jsonRequest(`${base}/workspaces/${b.workspace.id}/archive`, "POST", a.readWrite, {}),
      params(b.workspace.id)
    );

    assert.equal(foreign.status, 404);
    assert.equal(await errorCode(foreign), "workspace-not-found");
    assert.ok(!(await list(a.readWrite, "?includeArchived=true")).some((item) => item.id === b.workspace.id));

    // An editor of B (not an administrator there) cannot archive it, even with a read-write token.
    const editor = await addMember(b.workspace.id, "editor");
    const editorArchive = await archiveWorkspace(
      jsonRequest(`${base}/workspaces/${b.workspace.id}/archive`, "POST", editor.token, {}),
      params(b.workspace.id)
    );

    assert.equal(editorArchive.status, 403);
    assert.equal(await errorCode(editorArchive), "workspace-requires-admin");

    const storedB = await prisma.workspace.findUniqueOrThrow({ where: { id: b.workspace.id } });

    assert.equal(storedB.archivedAt, null);
  });

  test("the OpenAPI document lists the endpoints", async () => {
    const response = await getOpenApi(new Request(`${base}/openapi.json`), noParams);
    const document = (await response.json()) as { paths: Record<string, Record<string, unknown>> };

    assert.ok(document.paths["/workspaces"]?.get);
    assert.ok(document.paths["/workspaces"]?.post);
    assert.ok(document.paths["/workspaces/{id}/archive"]?.post);
    assert.ok(document.paths["/workspaces/{id}/restore"]?.post);
    assert.ok(document.paths["/workspace"]?.patch);
    assert.ok(document.paths["/workspace/starter-dictionaries"]?.post);
    assert.ok(document.paths["/me/display-preferences"]?.get);
    assert.ok(document.paths["/me/display-preferences"]?.patch);
  });
});

describe("REST /api/v1/me/display-preferences", () => {
  test("read and change the user's own preferences; a read-only token cannot change them", async () => {
    const { owner, readWrite, readOnly } = await setup("ws-display");

    const initial = await getDisplayPreferences(
      new Request(`${base}/me/display-preferences`, { headers: bearer(readOnly) }),
      noParams
    );

    assert.equal(initial.status, 200);
    assert.deepEqual(await initial.json(), {
      dateFormat: "locale",
      timeFormat: "locale",
      relativeFormat: false
    });

    const updated = await updateDisplayPreferences(
      jsonRequest(`${base}/me/display-preferences`, "PATCH", readWrite, { dateFormat: "YMD" }),
      noParams
    );

    assert.equal(updated.status, 200);
    assert.deepEqual(await updated.json(), {
      dateFormat: "YMD",
      timeFormat: "locale",
      relativeFormat: false
    });

    const stored = await prisma.user.findUniqueOrThrow({ where: { id: owner.id } });

    assert.equal(stored.dateFormat, "YMD");

    const invalid = await updateDisplayPreferences(
      jsonRequest(`${base}/me/display-preferences`, "PATCH", readWrite, { timeFormat: "36h" }),
      noParams
    );

    assert.equal(invalid.status, 400);

    const denied = await updateDisplayPreferences(
      jsonRequest(`${base}/me/display-preferences`, "PATCH", readOnly, { relativeFormat: true }),
      noParams
    );

    assert.equal(denied.status, 403);
    assert.equal(await errorCode(denied), "permission-denied");
  });
});

describe("MCP workspace tools", () => {
  test("annotations, settings, display preferences and the workspace lifecycle through the tools", async () => {
    const { workspace, readWrite } = await setup("ws-mcp");
    const client = await connect(readWrite);
    const { tools } = await client.listTools();
    const annotations = Object.fromEntries(tools.map((tool) => [tool.name, tool.annotations]));

    for (const name of ["get_workspace", "list_workspaces", "get_display_preferences"]) {
      assert.equal(annotations[name]?.readOnlyHint, true, name);
    }

    assert.equal(annotations.update_workspace_settings?.destructiveHint, true);
    assert.equal(annotations.update_display_preferences?.destructiveHint, true);
    assert.equal(annotations.archive_workspace?.destructiveHint, true);
    assert.equal(annotations.create_workspace?.destructiveHint, false);
    assert.equal(annotations.restore_workspace?.destructiveHint, false);
    assert.equal(annotations.load_starter_dictionaries?.destructiveHint, false);

    const settings = await client.callTool({
      name: "update_workspace_settings",
      arguments: { defaultTaxRate: "8" }
    });

    assert.ok(!settings.isError, JSON.stringify(settings));
    assert.equal((settings.structuredContent as WorkspaceDetails).defaultTaxRate, "8");

    const fetched = await client.callTool({ name: "get_workspace", arguments: {} });

    assert.equal((fetched.structuredContent as WorkspaceDetails).id, workspace.id);

    const preferences = await client.callTool({
      name: "update_display_preferences",
      arguments: { timeFormat: "24h", relativeFormat: true }
    });

    assert.deepEqual(preferences.structuredContent as DisplayPreferences, {
      dateFormat: "locale",
      timeFormat: "24h",
      relativeFormat: true
    });

    const created = await client.callTool({
      name: "create_workspace",
      arguments: { name: `Mcp ${uniqueSuffix()}`, primaryCurrency: "EUR" }
    });

    assert.ok(!created.isError, JSON.stringify(created));

    const newWorkspace = created.structuredContent as UserWorkspace;
    const archived = await client.callTool({
      name: "archive_workspace",
      arguments: { id: newWorkspace.id }
    });

    assert.notEqual((archived.structuredContent as UserWorkspace).archivedAt, null);

    const listed = await client.callTool({
      name: "list_workspaces",
      arguments: { includeArchived: true }
    });

    assert.deepEqual(
      (listed.structuredContent as { items: UserWorkspace[] }).items.map((item) => item.id),
      [workspace.id, newWorkspace.id]
    );

    const restored = await client.callTool({
      name: "restore_workspace",
      arguments: { id: newWorkspace.id }
    });

    assert.equal((restored.structuredContent as UserWorkspace).archivedAt, null);

    await client.close();
  });

  test("a read-only token cannot call a writing tool, nor reach another user's workspace", async () => {
    const a = await setup("ws-mcp-a");
    const b = await setup("ws-mcp-b");
    const readOnlyClient = await connect(a.readOnly);

    const denied = await readOnlyClient.callTool({
      name: "update_workspace_settings",
      arguments: { defaultPriceEntryMode: "gross" }
    });

    assert.equal(denied.isError, true);
    assert.match(JSON.stringify(denied.content), /permission-denied/);

    await readOnlyClient.close();

    const client = await connect(a.readWrite);
    const isolated = await client.callTool({
      name: "archive_workspace",
      arguments: { id: b.workspace.id }
    });

    assert.equal(isolated.isError, true);
    assert.match(JSON.stringify(isolated.content), /workspace-not-found/);

    await client.close();
  });
});
