import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

import { prisma } from "../../src/server/db/prisma";
import { POST as mcpPost } from "../../src/app/api/mcp/route";
import {
  GET as listLocations,
  POST as createLocation
} from "../../src/app/api/v1/locations/route";
import {
  DELETE as deleteLocation,
  GET as getLocation,
  PATCH as updateLocation
} from "../../src/app/api/v1/locations/[id]/route";
import { GET as getLocationStock } from "../../src/app/api/v1/locations/[id]/stock/route";
import { POST as generateLocations } from "../../src/app/api/v1/locations/generate/route";
import {
  GET as listEntries,
  POST as createEntry
} from "../../src/app/api/v1/inventory/entries/route";
import { GET as getBalances } from "../../src/app/api/v1/inventory/balances/route";
import { bearer, createApiTestWorkspace, createTestToken, uniqueSuffix } from "./apiFixtures";

/** Storage locations and inventory in the REST API and MCP (#280). */

const base = "http://localhost/api/v1";

type Location = {
  id: string;
  parentId: string | null;
  name: string;
  path: string;
  isAssignable: boolean;
  isArchived: boolean;
};

type Entry = {
  id: string;
  partId: string;
  entryType: string;
  quantity: string;
  fromLocationId: string | null;
  fromLocationName: string | null;
  toLocationId: string | null;
  toLocationName: string | null;
  note: string | null;
  authorName: string | null;
};

type Balance = { locationId: string; locationPath: string; quantity: string; availableQuantity: string };

type ErrorBody = { error: { code: string; message: string } };

function params(id: string) {
  return { params: Promise.resolve({ id }) };
}

