import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

import { prisma } from "../../src/server/db/prisma";
import { POST as mcpPost } from "../../src/app/api/mcp/route";
import {
  GET as listShoppingLists,
  POST as createShoppingList
} from "../../src/app/api/v1/shopping-lists/route";
import {
  DELETE as deleteShoppingList,
  GET as getShoppingList,
  PATCH as updateShoppingList
} from "../../src/app/api/v1/shopping-lists/[listId]/route";
import { POST as addItem } from "../../src/app/api/v1/shopping-lists/[listId]/items/route";
import { POST as addItems } from "../../src/app/api/v1/shopping-lists/[listId]/items/batch/route";
import {
  DELETE as removeItem,
  PATCH as updateItem
} from "../../src/app/api/v1/shopping-lists/[listId]/items/[itemId]/route";
import { POST as convertToOrder } from "../../src/app/api/v1/shopping-lists/[listId]/convert-to-purchase-order/route";
import { GET as getPartShoppingLists } from "../../src/app/api/v1/parts/[id]/shopping-lists/route";
import { bearer, createApiTestWorkspace, createTestToken, uniqueSuffix } from "./apiFixtures";

/** Shopping lists in the REST API and MCP (#281). */

const base = "http://localhost/api/v1";

type Item = {
  id: string;
  partId: string;
  quantity: string;
  description: string | null;
  orderedInPurchaseOrderId: string | null;
};

type ShoppingList = {
  id: string;
  name: string;
  description: string | null;
  items: Item[];
};

type ErrorBody = { error: { code: string } };

