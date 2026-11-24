import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

import { prisma } from "../../src/server/db/prisma";
import { POST as mcpPost } from "../../src/app/api/mcp/route";
import {
  GET as listOrganizations,
  POST as createOrganization
} from "../../src/app/api/v1/organizations/route";
import {
  DELETE as deleteOrganization,
  GET as getOrganization,
  PATCH as updateOrganization
} from "../../src/app/api/v1/organizations/[id]/route";
import { GET as getOpenApi } from "../../src/app/api/v1/openapi.json/route";
import { ensureInternalOrganizationForWorkspace } from "../../src/server/organizations/organizations";
import { bearer, createApiTestWorkspace, createTestToken, uniqueSuffix } from "./apiFixtures";

/** Organizations in the REST API and MCP (#279). */

const base = "http://localhost/api/v1";

type Organization = {
  id: string;
  name: string;
  roles: string[];
  currency: string | null;
  defaultPriceEntryMode: string | null;
  defaultTaxRate: string | null;
  createdAt: string;
};

type ErrorBody = { error: { code: string; message: string; issues?: Array<{ path: string }> } };

function params(id: string) {
  return { params: Promise.resolve({ id }) };
}

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

async function seedOrganization(workspaceId: string, name: string, roles: string[]) {
  return prisma.organization.create({
    data: {
      workspaceId,
      name,
      normalizedName: name.toLowerCase(),
      roles: { create: roles.map((role) => ({ role })) }
    }
  });
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

describe("REST /api/v1/organizations", () => {
  test("create, get, list with filters, update one field, delete", async () => {
    const { readWrite } = await setup("org-rest");
    const name = `Acme ${uniqueSuffix()}`;

    const created = await createOrganization(
      jsonRequest(`${base}/organizations`, "POST", readWrite, {
        name: `  ${name}  `,
        roles: ["supplier"],
        currency: "EUR",
        defaultPriceEntryMode: "net",
        defaultTaxRate: "23"
      })
    );

    assert.equal(created.status, 200);

    const organization = (await created.json()) as Organization;

    assert.equal(organization.name, name);
    assert.deepEqual(organization.roles, ["supplier"]);
    assert.equal(organization.currency, "EUR");
    assert.equal(organization.defaultPriceEntryMode, "net");
    assert.equal(organization.defaultTaxRate, "23");

    const fetched = await getOrganization(
      new Request(`${base}/organizations/${organization.id}`, { headers: bearer(readWrite) }),
      params(organization.id)
    );

    assert.equal(fetched.status, 200);
    assert.deepEqual(await fetched.json(), organization);

    await createOrganization(
      jsonRequest(`${base}/organizations`, "POST", readWrite, {
        name: `Maker ${uniqueSuffix()}`,
        roles: ["manufacturer"]
      })
    );

    const suppliers = await listOrganizations(
      new Request(`${base}/organizations?roleFilter=supplier&pageSize=10`, {
        headers: bearer(readWrite)
      })
    );
    const supplierPage = (await suppliers.json()) as {
      items: Organization[];
      totalCount: number;
      filteredCount: number;
    };

    assert.equal(suppliers.status, 200);
    assert.deepEqual(
      supplierPage.items.map((item) => item.id),
      [organization.id]
    );
    assert.equal(supplierPage.totalCount, 2);
    assert.equal(supplierPage.filteredCount, 1);

    const searched = await listOrganizations(
      new Request(`${base}/organizations?searchQuery=${encodeURIComponent("acme")}`, {
        headers: bearer(readWrite)
      })
    );

    assert.deepEqual(
      ((await searched.json()) as { items: Organization[] }).items.map((item) => item.id),
      [organization.id]
    );

    const updated = await updateOrganization(
      jsonRequest(`${base}/organizations/${organization.id}`, "PATCH", readWrite, {
        roles: ["manufacturer", "supplier"],
        defaultTaxRate: null
      }),
      params(organization.id)
    );

    assert.equal(updated.status, 200);

    const afterUpdate = (await updated.json()) as Organization;

    assert.deepEqual([...afterUpdate.roles].sort(), ["manufacturer", "supplier"]);
    assert.equal(afterUpdate.name, name, "a field not sent keeps its value");
    assert.equal(afterUpdate.currency, "EUR", "a field not sent keeps its value");
    assert.equal(afterUpdate.defaultTaxRate, null, "null clears the field");

    const deleted = await deleteOrganization(
      new Request(`${base}/organizations/${organization.id}`, {
        method: "DELETE",
        headers: bearer(readWrite)
      }),
      params(organization.id)
    );

    assert.equal(deleted.status, 200);
    assert.deepEqual(await deleted.json(), { id: organization.id });
    assert.equal(await prisma.organization.count({ where: { id: organization.id } }), 0);
  });

  test("domain errors: invalid input, duplicate name, referenced by a part", async () => {
    const { workspace, readWrite } = await setup("org-errors");
    const maker = await seedOrganization(workspace.id, `Maker ${uniqueSuffix()}`, ["manufacturer"]);

    const invalid = await createOrganization(
      jsonRequest(`${base}/organizations`, "POST", readWrite, {
        name: "No roles",
        roles: [],
        defaultTaxRate: "23,5"
      })
    );

    assert.equal(invalid.status, 400);

    const invalidBody = (await invalid.json()) as ErrorBody;

    assert.equal(invalidBody.error.code, "invalid-input");
    assert.deepEqual(
      invalidBody.error.issues?.map((issue) => issue.path).sort(),
      ["defaultTaxRate", "roles"]
    );

    const duplicate = await createOrganization(
      jsonRequest(`${base}/organizations`, "POST", readWrite, {
        name: maker.name.toUpperCase(),
        roles: ["supplier"]
      })
    );

    assert.equal(duplicate.status, 409);
    assert.equal(await errorCode(duplicate), "name-taken");

    const blank = await createOrganization(
      jsonRequest(`${base}/organizations`, "POST", readWrite, { name: "   ", roles: ["supplier"] })
    );

    assert.equal(blank.status, 400);
    assert.equal(await errorCode(blank), "name-required");

    const unit = await prisma.unit.create({
      data: {
        workspaceId: workspace.id,
        name: `unit-${uniqueSuffix()}`,
        normalizedName: `unit-${uniqueSuffix()}`,
        symbol: "u",
        allowsFraction: false
      }
    });

    await prisma.part.create({
      data: {
        workspaceId: workspace.id,
        unitId: unit.id,
        manufacturerId: maker.id,
        catalogNumber: `CAT-${uniqueSuffix()}`
      }
    });

    const referenced = await deleteOrganization(
      new Request(`${base}/organizations/${maker.id}`, {
        method: "DELETE",
        headers: bearer(readWrite)
      }),
      params(maker.id)
    );

    assert.equal(referenced.status, 409);
    assert.equal(await errorCode(referenced), "referenced-by-parts");
  });

  test("a read-only token reads but cannot create, update or delete", async () => {
    const { workspace, readOnly } = await setup("org-denied");
    const organization = await seedOrganization(workspace.id, `Kept ${uniqueSuffix()}`, ["supplier"]);

    const read = await getOrganization(
      new Request(`${base}/organizations/${organization.id}`, { headers: bearer(readOnly) }),
      params(organization.id)
    );

    assert.equal(read.status, 200);

    const create = await createOrganization(
      jsonRequest(`${base}/organizations`, "POST", readOnly, { name: "Nope", roles: ["supplier"] })
    );
    const update = await updateOrganization(
      jsonRequest(`${base}/organizations/${organization.id}`, "PATCH", readOnly, { name: "Nope" }),
      params(organization.id)
    );
    const remove = await deleteOrganization(
      new Request(`${base}/organizations/${organization.id}`, {
        method: "DELETE",
        headers: bearer(readOnly)
      }),
      params(organization.id)
    );

    for (const response of [create, update, remove]) {
      assert.equal(response.status, 403);
      assert.equal(await errorCode(response), "permission-denied");
    }

    const unchanged = await prisma.organization.findUniqueOrThrow({ where: { id: organization.id } });

    assert.equal(unchanged.name, organization.name);
  });

  test("a token for workspace A neither sees nor changes workspace B's organizations", async () => {
    const a = await setup("org-iso-a");
    const b = await setup("org-iso-b");
    const other = await seedOrganization(b.workspace.id, `Other ${uniqueSuffix()}`, ["supplier"]);

    const list = await listOrganizations(
      new Request(`${base}/organizations`, { headers: bearer(a.readWrite) })
    );

    assert.equal(((await list.json()) as { totalCount: number }).totalCount, 0);

    const get = await getOrganization(
      new Request(`${base}/organizations/${other.id}`, { headers: bearer(a.readWrite) }),
      params(other.id)
    );
    const update = await updateOrganization(
      jsonRequest(`${base}/organizations/${other.id}`, "PATCH", a.readWrite, { name: "Taken over" }),
      params(other.id)
    );
    const remove = await deleteOrganization(
      new Request(`${base}/organizations/${other.id}`, {
        method: "DELETE",
        headers: bearer(a.readWrite)
      }),
      params(other.id)
    );

    for (const response of [get, update, remove]) {
      assert.equal(response.status, 404);
      assert.equal(await errorCode(response), "organization-not-found");
    }

    const unchanged = await prisma.organization.findUniqueOrThrow({ where: { id: other.id } });

    assert.equal(unchanged.name, other.name);
  });

  test("the workspace's internal organization is not found", async () => {
    const { workspace, readWrite } = await setup("org-internal");
    const internal = await ensureInternalOrganizationForWorkspace({
      workspaceId: workspace.id,
      workspaceName: workspace.name
    });

    const get = await getOrganization(
      new Request(`${base}/organizations/${internal.id}`, { headers: bearer(readWrite) }),
      params(internal.id)
    );
    const update = await updateOrganization(
      jsonRequest(`${base}/organizations/${internal.id}`, "PATCH", readWrite, { name: "Renamed" }),
      params(internal.id)
    );
    const remove = await deleteOrganization(
      new Request(`${base}/organizations/${internal.id}`, {
        method: "DELETE",
        headers: bearer(readWrite)
      }),
      params(internal.id)
    );

    for (const response of [get, update, remove]) {
      assert.equal(response.status, 404);
    }

    assert.equal(await prisma.organization.count({ where: { id: internal.id } }), 1);
  });

  test("the OpenAPI document describes the id as a path parameter, not a body field", async () => {
    const response = await getOpenApi();
    const document = (await response.json()) as {
      paths: Record<string, Record<string, Record<string, unknown>>>;
    };
    const patch = document.paths["/organizations/{id}"].patch;
    const parameters = patch.parameters as Array<{ name: string; in: string; required: boolean }>;
    const body = (
      patch.requestBody as { content: { "application/json": { schema: { properties: object } } } }
    ).content["application/json"].schema;

    assert.deepEqual(
      parameters.map(({ name, in: location, required }) => [name, location, required]),
      [["id", "path", true]]
    );
    assert.ok(!("id" in body.properties));
    assert.ok(!("requestBody" in document.paths["/organizations/{id}"].delete));
  });
});

describe("MCP organization tools", () => {
  test("annotations, and create → list → update → delete through the tools", async () => {
    const { readWrite } = await setup("org-mcp");
    const client = await connect(readWrite);
    const { tools } = await client.listTools();
    const annotations = Object.fromEntries(
      tools
        .filter((tool) => tool.name.endsWith("_organization") || tool.name === "list_organizations")
        .map((tool) => [tool.name, tool.annotations])
    );

    assert.equal(annotations.list_organizations?.readOnlyHint, true);
    assert.equal(annotations.get_organization?.readOnlyHint, true);
    assert.equal(annotations.create_organization?.readOnlyHint, false);
    assert.equal(annotations.create_organization?.destructiveHint, false);
    assert.equal(annotations.update_organization?.destructiveHint, true);
    assert.equal(annotations.delete_organization?.destructiveHint, true);

    const name = `Mcp ${uniqueSuffix()}`;
    const created = await client.callTool({
      name: "create_organization",
      arguments: { name, roles: ["manufacturer"] }
    });

    assert.ok(!created.isError, JSON.stringify(created));

    const organization = created.structuredContent as Organization;
    const listed = await client.callTool({
      name: "list_organizations",
      arguments: { roleFilter: "manufacturer" }
    });

    assert.deepEqual(
      (listed.structuredContent as { items: Organization[] }).items.map((item) => item.name),
      [name]
    );

    const updated = await client.callTool({
      name: "update_organization",
      arguments: { id: organization.id, currency: "PLN" }
    });

    assert.equal((updated.structuredContent as Organization).currency, "PLN");

    const deleted = await client.callTool({
      name: "delete_organization",
      arguments: { id: organization.id }
    });

    assert.ok(!deleted.isError, JSON.stringify(deleted));

    const missing = await client.callTool({
      name: "get_organization",
      arguments: { id: organization.id }
    });

    assert.equal(missing.isError, true);
    assert.match(JSON.stringify(missing.content), /organization-not-found/);

    await client.close();
  });

  test("a read-only token cannot call a writing tool, nor reach another workspace", async () => {
    const a = await setup("org-mcp-a");
    const b = await setup("org-mcp-b");
    const other = await seedOrganization(b.workspace.id, `Other ${uniqueSuffix()}`, ["supplier"]);
    const client = await connect(a.readOnly);

    const denied = await client.callTool({
      name: "create_organization",
      arguments: { name: "Nope", roles: ["supplier"] }
    });

    assert.equal(denied.isError, true);
    assert.match(JSON.stringify(denied.content), /permission-denied/);

    const isolated = await client.callTool({
      name: "get_organization",
      arguments: { id: other.id }
    });

    assert.equal(isolated.isError, true);
    assert.match(JSON.stringify(isolated.content), /organization-not-found/);

    await client.close();
  });
});
