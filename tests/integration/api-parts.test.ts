import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

import { POST as mcpPost } from "../../src/app/api/mcp/route";
import { GET as listParts, POST as createPart } from "../../src/app/api/v1/parts/route";
import {
  DELETE as deletePart,
  GET as getPart,
  PATCH as updatePart
} from "../../src/app/api/v1/parts/[id]/route";
import { prisma } from "../../src/server/db/prisma";
import { createStorageLocation } from "../../src/server/inventory/locationMutations";
import { mcpTools } from "../../src/server/mcp/tools";
import {
  attachOrOverrideCategoryAttribute,
  createAttribute,
  setCategoryValueAttribute
} from "../../src/server/parts/attributeMutations";
import { createPartCategory } from "../../src/server/parts/categories";
import {
  ensureDefaultUnitsForWorkspace,
  getDefaultPartUnitId
} from "../../src/server/units/defaultUnits";
import { bearer, createApiTestWorkspace, createTestToken, uniqueSuffix } from "./apiFixtures";

/** Parts in the API and MCP (#277): REST /api/v1/parts and the part tools, over one domain. */

const base = "http://localhost/api/v1";

type Part = {
  id: string;
  catalogNumber: string;
  description: string | null;
  manufacturerName: string;
  unitId: string;
  primaryCategoryId: string | null;
  primaryCategoryPath: string | null;
  secondaryCategoryId: string | null;
  defaultLocationId: string | null;
  valueDisplayValue: string | null;
  currentStock: string;
  balanceQuantity: string;
  attributeValues: Array<{ attributeId: string; attributeName: string; displayValue: string }>;
};

type PartsPage = { items: Part[]; nextCursor: string | null; totalCount: number; filteredCount: number };

/** A workspace with a unit, two categories (Resistors with Resistance, Capacitors with Voltage) and a location. */
async function createPartsWorkspace(label: string) {
  const { workspace, owner } = await createApiTestWorkspace(label);

  await ensureDefaultUnitsForWorkspace(prisma, workspace.id);

  const unitId = await getDefaultPartUnitId(prisma, workspace.id);
  assert.ok(unitId);

  const resistors = await createPartCategory({
    workspaceId: workspace.id,
    parentId: null,
    name: "Resistors",
    isAssignable: true
  });
  const capacitors = await createPartCategory({
    workspaceId: workspace.id,
    parentId: null,
    name: "Capacitors",
    isAssignable: true
  });
  const resistance = await createAttribute({
    workspaceId: workspace.id,
    name: "Resistance",
    type: "QUANTITY",
    baseUnitSymbol: "Ω"
  });
  const voltage = await createAttribute({
    workspaceId: workspace.id,
    name: "Voltage",
    type: "QUANTITY",
    baseUnitSymbol: "V"
  });

  await attachOrOverrideCategoryAttribute({
    workspaceId: workspace.id,
    categoryId: resistors.id,
    attributeId: resistance.id,
    sortOrder: 0,
    defaultValue: null,
    isPrimary: true
  });
  await setCategoryValueAttribute({
    workspaceId: workspace.id,
    categoryId: resistors.id,
    attributeId: resistance.id
  });
  await attachOrOverrideCategoryAttribute({
    workspaceId: workspace.id,
    categoryId: capacitors.id,
    attributeId: voltage.id,
    sortOrder: 0,
    defaultValue: null,
    isPrimary: true
  });

  const location = await createStorageLocation({
    workspaceId: workspace.id,
    parentId: null,
    name: `Drawer ${uniqueSuffix()}`,
    isAssignable: true
  });
  const { value: readWrite } = await createTestToken(owner.id, workspace.id, {
    access: "read-write"
  });
  const { value: readOnly } = await createTestToken(owner.id, workspace.id, {
    access: "read-only"
  });

  return {
    workspace,
    owner,
    unitId: unitId as string,
    resistorsId: resistors.id,
    capacitorsId: capacitors.id,
    resistanceId: resistance.id,
    voltageId: voltage.id,
    locationId: location.id,
    readWrite,
    readOnly
  };
}