function params(values: Record<string, string>) {
  return { params: Promise.resolve(values) };
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

async function seedPart(workspaceId: string) {
  const suffix = uniqueSuffix();
  const unit = await prisma.unit.create({
    data: {
      workspaceId,
      name: `unit-${suffix}`,
      normalizedName: `unit-${suffix}`,
      symbol: "u",
      allowsFraction: true
    }
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

async function seedSupplier(workspaceId: string) {
  const suffix = uniqueSuffix();

  return prisma.organization.create({
    data: {
      workspaceId,
      name: `Supplier ${suffix}`,
      normalizedName: `supplier ${suffix}`,
      roles: { create: [{ role: "supplier" }] }
    }
  });
}

async function plannedQty(partId: string) {
  const part = await prisma.part.findUniqueOrThrow({ where: { id: partId }, select: { plannedQty: true } });

  return part.plannedQty.toString();
}

async function seedList(workspaceId: string, name = `List ${uniqueSuffix()}`) {
  return prisma.shoppingList.create({ data: { workspaceId, name } });
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

describe("REST /api/v1/shopping-lists", () => {
  test("create, list, update one field, add items, update and remove an item, delete", async () => {
    const { workspace, readWrite } = await setup("sl-rest");
    const part = await seedPart(workspace.id);
    const other = await seedPart(workspace.id);

    const created = await createShoppingList(
      jsonRequest(`${base}/shopping-lists`, "POST", readWrite, {
        name: "  Amplifier build  ",
        description: "For the amp"
      })
    );

    assert.equal(created.status, 200);

    const list = (await created.json()) as ShoppingList;

    assert.equal(list.name, "Amplifier build");
    assert.equal(list.description, "For the amp");
    assert.deepEqual(list.items, []);

    await seedList(workspace.id, "Bench supplies");

    const listed = await listShoppingLists(
      new Request(`${base}/shopping-lists?searchQuery=amp&sortBy=name&pageSize=10`, {
        headers: bearer(readWrite)
      })
    );
    const page = (await listed.json()) as {
      items: Array<{ id: string; itemCount: number }>;
      totalCount: number;
      filteredCount: number;
    };

    assert.equal(listed.status, 200);
    assert.deepEqual(
      page.items.map((item) => item.id),
      [list.id]
    );
    assert.equal(page.totalCount, 2);
    assert.equal(page.filteredCount, 1);

    const renamed = await updateShoppingList(
      jsonRequest(`${base}/shopping-lists/${list.id}`, "PATCH", readWrite, { name: "Amp v2" }),
      params({ listId: list.id })
    );
    const afterRename = (await renamed.json()) as ShoppingList;

    assert.equal(renamed.status, 200);
    assert.equal(afterRename.name, "Amp v2");
    assert.equal(afterRename.description, "For the amp", "a field not sent keeps its value");

    const cleared = await updateShoppingList(
      jsonRequest(`${base}/shopping-lists/${list.id}`, "PATCH", readWrite, { description: null }),
      params({ listId: list.id })
    );

    assert.equal(((await cleared.json()) as ShoppingList).description, null, "null clears the field");

    const added = await addItem(
      jsonRequest(`${base}/shopping-lists/${list.id}/items`, "POST", readWrite, {
        partId: part.id,
        quantity: "10",
        description: "1% tolerance"
      }),
      params({ listId: list.id })
    );

    assert.equal(added.status, 200);

    const item = (await added.json()) as Item;

    assert.equal(item.partId, part.id);
    assert.equal(item.quantity, "10");
    assert.equal(item.description, "1% tolerance");
    assert.equal(await plannedQty(part.id), "10");

    const batch = await addItems(
      jsonRequest(`${base}/shopping-lists/${list.id}/items/batch`, "POST", readWrite, {
        items: [
          { partId: part.id, quantity: "5" },
          { partId: other.id, quantity: "2.5" }
        ]
      }),
      params({ listId: list.id })
    );

    assert.equal(batch.status, 200);

    const batchBody = (await batch.json()) as { addedCount: number; list: ShoppingList };

    assert.equal(batchBody.addedCount, 2);
    assert.equal(batchBody.list.items.length, 2, "a part already on the list is merged into its item");
    assert.equal(batchBody.list.items.find((entry) => entry.id === item.id)?.quantity, "15");
    assert.equal(batchBody.list.items.find((entry) => entry.id === item.id)?.description, "1% tolerance");
    assert.equal(await plannedQty(part.id), "15");
    assert.equal(await plannedQty(other.id), "2.5");

    const updated = await updateItem(
      jsonRequest(`${base}/shopping-lists/${list.id}/items/${item.id}`, "PATCH", readWrite, {
        quantity: "20"
      }),
      params({ listId: list.id, itemId: item.id })
    );
    const afterUpdate = (await updated.json()) as Item;

    assert.equal(updated.status, 200);
    assert.equal(afterUpdate.quantity, "20");
    assert.equal(afterUpdate.description, "1% tolerance", "a field not sent keeps its value");
    assert.equal(await plannedQty(part.id), "20");

    const memberships = await getPartShoppingLists(
      new Request(`${base}/parts/${part.id}/shopping-lists`, { headers: bearer(readWrite) }),
      params({ id: part.id })
    );

    assert.equal(memberships.status, 200);
    assert.deepEqual(await memberships.json(), {
      items: [{ shoppingListId: list.id, shoppingListName: "Amp v2", quantity: "20", notes: "1% tolerance" }]
    });

    const removed = await removeItem(
      new Request(`${base}/shopping-lists/${list.id}/items/${item.id}`, {
        method: "DELETE",
        headers: bearer(readWrite)
      }),
      params({ listId: list.id, itemId: item.id })
    );

    assert.equal(removed.status, 200);
    assert.deepEqual(await removed.json(), { itemId: item.id });
    assert.equal(await plannedQty(part.id), "0");

    const deleted = await deleteShoppingList(
      new Request(`${base}/shopping-lists/${list.id}`, { method: "DELETE", headers: bearer(readWrite) }),
      params({ listId: list.id })
    );

    assert.equal(deleted.status, 200);
    assert.deepEqual(await deleted.json(), { listId: list.id });
    assert.equal(await plannedQty(other.id), "0");
    assert.equal(await prisma.shoppingList.count({ where: { id: list.id } }), 0);
  });

  test("convert items to a new and to an existing draft purchase order", async () => {
    const { workspace, readWrite } = await setup("sl-convert");
    const part = await seedPart(workspace.id);
    const other = await seedPart(workspace.id);
    const supplier = await seedSupplier(workspace.id);
    const list = await seedList(workspace.id);
    const first = await prisma.shoppingListItem.create({
      data: { shoppingListId: list.id, partId: part.id, quantity: "3" }
    });
    const second = await prisma.shoppingListItem.create({
      data: { shoppingListId: list.id, partId: other.id, quantity: "4" }
    });

    const missing = await convertToOrder(
      jsonRequest(`${base}/shopping-lists/${list.id}/convert-to-purchase-order`, "POST", readWrite, {
        itemIds: [first.id]
      }),
      params({ listId: list.id })
    );

    assert.equal(missing.status, 400);
    assert.equal(await errorCode(missing), "supplier-or-order-required");

    const converted = await convertToOrder(
      jsonRequest(`${base}/shopping-lists/${list.id}/convert-to-purchase-order`, "POST", readWrite, {
        itemIds: [first.id],
        supplierId: supplier.id
      }),
      params({ listId: list.id })
    );

    assert.equal(converted.status, 200);

    const { purchaseOrderId } = (await converted.json()) as { purchaseOrderId: string };
    const order = await prisma.purchaseOrder.findUniqueOrThrow({
      where: { id: purchaseOrderId },
      include: { items: true }
    });

    assert.equal(order.workspaceId, workspace.id);
    assert.equal(order.supplierId, supplier.id);
    assert.equal(order.sourceShoppingListId, list.id);
    assert.deepEqual(
      order.items.map((entry) => entry.sourceShoppingListItemId),
      [first.id]
    );

    const again = await convertToOrder(
      jsonRequest(`${base}/shopping-lists/${list.id}/convert-to-purchase-order`, "POST", readWrite, {
        itemIds: [first.id],
        supplierId: supplier.id
      }),
      params({ listId: list.id })
    );

    assert.equal(again.status, 409);
    assert.equal(await errorCode(again), "items-already-on-order");

    const appended = await convertToOrder(
      jsonRequest(`${base}/shopping-lists/${list.id}/convert-to-purchase-order`, "POST", readWrite, {
        itemIds: [second.id],
        purchaseOrderId
      }),
      params({ listId: list.id })
    );

    assert.equal(appended.status, 200);
    assert.deepEqual(await appended.json(), { purchaseOrderId });

    const detail = await getShoppingList(
      new Request(`${base}/shopping-lists/${list.id}`, { headers: bearer(readWrite) }),
      params({ listId: list.id })
    );
    const afterConvert = (await detail.json()) as ShoppingList;

    assert.deepEqual(
      afterConvert.items.map((entry) => entry.orderedInPurchaseOrderId),
      [purchaseOrderId, purchaseOrderId]
    );
  });

  test("domain errors: invalid input, unknown part, unknown item", async () => {
    const { workspace, readWrite } = await setup("sl-errors");
    const list = await seedList(workspace.id);

    const blank = await createShoppingList(
      jsonRequest(`${base}/shopping-lists`, "POST", readWrite, { name: "   " })
    );

    assert.equal(blank.status, 400);
    assert.equal(await errorCode(blank), "name-required");

    const badQuantity = await addItem(
      jsonRequest(`${base}/shopping-lists/${list.id}/items`, "POST", readWrite, {
        partId: "nope",
        quantity: "-1"
      }),
      params({ listId: list.id })
    );

    assert.equal(badQuantity.status, 400);
    assert.equal(await errorCode(badQuantity), "invalid-input");

    const zero = await addItem(
      jsonRequest(`${base}/shopping-lists/${list.id}/items`, "POST", readWrite, {
        partId: "nope",
        quantity: "0"
      }),
      params({ listId: list.id })
    );

    assert.equal(zero.status, 400);
    assert.equal(await errorCode(zero), "invalid-quantity");

    const unknownPart = await addItem(
      jsonRequest(`${base}/shopping-lists/${list.id}/items`, "POST", readWrite, {
        partId: "nope",
        quantity: "1"
      }),
      params({ listId: list.id })
    );

    assert.equal(unknownPart.status, 404);
    assert.equal(await errorCode(unknownPart), "part-not-found");

    const unknownItem = await updateItem(
      jsonRequest(`${base}/shopping-lists/${list.id}/items/nope`, "PATCH", readWrite, { quantity: "1" }),
      params({ listId: list.id, itemId: "nope" })
    );

    assert.equal(unknownItem.status, 404);
    assert.equal(await errorCode(unknownItem), "shopping-list-item-not-found");
  });

  test("a read-only token reads but cannot change anything", async () => {
    const { workspace, readOnly } = await setup("sl-denied");
    const part = await seedPart(workspace.id);
    const supplier = await seedSupplier(workspace.id);
    const list = await seedList(workspace.id, "Kept");
    const item = await prisma.shoppingListItem.create({
      data: { shoppingListId: list.id, partId: part.id, quantity: "1" }
    });

    const read = await getShoppingList(
      new Request(`${base}/shopping-lists/${list.id}`, { headers: bearer(readOnly) }),
      params({ listId: list.id })
    );

    assert.equal(read.status, 200);

    const responses = [
      await createShoppingList(jsonRequest(`${base}/shopping-lists`, "POST", readOnly, { name: "Nope" })),
      await updateShoppingList(
        jsonRequest(`${base}/shopping-lists/${list.id}`, "PATCH", readOnly, { name: "Nope" }),
        params({ listId: list.id })
      ),
      await deleteShoppingList(
        new Request(`${base}/shopping-lists/${list.id}`, { method: "DELETE", headers: bearer(readOnly) }),
        params({ listId: list.id })
      ),
      await addItem(
        jsonRequest(`${base}/shopping-lists/${list.id}/items`, "POST", readOnly, {
          partId: part.id,
          quantity: "1"
        }),
        params({ listId: list.id })
      ),
      await addItems(
        jsonRequest(`${base}/shopping-lists/${list.id}/items/batch`, "POST", readOnly, {
          items: [{ partId: part.id, quantity: "1" }]
        }),
        params({ listId: list.id })
      ),
      await updateItem(
        jsonRequest(`${base}/shopping-lists/${list.id}/items/${item.id}`, "PATCH", readOnly, {
          quantity: "9"
        }),
        params({ listId: list.id, itemId: item.id })
      ),
      await removeItem(
        new Request(`${base}/shopping-lists/${list.id}/items/${item.id}`, {
          method: "DELETE",
          headers: bearer(readOnly)
        }),
        params({ listId: list.id, itemId: item.id })
      ),
      await convertToOrder(
        jsonRequest(`${base}/shopping-lists/${list.id}/convert-to-purchase-order`, "POST", readOnly, {
          itemIds: [item.id],
          supplierId: supplier.id
        }),
        params({ listId: list.id })
      )
    ];

    for (const response of responses) {
      assert.equal(response.status, 403);
      assert.equal(await errorCode(response), "permission-denied");
    }

    const unchanged = await prisma.shoppingListItem.findUniqueOrThrow({ where: { id: item.id } });

    assert.equal(unchanged.quantity.toString(), "1");
    assert.equal(await prisma.purchaseOrder.count({ where: { workspaceId: workspace.id } }), 0);
  });

  test("a token for workspace A neither sees nor changes workspace B's lists", async () => {
    const a = await setup("sl-iso-a");
    const b = await setup("sl-iso-b");
    const partA = await seedPart(a.workspace.id);
    const partB = await seedPart(b.workspace.id);
    const supplierA = await seedSupplier(a.workspace.id);
    const listA = await seedList(a.workspace.id);
    const listB = await seedList(b.workspace.id, "Theirs");
    const itemB = await prisma.shoppingListItem.create({
      data: { shoppingListId: listB.id, partId: partB.id, quantity: "1" }
    });

    const list = await listShoppingLists(
      new Request(`${base}/shopping-lists`, { headers: bearer(a.readWrite) })
    );

    assert.equal(((await list.json()) as { totalCount: number }).totalCount, 1);

    const notFound = [
      await getShoppingList(
        new Request(`${base}/shopping-lists/${listB.id}`, { headers: bearer(a.readWrite) }),
        params({ listId: listB.id })
      ),
      await updateShoppingList(
        jsonRequest(`${base}/shopping-lists/${listB.id}`, "PATCH", a.readWrite, { name: "Taken" }),
        params({ listId: listB.id })
      ),
      await deleteShoppingList(
        new Request(`${base}/shopping-lists/${listB.id}`, { method: "DELETE", headers: bearer(a.readWrite) }),
        params({ listId: listB.id })
      ),
      await addItem(
        jsonRequest(`${base}/shopping-lists/${listB.id}/items`, "POST", a.readWrite, {
          partId: partA.id,
          quantity: "1"
        }),
        params({ listId: listB.id })
      ),
      await addItem(
        jsonRequest(`${base}/shopping-lists/${listA.id}/items`, "POST", a.readWrite, {
          partId: partB.id,
          quantity: "1"
        }),
        params({ listId: listA.id })
      ),
      await updateItem(
        jsonRequest(`${base}/shopping-lists/${listB.id}/items/${itemB.id}`, "PATCH", a.readWrite, {
          quantity: "9"
        }),
        params({ listId: listB.id, itemId: itemB.id })
      ),
      await removeItem(
        new Request(`${base}/shopping-lists/${listB.id}/items/${itemB.id}`, {
          method: "DELETE",
          headers: bearer(a.readWrite)
        }),
        params({ listId: listB.id, itemId: itemB.id })
      ),
      await convertToOrder(
        jsonRequest(`${base}/shopping-lists/${listB.id}/convert-to-purchase-order`, "POST", a.readWrite, {
          itemIds: [itemB.id],
          supplierId: supplierA.id
        }),
        params({ listId: listB.id })
      ),
      await getPartShoppingLists(
        new Request(`${base}/parts/${partB.id}/shopping-lists`, { headers: bearer(a.readWrite) }),
        params({ id: partB.id })
      )
    ];

    for (const response of notFound) {
      assert.equal(response.status, 404);
      assert.match(await errorCode(response), /-not-found$/);
    }

    const unchanged = await prisma.shoppingListItem.findUniqueOrThrow({ where: { id: itemB.id } });

    assert.equal(unchanged.quantity.toString(), "1");
    assert.equal((await prisma.shoppingList.findUniqueOrThrow({ where: { id: listB.id } })).name, "Theirs");
  });
});

describe("MCP shopping-list tools", () => {
  test("annotations, and create → add → get → convert through the tools", async () => {
    const { workspace, readWrite } = await setup("sl-mcp");
    const part = await seedPart(workspace.id);
    const supplier = await seedSupplier(workspace.id);
    const client = await connect(readWrite);
    const { tools } = await client.listTools();
    const annotations = Object.fromEntries(tools.map((tool) => [tool.name, tool.annotations]));

    for (const name of ["list_shopping_lists", "get_shopping_list", "get_part_shopping_lists"]) {
      assert.equal(annotations[name]?.readOnlyHint, true, name);
    }

    for (const name of ["delete_shopping_list", "remove_shopping_list_item", "update_shopping_list_item"]) {
      assert.equal(annotations[name]?.destructiveHint, true, name);
    }

    for (const name of [
      "create_shopping_list",
      "add_shopping_list_item",
      "add_shopping_list_items",
      "convert_shopping_list_to_purchase_order"
    ]) {
      assert.equal(annotations[name]?.readOnlyHint, false, name);
      assert.equal(annotations[name]?.destructiveHint, false, name);
    }

    const created = await client.callTool({ name: "create_shopping_list", arguments: { name: "Via MCP" } });

    assert.ok(!created.isError, JSON.stringify(created));

    const list = created.structuredContent as ShoppingList;
    const added = await client.callTool({
      name: "add_shopping_list_items",
      arguments: { listId: list.id, items: [{ partId: part.id, quantity: "7" }] }
    });

    assert.ok(!added.isError, JSON.stringify(added));

    const fetched = await client.callTool({ name: "get_shopping_list", arguments: { listId: list.id } });
    const items = (fetched.structuredContent as ShoppingList).items;

    assert.deepEqual(
      items.map((item) => [item.partId, item.quantity]),
      [[part.id, "7"]]
    );

    const converted = await client.callTool({
      name: "convert_shopping_list_to_purchase_order",
      arguments: { listId: list.id, itemIds: [items[0].id], supplierId: supplier.id }
    });

    assert.ok(!converted.isError, JSON.stringify(converted));
    assert.ok((converted.structuredContent as { purchaseOrderId: string }).purchaseOrderId);

    await client.close();
  });

  test("a read-only token cannot call a writing tool, nor reach another workspace", async () => {
    const a = await setup("sl-mcp-a");
    const b = await setup("sl-mcp-b");
    const other = await seedList(b.workspace.id);
    const client = await connect(a.readOnly);

    const denied = await client.callTool({ name: "create_shopping_list", arguments: { name: "Nope" } });

    assert.equal(denied.isError, true);
    assert.match(JSON.stringify(denied.content), /permission-denied/);

    const isolated = await client.callTool({ name: "get_shopping_list", arguments: { listId: other.id } });

    assert.equal(isolated.isError, true);
    assert.match(JSON.stringify(isolated.content), /shopping-list-not-found/);

    await client.close();
  });
});
