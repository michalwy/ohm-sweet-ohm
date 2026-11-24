import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

import { prisma } from "../../src/server/db/prisma";
import { toOperationFailure } from "../../src/server/api/execute";
import { ExchangeRateUnavailableError } from "../../src/server/currency/exchangeRates";
import { POST as mcpPost } from "../../src/app/api/mcp/route";
import {
  GET as listOrders,
  POST as createOrder
} from "../../src/app/api/v1/purchase-orders/route";
import { GET as listDrafts } from "../../src/app/api/v1/purchase-orders/drafts/route";
import {
  DELETE as deleteOrder,
  GET as getOrder,
  PATCH as updateOrder
} from "../../src/app/api/v1/purchase-orders/[orderId]/route";
import { POST as addItem } from "../../src/app/api/v1/purchase-orders/[orderId]/items/route";
import { POST as addItems } from "../../src/app/api/v1/purchase-orders/[orderId]/items/batch/route";
import {
  DELETE as removeItem,
  PATCH as updateItem
} from "../../src/app/api/v1/purchase-orders/[orderId]/items/[itemId]/route";
import { POST as addCost } from "../../src/app/api/v1/purchase-orders/[orderId]/additional-costs/route";
import {
  DELETE as deleteCost,
  PATCH as updateCost
} from "../../src/app/api/v1/purchase-orders/[orderId]/additional-costs/[costId]/route";
import { POST as markOrdered } from "../../src/app/api/v1/purchase-orders/[orderId]/mark-ordered/route";
import { POST as receive } from "../../src/app/api/v1/purchase-orders/[orderId]/receive/route";
import { POST as revertToDraft } from "../../src/app/api/v1/purchase-orders/[orderId]/revert-to-draft/route";
import { GET as partHistory } from "../../src/app/api/v1/parts/[id]/purchase-history/route";
import { GET as supplierItem } from "../../src/app/api/v1/parts/[id]/supplier-item/route";
import { GET as searchSuppliers } from "../../src/app/api/v1/suppliers/route";
import {
  GET as getRate,
  PUT as saveRate
} from "../../src/app/api/v1/exchange-rates/route";
import { bearer, createApiTestWorkspace, createTestToken, uniqueSuffix } from "./apiFixtures";

/** Purchase orders in the REST API and MCP (#282). */

const base = "http://localhost/api/v1";

type Item = {
  id: string;
  partId: string | null;
  description: string | null;
  quantity: string;
  receivedQuantity: string;
  supplierSku: string | null;
  unitPrice: string | null;
  lineNetValue: string | null;
  notes: string | null;
};

type Cost = { id: string; label: string; amount: string; taxRate: string | null };

type Order = {
  id: string;
  supplierId: string;
  status: "DRAFT" | "ORDERED" | "RECEIVED";
  orderNumber: string | null;
  supplierOrderNumber: string | null;
  currency: string | null;
  taxRate: string | null;
  priceEntryMode: "net" | "gross";
  orderedAt: string | null;
  notes: string | null;
  totalNetValue: string | null;
  totalNetValuePrimary: string | null;
  additionalCosts: Cost[];
  additionalCostsLocked: boolean;
  items: Item[];
};

type ErrorBody = { error: { code: string; details?: Record<string, string> } };

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

function getRequest(url: string, token: string) {
  return new Request(url, { headers: bearer(token) });
}

async function errorCode(response: Response) {
  return ((await response.json()) as ErrorBody).error.code;
}