function get(url: string, token: string) {
  return new Request(url, { headers: bearer(token) });
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

async function json<T>(response: Response, status = 200): Promise<T> {
  const body = await response.json();

  assert.equal(response.status, status, JSON.stringify(body));

  return body as T;
}

async function setup(label: string) {
  const { workspace, owner } = await createApiTestWorkspace(label);
  const readWrite = await createTestToken(owner.id, workspace.id, { access: "read-write" });
  const readOnly = await createTestToken(owner.id, workspace.id, { access: "read-only" });
  const locationsOnly = await createTestToken(owner.id, workspace.id, {
    access: "custom",
    permissions: ["locations:read", "locations:write"]
  });
  const suffix = uniqueSuffix();
  const unit = await prisma.unit.create({
    data: {
      workspaceId: workspace.id,
      name: `pcs-${suffix}`,
      normalizedName: `pcs-${suffix}`,
      symbol: "pcs",
      allowsFraction: false
    }
  });
  const maker = await prisma.organization.create({
    data: {
      workspaceId: workspace.id,
      name: `Maker ${suffix}`,
      normalizedName: `maker ${suffix}`,
      roles: { create: [{ role: "manufacturer" }] }
    }
  });
  const part = await prisma.part.create({
    data: {
      workspaceId: workspace.id,
      unitId: unit.id,
      manufacturerId: maker.id,
      catalogNumber: `RES-${suffix}`
    }
  });

  return {
    workspace,
    owner,
    part,
    readWrite: readWrite.value,
    readOnly: readOnly.value,
    locationsOnly: locationsOnly.value
  };
}

async function seedLocation(
  workspaceId: string,
  name: string,
  options: { parentId?: string | null; isAssignable?: boolean } = {}
) {
  return prisma.storageLocation.create({
    data: {
      workspaceId,
      parentId: options.parentId ?? null,
      name,
      normalizedName: name.toLowerCase(),
      isAssignable: options.isAssignable ?? true
    }
  });
}

function postEntry(token: string, body: Record<string, unknown>) {
  return createEntry(jsonRequest(`${base}/inventory/entries`, "POST", token, body));
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

describe("REST /api/v1/locations", () => {
  test("create, get, list, partial update, generate, delete", async () => {
    const { readWrite } = await setup("loc-rest");

    const cabinet = await json<Location>(
      await createLocation(
        jsonRequest(`${base}/locations`, "POST", readWrite, {
          name: "  Cabinet  ",
          isAssignable: false
        })
      )
    );

    assert.equal(cabinet.name, "Cabinet");
    assert.equal(cabinet.parentId, null);
    assert.equal(cabinet.isAssignable, false);

    const drawer = await json<Location>(
      await createLocation(
        jsonRequest(`${base}/locations`, "POST", readWrite, {
          name: "Drawer 1",
          parentId: cabinet.id,
          isAssignable: true
        })
      )
    );

    assert.equal(drawer.path, "Cabinet / Drawer 1");
    assert.deepEqual(
      await json<Location>(await getLocation(get(`${base}/locations/${drawer.id}`, readWrite), params(drawer.id))),
      drawer
    );

    const duplicate = await createLocation(
      jsonRequest(`${base}/locations`, "POST", readWrite, {
        name: "drawer  1",
        parentId: cabinet.id,
        isAssignable: true
      })
    );

    assert.equal(duplicate.status, 409);
    assert.equal(await errorCode(duplicate), "duplicate-location-name");

    const renamed = await json<Location>(
      await updateLocation(
        jsonRequest(`${base}/locations/${drawer.id}`, "PATCH", readWrite, { name: "Drawer A" }),
        params(drawer.id)
      )
    );

    assert.equal(renamed.name, "Drawer A");
    assert.equal(renamed.parentId, cabinet.id, "a field not sent keeps its value");
    assert.equal(renamed.isAssignable, true, "a field not sent keeps its value");
    assert.equal(renamed.path, "Cabinet / Drawer A");

    const cycle = await updateLocation(
      jsonRequest(`${base}/locations/${cabinet.id}`, "PATCH", readWrite, { parentId: drawer.id }),
      params(cabinet.id)
    );

    assert.equal(cycle.status, 409);
    assert.equal(await errorCode(cycle), "location-parent-cycle");

    const level = {
      prefix: "Bin ",
      suffix: "",
      counter: "numeric",
      start: "1",
      count: 3,
      padding: 2,
      isAssignable: true
    };
    const generated = await json<{ created: Location[]; reusedCount: number }>(
      await generateLocations(
        jsonRequest(`${base}/locations/generate`, "POST", readWrite, {
          parentId: drawer.id,
          levels: [level]
        })
      )
    );

    assert.deepEqual(
      generated.created.map((location) => location.path),
      ["Cabinet / Drawer A / Bin 01", "Cabinet / Drawer A / Bin 02", "Cabinet / Drawer A / Bin 03"]
    );
    assert.equal(generated.reusedCount, 0);

    const again = await json<{ created: Location[]; reusedCount: number }>(
      await generateLocations(
        jsonRequest(`${base}/locations/generate`, "POST", readWrite, {
          parentId: drawer.id,
          levels: [{ ...level, count: 4 }]
        })
      )
    );

    assert.deepEqual(
      again.created.map((location) => location.name),
      ["Bin 04"]
    );
    assert.equal(again.reusedCount, 3);

    const invalidLevels = await generateLocations(
      jsonRequest(`${base}/locations/generate`, "POST", readWrite, {
        levels: [{ ...level, count: 0 }]
      })
    );

    assert.equal(invalidLevels.status, 400);
    assert.equal(await errorCode(invalidLevels), "invalid-input");

    const list = await json<{ items: Location[] }>(
      await listLocations(get(`${base}/locations`, readWrite))
    );

    assert.equal(list.items.length, 6);

    const hasChildren = await deleteLocation(
      jsonRequest(`${base}/locations/${cabinet.id}`, "DELETE", readWrite),
      params(cabinet.id)
    );

    assert.equal(hasChildren.status, 409);
    assert.equal(await errorCode(hasChildren), "location-has-children");

    const bin = again.created[0];

    assert.deepEqual(
      await json(
        await deleteLocation(
          jsonRequest(`${base}/locations/${bin.id}`, "DELETE", readWrite),
          params(bin.id)
        )
      ),
      { id: bin.id }
    );
    assert.equal(await prisma.storageLocation.count({ where: { id: bin.id } }), 0);
  });

  test("archiving needs zero stock, and an archived location takes no movement", async () => {
    const { workspace, part, readWrite } = await setup("loc-archive");
    const drawer = await seedLocation(workspace.id, "Drawer");

    await json(await postEntry(readWrite, {
      partId: part.id,
      entryType: "RECEIPT",
      quantity: "5",
      toLocationId: drawer.id
    }));

    const withStock = await updateLocation(
      jsonRequest(`${base}/locations/${drawer.id}`, "PATCH", readWrite, { isArchived: true }),
      params(drawer.id)
    );

    assert.equal(withStock.status, 409);
    assert.equal(await errorCode(withStock), "location-has-stock");

    await json(await postEntry(readWrite, {
      partId: part.id,
      entryType: "ISSUE",
      quantity: "5",
      fromLocationId: drawer.id
    }));

    const archived = await json<Location>(
      await updateLocation(
        jsonRequest(`${base}/locations/${drawer.id}`, "PATCH", readWrite, { isArchived: true }),
        params(drawer.id)
      )
    );

    assert.equal(archived.isArchived, true);

    const intoArchived = await postEntry(readWrite, {
      partId: part.id,
      entryType: "RECEIPT",
      quantity: "1",
      toLocationId: drawer.id
    });

    assert.equal(intoArchived.status, 409);
    assert.equal(await errorCode(intoArchived), "location-archived");

    const inUse = await deleteLocation(
      jsonRequest(`${base}/locations/${drawer.id}`, "DELETE", readWrite),
      params(drawer.id)
    );

    assert.equal(inUse.status, 409);
    assert.equal(await errorCode(inUse), "location-in-use");

    const balances = await json<{ items: Balance[] }>(
      await getBalances(get(`${base}/inventory/balances?partId=${part.id}`, readWrite))
    );

    assert.deepEqual(
      balances.items.map((balance) => [balance.locationId, balance.quantity]),
      [[drawer.id, "0"]],
      "an archived location stays in the stock read views"
    );
  });
});

describe("REST /api/v1/inventory", () => {
  test("record movements, read balances, history pages and location stock", async () => {
    const { workspace, owner, part, readWrite } = await setup("inv-rest");
    const cabinet = await seedLocation(workspace.id, "Cabinet", { isAssignable: false });
    const shelf = await seedLocation(workspace.id, "Shelf", { parentId: cabinet.id });
    const bin = await seedLocation(workspace.id, "Bin", { parentId: shelf.id });

    const receipt = await json<Entry>(
      await postEntry(readWrite, {
        partId: part.id,
        entryType: "RECEIPT",
        quantity: "10",
        toLocationId: shelf.id,
        note: "  first delivery  "
      })
    );

    assert.equal(receipt.entryType, "RECEIPT");
    assert.equal(receipt.quantity, "10");
    assert.equal(receipt.toLocationId, shelf.id);
    assert.equal(receipt.toLocationName, "Shelf");
    assert.equal(receipt.note, "first delivery");
    assert.equal(receipt.authorName, owner.name);

    const transfer = await json<Entry>(await postEntry(readWrite, {
      partId: part.id,
      entryType: "TRANSFER",
      quantity: "4",
      fromLocationId: shelf.id,
      toLocationId: bin.id
    }));
    const issue = await json<Entry>(
      await postEntry(readWrite, {
        partId: part.id,
        entryType: "ISSUE",
        quantity: "1",
        fromLocationId: bin.id
      })
    );

    // Three movements can share a millisecond; spread them so "newest first" is unambiguous.
    for (const [index, id] of [receipt.id, transfer.id, issue.id].entries()) {
      await prisma.inventoryEntry.update({
        where: { id },
        data: { createdAt: new Date(Date.UTC(2026, 0, 1, 12, index)) }
      });
    }

    const balances = await json<{ items: Balance[] }>(
      await getBalances(get(`${base}/inventory/balances?partId=${part.id}`, readWrite))
    );

    assert.deepEqual(
      balances.items.map((balance) => [balance.locationPath, balance.quantity, balance.availableQuantity]),
      [
        ["Cabinet / Shelf", "6", "6"],
        ["Cabinet / Shelf / Bin", "3", "3"]
      ]
    );

    const firstPage = await json<{ items: Entry[]; nextCursor: string | null; totalCount: number }>(
      await listEntries(get(`${base}/inventory/entries?partId=${part.id}&pageSize=2`, readWrite))
    );

    assert.equal(firstPage.totalCount, 3);
    assert.equal(firstPage.items.length, 2);
    assert.equal(firstPage.items[0].id, issue.id, "newest first");
    assert.ok(firstPage.nextCursor);

    const secondPage = await json<{ items: Entry[]; nextCursor: string | null }>(
      await listEntries(
        get(
          `${base}/inventory/entries?partId=${part.id}&pageSize=2&cursor=${firstPage.nextCursor}`,
          readWrite
        )
      )
    );

    assert.deepEqual(
      secondPage.items.map((entry) => entry.id),
      [receipt.id]
    );
    assert.equal(secondPage.nextCursor, null);

    const oldestFirst = await json<{ items: Entry[] }>(
      await listEntries(get(`${base}/inventory/entries?partId=${part.id}&sortDir=asc`, readWrite))
    );

    assert.equal(oldestFirst.items[0].id, receipt.id);

    const direct = await json<{ items: Array<{ locationId: string; quantity: string }> }>(
      await getLocationStock(get(`${base}/locations/${cabinet.id}/stock`, readWrite), params(cabinet.id))
    );

    assert.deepEqual(direct.items, []);

    const subtree = await json<{
      items: Array<{ partId: string; locationPath: string; quantity: string; catalogNumber: string }>;
    }>(
      await getLocationStock(
        get(`${base}/locations/${cabinet.id}/stock?includeSublocations=true`, readWrite),
        params(cabinet.id)
      )
    );

    assert.deepEqual(
      subtree.items.map((item) => [item.locationPath, item.quantity, item.catalogNumber]),
      [
        ["Shelf", "6", part.catalogNumber],
        ["Shelf / Bin", "3", part.catalogNumber]
      ]
    );
  });

  test("domain errors: shape, stock below zero, fractions, organizational location", async () => {
    const { workspace, part, readWrite } = await setup("inv-errors");
    const cabinet = await seedLocation(workspace.id, "Cabinet", { isAssignable: false });
    const drawer = await seedLocation(workspace.id, "Drawer", { parentId: cabinet.id });

    const cases: Array<[Record<string, unknown>, number, string]> = [
      [{ entryType: "RECEIPT", quantity: "1", fromLocationId: drawer.id }, 400, "invalid-entry-shape"],
      [{ entryType: "ISSUE", quantity: "1", fromLocationId: drawer.id }, 409, "insufficient-stock"],
      [{ entryType: "RECEIPT", quantity: "1.5", toLocationId: drawer.id }, 409, "fractional-quantity-not-allowed"],
      [{ entryType: "RECEIPT", quantity: "0", toLocationId: drawer.id }, 400, "invalid-quantity"],
      [{ entryType: "RECEIPT", quantity: "1", toLocationId: cabinet.id }, 409, "location-not-assignable"],
      [{ entryType: "MOVE", quantity: "1", toLocationId: drawer.id }, 400, "invalid-input"]
    ];

    for (const [body, status, code] of cases) {
      const response = await postEntry(readWrite, { partId: part.id, ...body });

      assert.equal(response.status, status, code);
      assert.equal(await errorCode(response), code);
    }

    assert.equal(await prisma.inventoryEntry.count({ where: { partId: part.id } }), 0);
  });

  test("a token without the permission is refused", async () => {
    const { workspace, part, readOnly, locationsOnly } = await setup("inv-denied");
    const drawer = await seedLocation(workspace.id, "Drawer");

    const readable = await getLocation(get(`${base}/locations/${drawer.id}`, readOnly), params(drawer.id));

    assert.equal(readable.status, 200);
    assert.equal(
      (await getBalances(get(`${base}/inventory/balances?partId=${part.id}`, readOnly))).status,
      200
    );

    const denied = [
      await createLocation(
        jsonRequest(`${base}/locations`, "POST", readOnly, { name: "Nope", isAssignable: true })
      ),
      await updateLocation(
        jsonRequest(`${base}/locations/${drawer.id}`, "PATCH", readOnly, { name: "Nope" }),
        params(drawer.id)
      ),
      await deleteLocation(
        jsonRequest(`${base}/locations/${drawer.id}`, "DELETE", readOnly),
        params(drawer.id)
      ),
      await generateLocations(
        jsonRequest(`${base}/locations/generate`, "POST", readOnly, {
          levels: [
            {
              prefix: "",
              suffix: "",
              counter: "numeric",
              start: "1",
              count: 1,
              padding: "auto",
              isAssignable: true
            }
          ]
        })
      ),
      await postEntry(readOnly, {
        partId: part.id,
        entryType: "RECEIPT",
        quantity: "1",
        toLocationId: drawer.id
      }),
      // A token with the locations permissions only reaches no inventory.
      await postEntry(locationsOnly, {
        partId: part.id,
        entryType: "RECEIPT",
        quantity: "1",
        toLocationId: drawer.id
      }),
      await getBalances(get(`${base}/inventory/balances?partId=${part.id}`, locationsOnly)),
      await listEntries(get(`${base}/inventory/entries?partId=${part.id}`, locationsOnly)),
      await getLocationStock(get(`${base}/locations/${drawer.id}/stock`, locationsOnly), params(drawer.id))
    ];

    for (const response of denied) {
      assert.equal(response.status, 403);
      assert.equal(await errorCode(response), "permission-denied");
    }

    assert.equal((await prisma.storageLocation.findUniqueOrThrow({ where: { id: drawer.id } })).name, "Drawer");
    assert.equal(await prisma.storageLocation.count({ where: { workspaceId: workspace.id } }), 1);
    assert.equal(await prisma.inventoryEntry.count({ where: { partId: part.id } }), 0);
  });

  test("a token for workspace A neither sees nor changes workspace B's locations and stock", async () => {
    const a = await setup("inv-iso-a");
    const b = await setup("inv-iso-b");
    const mine = await seedLocation(a.workspace.id, "Mine");
    const theirs = await seedLocation(b.workspace.id, "Theirs");

    const list = await json<{ items: Location[] }>(await listLocations(get(`${base}/locations`, a.readWrite)));

    assert.deepEqual(
      list.items.map((location) => location.id),
      [mine.id]
    );

    const notFound = [
      await getLocation(get(`${base}/locations/${theirs.id}`, a.readWrite), params(theirs.id)),
      await updateLocation(
        jsonRequest(`${base}/locations/${theirs.id}`, "PATCH", a.readWrite, { name: "Taken" }),
        params(theirs.id)
      ),
      await deleteLocation(
        jsonRequest(`${base}/locations/${theirs.id}`, "DELETE", a.readWrite),
        params(theirs.id)
      ),
      await getLocationStock(get(`${base}/locations/${theirs.id}/stock`, a.readWrite), params(theirs.id)),
      await postEntry(a.readWrite, {
        partId: a.part.id,
        entryType: "RECEIPT",
        quantity: "1",
        toLocationId: theirs.id
      })
    ];

    for (const response of notFound) {
      assert.equal(response.status, 404);
      assert.equal(await errorCode(response), "location-not-found");
    }

    const partNotFound = [
      await getBalances(get(`${base}/inventory/balances?partId=${b.part.id}`, a.readWrite)),
      await listEntries(get(`${base}/inventory/entries?partId=${b.part.id}`, a.readWrite)),
      await postEntry(a.readWrite, {
        partId: b.part.id,
        entryType: "RECEIPT",
        quantity: "1",
        toLocationId: mine.id
      })
    ];

    for (const response of partNotFound) {
      assert.equal(response.status, 404);
      assert.equal(await errorCode(response), "part-not-found");
    }

    const foreignParent = await createLocation(
      jsonRequest(`${base}/locations`, "POST", a.readWrite, {
        name: "Child",
        parentId: theirs.id,
        isAssignable: true
      })
    );

    assert.equal(foreignParent.status, 400);
    assert.equal(await errorCode(foreignParent), "invalid-parent-location");

    const foreignGenerate = await generateLocations(
      jsonRequest(`${base}/locations/generate`, "POST", a.readWrite, {
        parentId: theirs.id,
        levels: [
          {
            prefix: "",
            suffix: "",
            counter: "numeric",
            start: "1",
            count: 1,
            padding: "auto",
            isAssignable: true
          }
        ]
      })
    );

    assert.equal(foreignGenerate.status, 400);
    assert.equal(await errorCode(foreignGenerate), "invalid-parent-location");

    assert.equal((await prisma.storageLocation.findUniqueOrThrow({ where: { id: theirs.id } })).name, "Theirs");
    assert.equal(await prisma.storageLocation.count({ where: { parentId: theirs.id } }), 0);
    assert.equal(await prisma.inventoryEntry.count({ where: { workspaceId: b.workspace.id } }), 0);
  });
});

describe("MCP location and inventory tools", () => {
  test("annotations, and a location → movement → balances round trip", async () => {
    const { part, readWrite } = await setup("inv-mcp");
    const client = await connect(readWrite);
    const { tools } = await client.listTools();
    const annotations = Object.fromEntries(tools.map((tool) => [tool.name, tool.annotations]));

    for (const name of [
      "list_locations",
      "get_location",
      "get_location_stock",
      "list_inventory_entries",
      "get_part_stock_balances"
    ]) {
      assert.equal(annotations[name]?.readOnlyHint, true, name);
    }

    for (const name of ["create_location", "generate_locations", "create_inventory_entry"]) {
      assert.equal(annotations[name]?.readOnlyHint, false, name);
      assert.equal(annotations[name]?.destructiveHint, false, name);
    }

    for (const name of ["update_location", "delete_location"]) {
      assert.equal(annotations[name]?.destructiveHint, true, name);
    }

    const created = await client.callTool({
      name: "create_location",
      arguments: { name: "Tray", isAssignable: true }
    });

    assert.ok(!created.isError, JSON.stringify(created));

    const tray = created.structuredContent as Location;
    const moved = await client.callTool({
      name: "create_inventory_entry",
      arguments: { partId: part.id, entryType: "RECEIPT", quantity: "12", toLocationId: tray.id }
    });

    assert.ok(!moved.isError, JSON.stringify(moved));

    const balances = await client.callTool({
      name: "get_part_stock_balances",
      arguments: { partId: part.id }
    });

    assert.deepEqual(
      (balances.structuredContent as { items: Balance[] }).items.map((item) => [item.locationPath, item.quantity]),
      [["Tray", "12"]]
    );

    const stock = await client.callTool({
      name: "get_location_stock",
      arguments: { id: tray.id }
    });

    assert.equal((stock.structuredContent as { items: unknown[] }).items.length, 1);

    const archive = await client.callTool({
      name: "update_location",
      arguments: { id: tray.id, isArchived: true }
    });

    assert.equal(archive.isError, true);
    assert.match(JSON.stringify(archive.content), /location-has-stock/);

    await client.close();
  });

  test("a read-only token cannot call a writing tool, nor reach another workspace", async () => {
    const a = await setup("inv-mcp-a");
    const b = await setup("inv-mcp-b");
    const theirs = await seedLocation(b.workspace.id, "Theirs");
    const client = await connect(a.readOnly);

    const denied = await client.callTool({
      name: "create_inventory_entry",
      arguments: { partId: a.part.id, entryType: "RECEIPT", quantity: "1", toLocationId: theirs.id }
    });

    assert.equal(denied.isError, true);
    assert.match(JSON.stringify(denied.content), /permission-denied/);

    const isolated = await client.callTool({ name: "get_location", arguments: { id: theirs.id } });

    assert.equal(isolated.isError, true);
    assert.match(JSON.stringify(isolated.content), /location-not-found/);

    const foreignPart = await client.callTool({
      name: "list_inventory_entries",
      arguments: { partId: b.part.id }
    });

    assert.equal(foreignPart.isError, true);
    assert.match(JSON.stringify(foreignPart.content), /part-not-found/);

    await client.close();
  });
});