function jsonRequest(url: string, token: string, method: string, body?: unknown) {
  return new Request(url, {
    method,
    headers: { ...bearer(token), "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
}

function withId(id: string) {
  return { params: Promise.resolve({ id }) };
}

async function restCreate(token: string, body: unknown) {
  return createPart(jsonRequest(`${base}/parts`, token, "POST", body));
}

async function connect(token: string) {
  const transport = new StreamableHTTPClientTransport(new URL("http://localhost/api/mcp"), {
    requestInit: { headers: bearer(token) },
    fetch: async (input, init) => mcpPost(new Request(input, init))
  });
  const client = new Client({ name: "oso-parts-test", version: "1.0.0" });

  await client.connect(transport);

  return client;
}

function toolError(result: unknown) {
  const [content] = (result as { content: Array<{ text: string }> }).content;
  return (JSON.parse(content.text) as { error: { code: string } }).error;
}

describe("parts REST API", () => {
  test("create, get, list with filters, update and delete a part", async () => {
    const ws = await createPartsWorkspace("parts-rest");

    const created = await restCreate(ws.readWrite, {
      catalogNumber: "RC0603-10K",
      manufacturerName: "Yageo",
      unitId: ws.unitId,
      description: "Thick film resistor",
      primaryCategoryId: ws.resistorsId,
      defaultLocationId: ws.locationId,
      attributeValues: { [ws.resistanceId]: "10k" }
    });

    assert.equal(created.status, 200, await created.clone().text());

    const part = (await created.json()) as Part;

    assert.equal(part.catalogNumber, "RC0603-10K");
    assert.equal(part.manufacturerName, "Yageo");
    assert.equal(part.primaryCategoryPath, "Resistors");
    assert.equal(part.defaultLocationId, ws.locationId);
    assert.equal(part.currentStock, "0");
    assert.deepEqual(part.attributeValues, [
      { attributeId: ws.resistanceId, attributeName: "Resistance", displayValue: "10 kΩ" }
    ]);
    assert.equal(part.valueDisplayValue, "10 kΩ");

    await restCreate(ws.readWrite, {
      catalogNumber: "GRM188-100N",
      manufacturerName: "Murata",
      unitId: ws.unitId,
      primaryCategoryId: ws.capacitorsId,
      attributeValues: { [ws.voltageId]: "50V" }
    });

    const fetched = await getPart(
      new Request(`${base}/parts/${part.id}`, { headers: bearer(ws.readOnly) }),
      withId(part.id)
    );

    assert.equal(fetched.status, 200);
    assert.deepEqual(await fetched.json(), part);

    const all = (await (
      await listParts(new Request(`${base}/parts?pageSize=1`, { headers: bearer(ws.readOnly) }))
    ).json()) as PartsPage;

    assert.equal(all.totalCount, 2);
    assert.equal(all.items.length, 1);
    assert.equal(all.items[0].manufacturerName, "Murata");
    assert.ok(all.nextCursor);

    const second = (await (
      await listParts(
        new Request(`${base}/parts?pageSize=1&cursor=${encodeURIComponent(all.nextCursor)}`, {
          headers: bearer(ws.readOnly)
        })
      )
    ).json()) as PartsPage;

    assert.deepEqual(
      second.items.map((item) => item.id),
      [part.id]
    );

    const filters = new URLSearchParams();
    filters.append("attributeFilters", `${ws.resistanceId}=gte:1k`);
    filters.append("categoryId", ws.resistorsId);
    filters.append("search", "yageo");
    filters.append("sortBy", `attribute:${ws.resistanceId}`);
    filters.append("sortDir", "desc");

    const filtered = (await (
      await listParts(new Request(`${base}/parts?${filters}`, { headers: bearer(ws.readOnly) }))
    ).json()) as PartsPage;

    assert.equal(filtered.filteredCount, 1);
    assert.deepEqual(
      filtered.items.map((item) => item.id),
      [part.id]
    );

    const none = (await (
      await listParts(
        new Request(`${base}/parts?attributeFilters=${ws.resistanceId}%3Dgt:1M`, {
          headers: bearer(ws.readOnly)
        })
      )
    ).json()) as PartsPage;

    assert.equal(none.filteredCount, 0);

    const updated = await updatePart(
      jsonRequest(`${base}/parts/${part.id}`, ws.readWrite, "PATCH", {
        description: "Changed",
        attributeValues: { [ws.resistanceId]: "4.7k" }
      }),
      withId(part.id)
    );

    assert.equal(updated.status, 200, await updated.clone().text());

    const changed = (await updated.json()) as Part;

    assert.equal(changed.description, "Changed");
    assert.equal(changed.catalogNumber, "RC0603-10K");
    assert.equal(changed.defaultLocationId, ws.locationId);
    assert.equal(changed.attributeValues[0].displayValue, "4.7 kΩ");

    const deleted = await deletePart(
      new Request(`${base}/parts/${part.id}`, { method: "DELETE", headers: bearer(ws.readWrite) }),
      withId(part.id)
    );

    assert.equal(deleted.status, 200);
    assert.deepEqual(await deleted.json(), { id: part.id });

    const gone = await getPart(
      new Request(`${base}/parts/${part.id}`, { headers: bearer(ws.readOnly) }),
      withId(part.id)
    );

    assert.equal(gone.status, 404);
    assert.equal((await gone.json()).error.code, "part-not-found");
  });

  test("attribute values survive a category change and come back with the category", async () => {
    const ws = await createPartsWorkspace("parts-survive");
    const part = (await (
      await restCreate(ws.readWrite, {
        catalogNumber: "R-1",
        manufacturerName: "Acme",
        unitId: ws.unitId,
        primaryCategoryId: ws.resistorsId,
        attributeValues: { [ws.resistanceId]: "220" }
      })
    ).json()) as Part;

    const moved = (await (
      await updatePart(
        jsonRequest(`${base}/parts/${part.id}`, ws.readWrite, "PATCH", {
          primaryCategoryId: ws.capacitorsId,
          attributeValues: { [ws.voltageId]: "16V" }
        }),
        withId(part.id)
      )
    ).json()) as Part;

    assert.equal(moved.primaryCategoryId, ws.capacitorsId);

    const stored = await prisma.partAttributeValue.findMany({
      where: { partId: part.id },
      select: { attributeId: true, displayValue: true },
      orderBy: { displayValue: "asc" }
    });

    assert.deepEqual(stored, [
      { attributeId: ws.voltageId, displayValue: "16 V" },
      { attributeId: ws.resistanceId, displayValue: "220 Ω" }
    ]);

    const back = (await (
      await updatePart(
        jsonRequest(`${base}/parts/${part.id}`, ws.readWrite, "PATCH", {
          primaryCategoryId: ws.resistorsId
        }),
        withId(part.id)
      )
    ).json()) as Part;

    assert.equal(back.valueDisplayValue, "220 Ω");

    const foreign = await updatePart(
      jsonRequest(`${base}/parts/${part.id}`, ws.readWrite, "PATCH", {
        attributeValues: { [ws.voltageId]: "5V" }
      }),
      withId(part.id)
    );

    assert.equal(foreign.status, 400);
    assert.equal((await foreign.json()).error.code, "invalid-attribute");
  });

  test("domain errors keep their codes: duplicate, invalid value, bad input", async () => {
    const ws = await createPartsWorkspace("parts-errors");
    const body = { catalogNumber: "DUP-1", manufacturerName: "Acme", unitId: ws.unitId };

    assert.equal((await restCreate(ws.readWrite, body)).status, 200);

    const duplicate = await restCreate(ws.readWrite, body);

    assert.equal(duplicate.status, 409);
    assert.equal((await duplicate.json()).error.code, "duplicate-part");

    const badValue = await restCreate(ws.readWrite, {
      ...body,
      catalogNumber: "DUP-2",
      primaryCategoryId: ws.resistorsId,
      attributeValues: { [ws.resistanceId]: "lots" }
    });

    assert.equal(badValue.status, 400);
    assert.equal((await badValue.json()).error.code, "invalid-attribute-value");

    const missing = await restCreate(ws.readWrite, { catalogNumber: "X" });

    assert.equal(missing.status, 400);
    assert.equal((await missing.json()).error.code, "invalid-input");
  });

  test("a read-only token can read parts but not create, change or delete them", async () => {
    const ws = await createPartsWorkspace("parts-403");
    const part = (await (
      await restCreate(ws.readWrite, {
        catalogNumber: "RO-1",
        manufacturerName: "Acme",
        unitId: ws.unitId
      })
    ).json()) as Part;
    const { value: noParts } = await createTestToken(ws.owner.id, ws.workspace.id, {
      access: "custom",
      permissions: ["units:read"]
    });

    const create = await restCreate(ws.readOnly, {
      catalogNumber: "RO-2",
      manufacturerName: "Acme",
      unitId: ws.unitId
    });
    const update = await updatePart(
      jsonRequest(`${base}/parts/${part.id}`, ws.readOnly, "PATCH", { description: "x" }),
      withId(part.id)
    );
    const remove = await deletePart(
      new Request(`${base}/parts/${part.id}`, { method: "DELETE", headers: bearer(ws.readOnly) }),
      withId(part.id)
    );
    const list = await listParts(new Request(`${base}/parts`, { headers: bearer(noParts) }));

    for (const response of [create, update, remove, list]) {
      assert.equal(response.status, 403);
      assert.equal((await response.json()).error.code, "permission-denied");
    }

    assert.equal(await prisma.part.count({ where: { workspaceId: ws.workspace.id } }), 1);
  });

  test("a token for workspace A can neither see nor change workspace B's parts", async () => {
    const a = await createPartsWorkspace("parts-iso-a");
    const b = await createPartsWorkspace("parts-iso-b");
    const partB = (await (
      await restCreate(b.readWrite, {
        catalogNumber: "B-1",
        manufacturerName: "Acme",
        unitId: b.unitId
      })
    ).json()) as Part;

    const listA = (await (
      await listParts(new Request(`${base}/parts`, { headers: bearer(a.readOnly) }))
    ).json()) as PartsPage;

    assert.equal(listA.totalCount, 0);

    const get = await getPart(
      new Request(`${base}/parts/${partB.id}`, { headers: bearer(a.readWrite) }),
      withId(partB.id)
    );
    const update = await updatePart(
      jsonRequest(`${base}/parts/${partB.id}`, a.readWrite, "PATCH", { description: "hijack" }),
      withId(partB.id)
    );
    const remove = await deletePart(
      new Request(`${base}/parts/${partB.id}`, { method: "DELETE", headers: bearer(a.readWrite) }),
      withId(partB.id)
    );

    for (const response of [get, update, remove]) {
      assert.equal(response.status, 404);
      assert.equal((await response.json()).error.code, "part-not-found");
    }

    // B's unit and category are not A's: creating with them fails instead of reaching across.
    const crossUnit = await restCreate(a.readWrite, {
      catalogNumber: "A-1",
      manufacturerName: "Acme",
      unitId: b.unitId
    });

    assert.equal((await crossUnit.json()).error.code, "invalid-unit");

    const crossCategory = await restCreate(a.readWrite, {
      catalogNumber: "A-1",
      manufacturerName: "Acme",
      unitId: a.unitId,
      primaryCategoryId: b.resistorsId
    });

    assert.equal((await crossCategory.json()).error.code, "invalid-category");

    const untouched = await prisma.part.findUniqueOrThrow({ where: { id: partB.id } });

    assert.equal(untouched.description, null);
  });

  test("the path's id wins over an id in the body", async () => {
    const ws = await createPartsWorkspace("parts-path");
    const createOne = async (catalogNumber: string) =>
      (await (
        await restCreate(ws.readWrite, { catalogNumber, manufacturerName: "Acme", unitId: ws.unitId })
      ).json()) as Part;
    const first = await createOne("P-1");
    const second = await createOne("P-2");

    const response = await updatePart(
      jsonRequest(`${base}/parts/${first.id}`, ws.readWrite, "PATCH", {
        id: second.id,
        description: "first"
      }),
      withId(first.id)
    );

    assert.equal(response.status, 200);
    assert.equal(((await response.json()) as Part).id, first.id);
    assert.equal(
      (await prisma.part.findUniqueOrThrow({ where: { id: second.id } })).description,
      null
    );
  });
});

describe("parts MCP tools", () => {
  test("the part tools are offered with their annotations", async () => {
    const ws = await createPartsWorkspace("parts-mcp-list");
    const client = await connect(ws.readOnly);
    const { tools } = await client.listTools();
    const byName = new Map(tools.map((tool) => [tool.name, tool]));

    assert.equal(byName.get("list_parts")?.annotations?.readOnlyHint, true);
    assert.equal(byName.get("get_part")?.annotations?.readOnlyHint, true);
    assert.equal(byName.get("create_part")?.annotations?.readOnlyHint, false);
    assert.equal(byName.get("create_part")?.annotations?.destructiveHint, false);
    assert.equal(byName.get("update_part")?.annotations?.destructiveHint, true);
    assert.equal(byName.get("delete_part")?.annotations?.destructiveHint, true);
    assert.ok(mcpTools.some((tool) => tool.implementation.operation.name === "delete_part"));

    await client.close();
  });

  test("create, get, list, update and delete through the tools", async () => {
    const ws = await createPartsWorkspace("parts-mcp");
    const client = await connect(ws.readWrite);

    const created = await client.callTool({
      name: "create_part",
      arguments: {
        catalogNumber: "MCP-1",
        manufacturerName: "Acme",
        unitId: ws.unitId,
        primaryCategoryId: ws.resistorsId,
        attributeValues: { [ws.resistanceId]: "1k" }
      }
    });

    assert.ok(!created.isError, JSON.stringify(created));

    const part = created.structuredContent as Part;

    assert.equal(part.valueDisplayValue, "1 kΩ");

    const got = await client.callTool({ name: "get_part", arguments: { id: part.id } });

    assert.deepEqual(got.structuredContent, part);

    const listed = await client.callTool({
      name: "list_parts",
      arguments: { search: "MCP-1", attributeFilters: [`${ws.resistanceId}=eq:1k`] }
    });

    assert.deepEqual(
      (listed.structuredContent as PartsPage).items.map((item) => item.id),
      [part.id]
    );

    const updated = await client.callTool({
      name: "update_part",
      arguments: { id: part.id, attributeValues: { [ws.resistanceId]: null } }
    });

    assert.deepEqual((updated.structuredContent as Part).attributeValues, []);

    const deleted = await client.callTool({ name: "delete_part", arguments: { id: part.id } });

    assert.deepEqual(deleted.structuredContent, { id: part.id });

    const again = await client.callTool({ name: "delete_part", arguments: { id: part.id } });

    assert.equal(again.isError, true);
    assert.equal(toolError(again).code, "part-not-found");

    await client.close();
  });

  test("a read-only token's write tools fail with permission-denied", async () => {
    const ws = await createPartsWorkspace("parts-mcp-403");
    const client = await connect(ws.readOnly);

    const result = await client.callTool({
      name: "create_part",
      arguments: { catalogNumber: "RO", manufacturerName: "Acme", unitId: ws.unitId }
    });

    assert.equal(result.isError, true);
    assert.equal(toolError(result).code, "permission-denied");
    assert.equal(await prisma.part.count({ where: { workspaceId: ws.workspace.id } }), 0);

    await client.close();
  });

  test("a token for workspace A gets part-not-found for workspace B's part", async () => {
    const a = await createPartsWorkspace("parts-mcp-iso-a");
    const b = await createPartsWorkspace("parts-mcp-iso-b");
    const partB = (await (
      await restCreate(b.readWrite, { catalogNumber: "B", manufacturerName: "Acme", unitId: b.unitId })
    ).json()) as Part;
    const client = await connect(a.readWrite);

    for (const [name, args] of [
      ["get_part", { id: partB.id }],
      ["update_part", { id: partB.id, description: "x" }],
      ["delete_part", { id: partB.id }]
    ] as const) {
      const result = await client.callTool({ name, arguments: args });

      assert.equal(result.isError, true, name);
      assert.equal(toolError(result).code, "part-not-found", name);
    }

    const listed = await client.callTool({ name: "list_parts", arguments: {} });

    assert.equal((listed.structuredContent as PartsPage).totalCount, 0);
    assert.ok(await prisma.part.findUnique({ where: { id: partB.id } }));

    await client.close();
  });
});