async function json<T>(response: Response): Promise<T> {
  const body = await response.text();

  assert.equal(response.status, 200, body);

  return JSON.parse(body) as T;
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

async function seedSupplier(
  workspaceId: string,
  data: { name?: string; currency?: string; defaultTaxRate?: string; defaultPriceEntryMode?: string } = {}
) {
  const name = data.name ?? `Supplier ${uniqueSuffix()}`;

  return prisma.organization.create({
    data: {
      workspaceId,
      name,
      normalizedName: name.toLowerCase(),
      currency: data.currency,
      defaultTaxRate: data.defaultTaxRate,
      defaultPriceEntryMode: data.defaultPriceEntryMode,
      roles: { create: [{ role: "supplier" }] }
    }
  });
}

async function seedLocation(workspaceId: string) {
  const suffix = uniqueSuffix();

  return prisma.storageLocation.create({
    data: { workspaceId, name: `Bin ${suffix}`, normalizedName: `bin-${suffix}`, isAssignable: true }
  });
}

async function seedOrder(workspaceId: string, supplierId: string, partId: string, quantity = "4") {
  return prisma.purchaseOrder.create({
    data: {
      workspaceId,
      supplierId,
      orderNumber: `PO-${uniqueSuffix()}`,
      currency: "EUR",
      items: { create: [{ partId, quantity }] }
    },
    include: { items: true }
  });
}

async function partQuantities(partId: string) {
  const part = await prisma.part.findUniqueOrThrow({
    where: { id: partId },
    select: { plannedQty: true, onOrderQty: true }
  });

  return { planned: part.plannedQty.toString(), onOrder: part.onOrderQty.toString() };
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

describe("REST /api/v1/purchase-orders", () => {
  test("search a supplier, create with its defaults, edit, add items and costs, order, receive", async () => {
    const { workspace, readWrite } = await setup("po-rest");
    const part = await seedPart(workspace.id);
    const other = await seedPart(workspace.id);
    const location = await seedLocation(workspace.id);
    const supplier = await seedSupplier(workspace.id, {
      name: `Reichelt ${uniqueSuffix()}`,
      defaultTaxRate: "23",
      defaultPriceEntryMode: "gross"
    });

    await seedSupplier(workspace.id);

    const found = await json<{ items: Array<{ id: string }> }>(
      await searchSuppliers(getRequest(`${base}/suppliers?searchQuery=reichelt`, readWrite))
    );

    assert.deepEqual(
      found.items.map((entry) => entry.id),
      [supplier.id]
    );

    const created = await json<Order>(
      await createOrder(
        jsonRequest(`${base}/purchase-orders`, "POST", readWrite, {
          supplierId: supplier.id,
          notes: "Bench restock"
        })
      )
    );

    assert.equal(created.status, "DRAFT");
    assert.match(created.orderNumber ?? "", /^PO-\d{4}-\d{3}$/);
    assert.equal(created.currency, "EUR", "the workspace's primary currency when the supplier has none");
    assert.equal(created.taxRate, "23", "the supplier's default tax rate");
    assert.equal(created.priceEntryMode, "gross", "the supplier's default price entry mode");

    const explicit = await json<Order>(
      await createOrder(
        jsonRequest(`${base}/purchase-orders`, "POST", readWrite, {
          supplierId: supplier.id,
          taxRate: null,
          priceEntryMode: "net"
        })
      )
    );

    assert.equal(explicit.taxRate, null, "null means no value, not the default");
    assert.equal(explicit.priceEntryMode, "net");

    const updated = await json<Order>(
      await updateOrder(
        jsonRequest(`${base}/purchase-orders/${created.id}`, "PATCH", readWrite, { supplierOrderNumber: "R-77" }),
        params({ orderId: created.id })
      )
    );

    assert.equal(updated.supplierOrderNumber, "R-77");
    assert.equal(updated.notes, "Bench restock", "a field not sent keeps its value");
    assert.equal(updated.orderNumber, created.orderNumber);
    assert.equal(updated.currency, "EUR");

    const added = await json<{ itemId: string; purchaseOrder: Order }>(
      await addItem(
        jsonRequest(`${base}/purchase-orders/${created.id}/items`, "POST", readWrite, {
          partId: part.id,
          quantity: "3",
          lineNetTotal: "10",
          supplierSku: "R-123",
          notes: "1%"
        }),
        params({ orderId: created.id })
      )
    );
    const item = added.purchaseOrder.items.find((entry) => entry.id === added.itemId);

    assert.ok(item);
    assert.equal(item.lineNetValue, "10.00", "the line total is kept exactly");
    assert.equal(item.unitPrice, "3.3333333333", "the unit price is derived from the line total");
    assert.deepEqual(await partQuantities(part.id), { planned: "3", onOrder: "0" });

    const noted = await json<Order>(
      await updateItem(
        jsonRequest(`${base}/purchase-orders/${created.id}/items/${item.id}`, "PATCH", readWrite, {
          notes: "0.1%"
        }),
        params({ orderId: created.id, itemId: item.id })
      )
    );
    const afterNote = noted.items.find((entry) => entry.id === item.id);

    assert.equal(afterNote?.notes, "0.1%");
    assert.equal(afterNote?.supplierSku, "R-123", "a field not sent keeps its value");
    assert.equal(afterNote?.lineNetValue, "10.00", "the line total is not recomputed");

    const batch = await json<{ addedCount: number; purchaseOrder: Order }>(
      await addItems(
        jsonRequest(`${base}/purchase-orders/${created.id}/items/batch`, "POST", readWrite, {
          items: [
            { partId: part.id, quantity: "2" },
            { partId: other.id, quantity: "5" }
          ]
        }),
        params({ orderId: created.id })
      )
    );

    assert.equal(batch.addedCount, 2);
    assert.equal(batch.purchaseOrder.items.length, 2, "a part already on the order is merged into its item");
    const merged = batch.purchaseOrder.items.find((entry) => entry.id === item.id);
    assert.equal(merged?.quantity, "5");
    assert.equal(merged?.unitPrice, "3.3333333333", "merging keeps the line's unit price (#310)");
    assert.equal(merged?.supplierSku, "R-123", "merging keeps the line's supplier SKU (#310)");
    assert.equal(merged?.notes, "0.1%", "merging keeps the line's notes (#310)");
    assert.equal(merged?.lineNetValue, "16.67", "the line total follows the kept unit price");
    assert.deepEqual(await partQuantities(other.id), { planned: "5", onOrder: "0" });

    const withCost = await json<{ costId: string; purchaseOrder: Order }>(
      await addCost(
        jsonRequest(`${base}/purchase-orders/${created.id}/additional-costs`, "POST", readWrite, {
          label: "Shipping",
          amount: "5",
          taxRate: "8"
        }),
        params({ orderId: created.id })
      )
    );

    assert.equal(withCost.purchaseOrder.additionalCosts.length, 1);

    const relabelled = await json<Order>(
      await updateCost(
        jsonRequest(
          `${base}/purchase-orders/${created.id}/additional-costs/${withCost.costId}`,
          "PATCH",
          readWrite,
          { label: "Courier" }
        ),
        params({ orderId: created.id, costId: withCost.costId })
      )
    );

    assert.deepEqual(
      relabelled.additionalCosts.map(({ label, amount, taxRate }) => ({ label, amount, taxRate })),
      [{ label: "Courier", amount: "5.00", taxRate: "8" }],
      "fields not sent keep their values"
    );

    const drafts = await json<{ items: Array<{ id: string }> }>(
      await listDrafts(getRequest(`${base}/purchase-orders/drafts`, readWrite))
    );

    assert.ok(drafts.items.some((entry) => entry.id === created.id));

    const listed = await json<{ items: Array<{ id: string }>; totalCount: number; filteredCount: number }>(
      await listOrders(
        getRequest(`${base}/purchase-orders?status=DRAFT&supplierId=${supplier.id}&searchQuery=bench`, readWrite)
      )
    );

    assert.deepEqual(
      listed.items.map((entry) => entry.id),
      [created.id]
    );
    assert.equal(listed.totalCount, 2);
    assert.equal(listed.filteredCount, 1);

    const ordered = await json<Order>(
      await markOrdered(
        jsonRequest(`${base}/purchase-orders/${created.id}/mark-ordered`, "POST", readWrite),
        params({ orderId: created.id })
      )
    );

    assert.equal(ordered.status, "ORDERED");
    assert.ok(ordered.orderedAt);
    assert.deepEqual(await partQuantities(part.id), { planned: "0", onOrder: "5" });

    const reverted = await json<Order>(
      await revertToDraft(
        jsonRequest(`${base}/purchase-orders/${created.id}/revert-to-draft`, "POST", readWrite),
        params({ orderId: created.id })
      )
    );

    assert.equal(reverted.status, "DRAFT");
    assert.equal(reverted.orderedAt, null);
    assert.deepEqual(await partQuantities(part.id), { planned: "5", onOrder: "0" });

    await markOrdered(
      jsonRequest(`${base}/purchase-orders/${created.id}/mark-ordered`, "POST", readWrite),
      params({ orderId: created.id })
    );

    const redated = await json<Order>(
      await updateOrder(
        jsonRequest(`${base}/purchase-orders/${created.id}`, "PATCH", readWrite, {
          orderedAt: "2026-01-02T10:00:00.000Z"
        }),
        params({ orderId: created.id })
      )
    );

    assert.equal(redated.orderedAt, "2026-01-02T10:00:00.000Z");
    assert.equal(redated.supplierOrderNumber, "R-77");

    const otherItem = ordered.items.find((entry) => entry.partId === other.id);

    assert.ok(otherItem);

    const partial = await json<Order>(
      await receive(
        jsonRequest(`${base}/purchase-orders/${created.id}/receive`, "POST", readWrite, {
          items: [{ itemId: item.id, quantity: "2", locationId: location.id }]
        }),
        params({ orderId: created.id })
      )
    );

    assert.equal(partial.status, "ORDERED");
    assert.equal(partial.items.find((entry) => entry.id === item.id)?.receivedQuantity, "2");
    assert.equal(partial.additionalCostsLocked, true);

    const locked = await updateCost(
      jsonRequest(
        `${base}/purchase-orders/${created.id}/additional-costs/${withCost.costId}`,
        "PATCH",
        readWrite,
        { amount: "6" }
      ),
      params({ orderId: created.id, costId: withCost.costId })
    );

    assert.equal(locked.status, 409);
    assert.equal(await errorCode(locked), "additional-costs-locked-after-receive");

    const full = await json<Order>(
      await receive(
        jsonRequest(`${base}/purchase-orders/${created.id}/receive`, "POST", readWrite, {
          items: [
            { itemId: item.id, quantity: "3", locationId: location.id },
            { itemId: otherItem.id, quantity: "5", locationId: location.id }
          ]
        }),
        params({ orderId: created.id })
      )
    );

    assert.equal(full.status, "RECEIVED");
    assert.deepEqual(await partQuantities(part.id), { planned: "0", onOrder: "0" });

    const receipts = await prisma.inventoryEntry.findMany({
      where: { partId: part.id, entryType: "RECEIPT" },
      select: { quantity: true, toLocationId: true }
    });

    assert.deepEqual(
      receipts.map((entry) => [entry.quantity.toString(), entry.toLocationId]).sort(),
      [
        ["2", location.id],
        ["3", location.id]
      ]
    );

    const history = await json<{ items: Array<{ orderId: string; quantity: string; status: string }> }>(
      await partHistory(getRequest(`${base}/parts/${part.id}/purchase-history`, readWrite), params({ id: part.id }))
    );

    assert.deepEqual(history.items, [
      { ...history.items[0], orderId: created.id, quantity: "5", status: "RECEIVED" }
    ]);

    const tooLate = await updateOrder(
      jsonRequest(`${base}/purchase-orders/${created.id}`, "PATCH", readWrite, { notes: "late" }),
      params({ orderId: created.id })
    );

    assert.equal(tooLate.status, 409);
    assert.equal(await errorCode(tooLate), "order-already-received");

    const undeletable = await deleteOrder(
      new Request(`${base}/purchase-orders/${created.id}`, { method: "DELETE", headers: bearer(readWrite) }),
      params({ orderId: created.id })
    );

    assert.equal(undeletable.status, 409);
    assert.equal(await errorCode(undeletable), "received-orders-cannot-be-deleted");
  });

  test("remove an item, delete a cost, delete a draft order", async () => {
    const { workspace, readWrite } = await setup("po-delete");
    const part = await seedPart(workspace.id);
    const supplier = await seedSupplier(workspace.id);
    const created = await json<Order>(
      await createOrder(jsonRequest(`${base}/purchase-orders`, "POST", readWrite, { supplierId: supplier.id }))
    );
    const { itemId } = await json<{ itemId: string }>(
      await addItem(
        jsonRequest(`${base}/purchase-orders/${created.id}/items`, "POST", readWrite, {
          description: "Solder wick",
          quantity: "2",
          unitPrice: "3.5"
        }),
        params({ orderId: created.id })
      )
    );
    const { costId } = await json<{ costId: string }>(
      await addCost(
        jsonRequest(`${base}/purchase-orders/${created.id}/additional-costs`, "POST", readWrite, {
          label: "Shipping",
          amount: "4"
        }),
        params({ orderId: created.id })
      )
    );

    await addItem(
      jsonRequest(`${base}/purchase-orders/${created.id}/items`, "POST", readWrite, {
        partId: part.id,
        quantity: "6"
      }),
      params({ orderId: created.id })
    );

    const withoutCost = await json<Order>(
      await deleteCost(
        new Request(`${base}/purchase-orders/${created.id}/additional-costs/${costId}`, {
          method: "DELETE",
          headers: bearer(readWrite)
        }),
        params({ orderId: created.id, costId })
      )
    );

    assert.deepEqual(withoutCost.additionalCosts, []);
    assert.equal(withoutCost.totalNetValue, "7.00");

    const withoutItem = await json<Order>(
      await removeItem(
        new Request(`${base}/purchase-orders/${created.id}/items/${itemId}`, {
          method: "DELETE",
          headers: bearer(readWrite)
        }),
        params({ orderId: created.id, itemId })
      )
    );

    assert.deepEqual(
      withoutItem.items.map((entry) => entry.partId),
      [part.id]
    );

    const deleted = await deleteOrder(
      new Request(`${base}/purchase-orders/${created.id}`, { method: "DELETE", headers: bearer(readWrite) }),
      params({ orderId: created.id })
    );

    assert.deepEqual(await json(deleted), { orderId: created.id });
    assert.deepEqual(await partQuantities(part.id), { planned: "0", onOrder: "0" });
    assert.equal(await prisma.purchaseOrder.count({ where: { id: created.id } }), 0);
  });

  test("exchange rates: save a manual rate, read it, order in a foreign currency with it", async () => {
    const { workspace, readWrite } = await setup("po-rates");
    const part = await seedPart(workspace.id);
    const supplier = await seedSupplier(workspace.id, { currency: "USD" });
    const today = new Date().toISOString().slice(0, 10);

    const saved = await json(
      await saveRate(
        jsonRequest(`${base}/exchange-rates`, "PUT", readWrite, { from: "USD", to: "EUR", date: today, rate: "0.5" })
      )
    );

    assert.deepEqual(saved, { from: "USD", to: "EUR", date: today, rate: "0.5" });

    const read = await json(
      await getRate(getRequest(`${base}/exchange-rates?from=USD&to=EUR&date=${today}`, readWrite))
    );

    assert.deepEqual(read, { from: "USD", to: "EUR", date: today, rate: "0.5" });

    const same = await json(
      await getRate(getRequest(`${base}/exchange-rates?from=EUR&to=EUR&date=${today}`, readWrite))
    );

    assert.deepEqual(same, { from: "EUR", to: "EUR", date: today, rate: "1" });

    const badDate = await getRate(getRequest(`${base}/exchange-rates?from=USD&to=EUR&date=2026-02-31`, readWrite));

    assert.equal(badDate.status, 400);
    assert.equal(await errorCode(badDate), "invalid-date");

    const badRate = await saveRate(
      jsonRequest(`${base}/exchange-rates`, "PUT", readWrite, { from: "USD", to: "EUR", date: today, rate: "0" })
    );

    assert.equal(badRate.status, 400);
    assert.equal(await errorCode(badRate), "invalid-exchange-rate");

    const order = await json<Order>(
      await createOrder(jsonRequest(`${base}/purchase-orders`, "POST", readWrite, { supplierId: supplier.id }))
    );

    assert.equal(order.currency, "USD", "the supplier's currency");

    await addItem(
      jsonRequest(`${base}/purchase-orders/${order.id}/items`, "POST", readWrite, {
        partId: part.id,
        quantity: "2",
        unitPrice: "10"
      }),
      params({ orderId: order.id })
    );

    const ordered = await json<Order>(
      await markOrdered(
        jsonRequest(`${base}/purchase-orders/${order.id}/mark-ordered`, "POST", readWrite),
        params({ orderId: order.id })
      )
    );

    assert.equal(ordered.totalNetValue, "20.00");
    assert.equal(ordered.totalNetValuePrimary, "10.00", "converted at the saved rate");
  });

  test("a missing exchange rate is reported with the pair and day to save", () => {
    const failure = toOperationFailure(new ExchangeRateUnavailableError("USD", "EUR", "2026-01-02"));

    assert.equal(failure.status, 409);
    assert.deepEqual(failure.error, {
      code: "exchange-rate-unavailable",
      message: "The operation failed: exchange rate unavailable.",
      details: { from: "USD", to: "EUR", date: "2026-01-02" }
    });
  });

  test("supplier lookup without an active integration, and domain errors", async () => {
    const { workspace, readWrite } = await setup("po-errors");
    const part = await seedPart(workspace.id);
    const supplier = await seedSupplier(workspace.id);

    const lookup = await json(
      await supplierItem(getRequest(`${base}/parts/${part.id}/supplier-item`, readWrite), params({ id: part.id }))
    );

    assert.deepEqual(lookup, { ok: false, supplierSku: null, reason: "no-provider" });

    const notASupplier = await createOrder(
      jsonRequest(`${base}/purchase-orders`, "POST", readWrite, { supplierId: "nope" })
    );

    assert.equal(notASupplier.status, 404);
    assert.equal(await errorCode(notASupplier), "supplier-not-found");

    const order = await json<Order>(
      await createOrder(jsonRequest(`${base}/purchase-orders`, "POST", readWrite, { supplierId: supplier.id }))
    );

    const nothing = await addItem(
      jsonRequest(`${base}/purchase-orders/${order.id}/items`, "POST", readWrite, { quantity: "1" }),
      params({ orderId: order.id })
    );

    assert.equal(nothing.status, 400);
    assert.equal(await errorCode(nothing), "missing-required-fields");

    const empty = await markOrdered(
      jsonRequest(`${base}/purchase-orders/${order.id}/mark-ordered`, "POST", readWrite),
      params({ orderId: order.id })
    );

    assert.equal(empty.status, 409);
    assert.equal(await errorCode(empty), "order-has-no-items");

    const notOrdered = await revertToDraft(
      jsonRequest(`${base}/purchase-orders/${order.id}/revert-to-draft`, "POST", readWrite),
      params({ orderId: order.id })
    );

    assert.equal(notOrdered.status, 409);
    assert.equal(await errorCode(notOrdered), "order-not-ordered");

    const draftDate = await updateOrder(
      jsonRequest(`${base}/purchase-orders/${order.id}`, "PATCH", readWrite, { orderedAt: "2026-01-02T00:00:00Z" }),
      params({ orderId: order.id })
    );

    assert.equal(draftDate.status, 409, "the order date is set only on an ordered order");
    assert.equal(await errorCode(draftDate), "order-not-ordered");

    const unknownItem = await updateItem(
      jsonRequest(`${base}/purchase-orders/${order.id}/items/nope`, "PATCH", readWrite, { quantity: "1" }),
      params({ orderId: order.id, itemId: "nope" })
    );

    assert.equal(unknownItem.status, 404);
    assert.equal(await errorCode(unknownItem), "purchase-order-item-not-found");

    const badStatus = await listOrders(getRequest(`${base}/purchase-orders?status=LOST`, readWrite));

    assert.equal(badStatus.status, 400);
    assert.equal(await errorCode(badStatus), "invalid-input");
  });

  test("a read-only token reads but cannot change anything", async () => {
    const { workspace, readOnly } = await setup("po-denied");
    const part = await seedPart(workspace.id);
    const supplier = await seedSupplier(workspace.id);
    const order = await seedOrder(workspace.id, supplier.id, part.id);
    const [item] = order.items;
    const cost = await prisma.purchaseOrderAdditionalCost.create({
      data: { purchaseOrderId: order.id, label: "Shipping", amount: "1" }
    });
    const today = new Date().toISOString().slice(0, 10);

    for (const response of [
      await getOrder(getRequest(`${base}/purchase-orders/${order.id}`, readOnly), params({ orderId: order.id })),
      await listOrders(getRequest(`${base}/purchase-orders`, readOnly)),
      await listDrafts(getRequest(`${base}/purchase-orders/drafts`, readOnly)),
      await searchSuppliers(getRequest(`${base}/suppliers`, readOnly)),
      await partHistory(getRequest(`${base}/parts/${part.id}/purchase-history`, readOnly), params({ id: part.id }))
    ]) {
      assert.equal(response.status, 200);
    }

    const orderPath = `${base}/purchase-orders/${order.id}`;
    const orderParams = params({ orderId: order.id });
    const responses = [
      await createOrder(jsonRequest(`${base}/purchase-orders`, "POST", readOnly, { supplierId: supplier.id })),
      await updateOrder(jsonRequest(orderPath, "PATCH", readOnly, { notes: "x" }), orderParams),
      await deleteOrder(new Request(orderPath, { method: "DELETE", headers: bearer(readOnly) }), orderParams),
      await addItem(jsonRequest(`${orderPath}/items`, "POST", readOnly, { partId: part.id, quantity: "1" }), orderParams),
      await addItems(
        jsonRequest(`${orderPath}/items/batch`, "POST", readOnly, { items: [{ partId: part.id, quantity: "1" }] }),
        orderParams
      ),
      await updateItem(
        jsonRequest(`${orderPath}/items/${item.id}`, "PATCH", readOnly, { quantity: "9" }),
        params({ orderId: order.id, itemId: item.id })
      ),
      await removeItem(
        new Request(`${orderPath}/items/${item.id}`, { method: "DELETE", headers: bearer(readOnly) }),
        params({ orderId: order.id, itemId: item.id })
      ),
      await addCost(jsonRequest(`${orderPath}/additional-costs`, "POST", readOnly, { label: "x", amount: "1" }), orderParams),
      await updateCost(
        jsonRequest(`${orderPath}/additional-costs/${cost.id}`, "PATCH", readOnly, { label: "y" }),
        params({ orderId: order.id, costId: cost.id })
      ),
      await deleteCost(
        new Request(`${orderPath}/additional-costs/${cost.id}`, { method: "DELETE", headers: bearer(readOnly) }),
        params({ orderId: order.id, costId: cost.id })
      ),
      await markOrdered(jsonRequest(`${orderPath}/mark-ordered`, "POST", readOnly), orderParams),
      await receive(
        jsonRequest(`${orderPath}/receive`, "POST", readOnly, {
          items: [{ itemId: item.id, quantity: "1", locationId: null }]
        }),
        orderParams
      ),
      await revertToDraft(jsonRequest(`${orderPath}/revert-to-draft`, "POST", readOnly), orderParams),
      await saveRate(
        jsonRequest(`${base}/exchange-rates`, "PUT", readOnly, { from: "USD", to: "EUR", date: today, rate: "9" })
      )
    ];

    for (const response of responses) {
      assert.equal(response.status, 403);
      assert.equal(await errorCode(response), "permission-denied");
    }

    const unchanged = await prisma.purchaseOrder.findUniqueOrThrow({
      where: { id: order.id },
      include: { items: true, additionalCosts: true }
    });

    assert.equal(unchanged.status, "DRAFT");
    assert.equal(unchanged.items[0].quantity.toString(), "4");
    assert.equal(unchanged.additionalCosts[0].label, "Shipping");
    assert.equal(await prisma.purchaseOrder.count({ where: { workspaceId: workspace.id } }), 1);
  });

  test("a token for workspace A neither sees nor changes workspace B's orders", async () => {
    const a = await setup("po-iso-a");
    const b = await setup("po-iso-b");
    const partA = await seedPart(a.workspace.id);
    const partB = await seedPart(b.workspace.id);
    const supplierA = await seedSupplier(a.workspace.id);
    const supplierB = await seedSupplier(b.workspace.id);
    const orderA = await seedOrder(a.workspace.id, supplierA.id, partA.id);
    const orderB = await seedOrder(b.workspace.id, supplierB.id, partB.id);
    const [itemB] = orderB.items;
    const costB = await prisma.purchaseOrderAdditionalCost.create({
      data: { purchaseOrderId: orderB.id, label: "Shipping", amount: "1" }
    });
    const token = a.readWrite;

    const list = await json<{ items: Array<{ id: string }>; totalCount: number }>(
      await listOrders(getRequest(`${base}/purchase-orders`, token))
    );

    assert.deepEqual(
      list.items.map((entry) => entry.id),
      [orderA.id]
    );

    const drafts = await json<{ items: Array<{ id: string }> }>(
      await listDrafts(getRequest(`${base}/purchase-orders/drafts`, token))
    );

    assert.deepEqual(
      drafts.items.map((entry) => entry.id),
      [orderA.id]
    );

    const suppliers = await json<{ items: Array<{ id: string }> }>(
      await searchSuppliers(getRequest(`${base}/suppliers`, token))
    );

    assert.deepEqual(
      suppliers.items.map((entry) => entry.id),
      [supplierA.id]
    );

    const pathB = `${base}/purchase-orders/${orderB.id}`;
    const paramsB = params({ orderId: orderB.id });
    const notFound = [
      await getOrder(getRequest(pathB, token), paramsB),
      await updateOrder(jsonRequest(pathB, "PATCH", token, { notes: "taken" }), paramsB),
      await deleteOrder(new Request(pathB, { method: "DELETE", headers: bearer(token) }), paramsB),
      await addItem(jsonRequest(`${pathB}/items`, "POST", token, { partId: partA.id, quantity: "1" }), paramsB),
      await addItem(
        jsonRequest(`${base}/purchase-orders/${orderA.id}/items`, "POST", token, { partId: partB.id, quantity: "1" }),
        params({ orderId: orderA.id })
      ),
      await addItems(
        jsonRequest(`${pathB}/items/batch`, "POST", token, { items: [{ partId: partA.id, quantity: "1" }] }),
        paramsB
      ),
      await updateItem(
        jsonRequest(`${pathB}/items/${itemB.id}`, "PATCH", token, { quantity: "9" }),
        params({ orderId: orderB.id, itemId: itemB.id })
      ),
      await removeItem(
        new Request(`${pathB}/items/${itemB.id}`, { method: "DELETE", headers: bearer(token) }),
        params({ orderId: orderB.id, itemId: itemB.id })
      ),
      await addCost(jsonRequest(`${pathB}/additional-costs`, "POST", token, { label: "x", amount: "1" }), paramsB),
      await updateCost(
        jsonRequest(`${pathB}/additional-costs/${costB.id}`, "PATCH", token, { label: "y" }),
        params({ orderId: orderB.id, costId: costB.id })
      ),
      await deleteCost(
        new Request(`${pathB}/additional-costs/${costB.id}`, { method: "DELETE", headers: bearer(token) }),
        params({ orderId: orderB.id, costId: costB.id })
      ),
      await markOrdered(jsonRequest(`${pathB}/mark-ordered`, "POST", token), paramsB),
      await receive(
        jsonRequest(`${pathB}/receive`, "POST", token, { items: [{ itemId: itemB.id, quantity: "1", locationId: null }] }),
        paramsB
      ),
      await revertToDraft(jsonRequest(`${pathB}/revert-to-draft`, "POST", token), paramsB),
      await createOrder(jsonRequest(`${base}/purchase-orders`, "POST", token, { supplierId: supplierB.id })),
      await partHistory(getRequest(`${base}/parts/${partB.id}/purchase-history`, token), params({ id: partB.id })),
      await supplierItem(getRequest(`${base}/parts/${partB.id}/supplier-item`, token), params({ id: partB.id }))
    ];

    for (const response of notFound) {
      assert.equal(response.status, 404);
      assert.match(await errorCode(response), /-not-found$/);
    }

    const unchanged = await prisma.purchaseOrder.findUniqueOrThrow({
      where: { id: orderB.id },
      include: { items: true, additionalCosts: true }
    });

    assert.equal(unchanged.status, "DRAFT");
    assert.equal(unchanged.notes, null);
    assert.equal(unchanged.items.length, 1);
    assert.equal(unchanged.items[0].quantity.toString(), "4");
    assert.equal(unchanged.additionalCosts[0].label, "Shipping");
  });
});

describe("MCP purchase-order tools", () => {
  test("annotations, and create → add → get → order through the tools", async () => {
    const { workspace, readWrite } = await setup("po-mcp");
    const part = await seedPart(workspace.id);
    const supplier = await seedSupplier(workspace.id);
    const client = await connect(readWrite);
    const { tools } = await client.listTools();
    const annotations = Object.fromEntries(tools.map((tool) => [tool.name, tool.annotations]));

    for (const name of [
      "list_purchase_orders",
      "get_purchase_order",
      "list_draft_purchase_orders",
      "get_part_purchase_history",
      "search_suppliers",
      "lookup_supplier_item",
      "get_exchange_rate"
    ]) {
      assert.equal(annotations[name]?.readOnlyHint, true, name);
    }

    for (const name of [
      "update_purchase_order",
      "delete_purchase_order",
      "update_purchase_order_item",
      "remove_purchase_order_item",
      "update_purchase_order_cost",
      "delete_purchase_order_cost",
      "revert_purchase_order_to_draft",
      "save_exchange_rate"
    ]) {
      assert.equal(annotations[name]?.destructiveHint, true, name);
    }

    for (const name of [
      "create_purchase_order",
      "add_purchase_order_item",
      "add_purchase_order_items",
      "add_purchase_order_cost",
      "mark_purchase_order_ordered",
      "receive_purchase_order_items"
    ]) {
      assert.equal(annotations[name]?.readOnlyHint, false, name);
      assert.equal(annotations[name]?.destructiveHint, false, name);
    }

    const created = await client.callTool({
      name: "create_purchase_order",
      arguments: { supplierId: supplier.id }
    });

    assert.ok(!created.isError, JSON.stringify(created));

    const order = created.structuredContent as Order;
    const added = await client.callTool({
      name: "add_purchase_order_items",
      arguments: { orderId: order.id, items: [{ partId: part.id, quantity: "7" }] }
    });

    assert.ok(!added.isError, JSON.stringify(added));

    const ordered = await client.callTool({ name: "mark_purchase_order_ordered", arguments: { orderId: order.id } });

    assert.ok(!ordered.isError, JSON.stringify(ordered));

    const fetched = await client.callTool({ name: "get_purchase_order", arguments: { orderId: order.id } });
    const detail = fetched.structuredContent as Order;

    assert.equal(detail.status, "ORDERED");
    assert.deepEqual(
      detail.items.map((item) => [item.partId, item.quantity]),
      [[part.id, "7"]]
    );

    await client.close();
  });

  test("a read-only token cannot call a writing tool, nor reach another workspace", async () => {
    const a = await setup("po-mcp-a");
    const b = await setup("po-mcp-b");
    const partB = await seedPart(b.workspace.id);
    const supplierA = await seedSupplier(a.workspace.id);
    const supplierB = await seedSupplier(b.workspace.id);
    const orderB = await seedOrder(b.workspace.id, supplierB.id, partB.id);
    const client = await connect(a.readOnly);

    const denied = await client.callTool({
      name: "create_purchase_order",
      arguments: { supplierId: supplierA.id }
    });

    assert.equal(denied.isError, true);
    assert.match(JSON.stringify(denied.content), /permission-denied/);

    const isolated = await client.callTool({ name: "get_purchase_order", arguments: { orderId: orderB.id } });

    assert.equal(isolated.isError, true);
    assert.match(JSON.stringify(isolated.content), /purchase-order-not-found/);

    await client.close();
  });
});
