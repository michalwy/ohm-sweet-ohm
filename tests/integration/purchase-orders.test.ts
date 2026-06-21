import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { randomBytes } from "node:crypto";

import { prisma } from "../../src/server/db/prisma";
import {
  createPurchaseOrder,
  updatePurchaseOrder,
  deletePurchaseOrder,
  addOrderItem,
  updateOrderItem,
  removeOrderItem,
  markOrdered,
  receiveItems,
  revertOrderToDraft,
  getPurchaseOrders,
  getPurchaseOrderDetail
} from "../../src/server/purchase-orders/purchaseOrderMutations";
import {
  createShoppingList,
  addShoppingListItem,
  convertShoppingListToOrder
} from "../../src/server/shopping-lists/shoppingListMutations";

function uniqueSuffix(label: string) {
  return `${label}-${randomBytes(4).toString("hex")}`;
}

async function createFixture(suffix: string) {
  const normalized = suffix.toLowerCase().replace(/[^a-z0-9]+/g, "-");

  const workspace = await prisma.workspace.create({
    data: {
      name: `PO Workspace ${suffix}`,
      slug: `po-workspace-${normalized}`
    }
  });

  const unit = await prisma.unit.create({
    data: {
      workspaceId: workspace.id,
      name: `PO Unit ${suffix}`,
      normalizedName: `po-unit-${normalized}`,
      symbol: "pcs",
      allowsFraction: false
    }
  });

  const manufacturer = await prisma.organization.create({
    data: {
      workspaceId: workspace.id,
      name: `PO Manufacturer ${suffix}`,
      normalizedName: `po-manufacturer-${normalized}`
    }
  });

  const supplier = await prisma.organization.create({
    data: {
      workspaceId: workspace.id,
      name: `PO Supplier ${suffix}`,
      normalizedName: `po-supplier-${normalized}`
    }
  });

  const location = await prisma.storageLocation.create({
    data: {
      workspaceId: workspace.id,
      name: `PO Location ${suffix}`,
      normalizedName: `po-location-${normalized}`,
      isAssignable: true
    }
  });

  const part = await prisma.part.create({
    data: {
      workspaceId: workspace.id,
      unitId: unit.id,
      manufacturerId: manufacturer.id,
      catalogNumber: `PO-PART-${normalized}`
    }
  });

  const user = await prisma.user.create({
    data: {
      email: `po-user-${normalized}@example.com`,
      name: "PO Test User",
      emailVerified: true
    }
  });

  return {
    workspaceId: workspace.id,
    partId: part.id,
    supplierId: supplier.id,
    locationId: location.id,
    userId: user.id
  };
}

describe("purchase orders — CRUD", () => {
  test("creates, reads, updates, and deletes a draft order", async () => {
    const suffix = uniqueSuffix("crud");
    const { workspaceId, supplierId } = await createFixture(suffix);

    const order = await createPurchaseOrder({
      workspaceId,
      supplierId,
      orderNumber: "PO-2026-001",
      notes: "Urgent"
    });

    assert.equal(order.status, "DRAFT");
    assert.equal(order.orderNumber, "PO-2026-001");
    assert.equal(order.notes, "Urgent");

    const orders = await getPurchaseOrders(workspaceId);
    assert.equal(orders.items.length, 1);
    assert.equal(orders.items[0].supplierName.startsWith("PO Supplier"), true);
    assert.equal(orders.items[0].status, "DRAFT");

    await updatePurchaseOrder({
      workspaceId,
      orderId: order.id,
      orderNumber: "PO-2026-002",
      notes: null
    });

    const updated = await getPurchaseOrders(workspaceId);
    assert.equal(updated.items[0].orderNumber, "PO-2026-002");

    await deletePurchaseOrder({ workspaceId, orderId: order.id });

    const after = await getPurchaseOrders(workspaceId);
    assert.equal(after.items.length, 0);
  });

  test("rejects delete of received order", async () => {
    const suffix = uniqueSuffix("delete-received");
    const { workspaceId, supplierId, partId, locationId, userId } = await createFixture(suffix);

    const order = await createPurchaseOrder({ workspaceId, supplierId });
    const item = await addOrderItem({ workspaceId, orderId: order.id, partId, quantity: "2" });
    await markOrdered({ workspaceId, orderId: order.id });
    await receiveItems({
      workspaceId,
      orderId: order.id,
      createdByUserId: userId,
      items: [{ itemId: item.id, quantity: "2", locationId }]
    });

    await assert.rejects(
      () => deletePurchaseOrder({ workspaceId, orderId: order.id }),
      { message: "received-orders-cannot-be-deleted" }
    );
  });

  test("allows delete of ordered (non-received) order and restores quantities", async () => {
    const suffix = uniqueSuffix("delete-ordered");
    const { workspaceId, supplierId, partId } = await createFixture(suffix);

    const list = await createShoppingList({ workspaceId, name: "Del Ordered SL" });
    const slItem = await addShoppingListItem({ workspaceId, listId: list.id, partId, quantity: "3" });
    const poOrder = await convertShoppingListToOrder({
      workspaceId,
      listId: list.id,
      selectedItemIds: [slItem.id],
      supplierId
    });
    await addOrderItem({ workspaceId, orderId: poOrder.id, partId, quantity: "2" });
    await markOrdered({ workspaceId, orderId: poOrder.id });

    await deletePurchaseOrder({ workspaceId, orderId: poOrder.id });

    const { plannedQty, onOrderQty } = await getPartQtys(partId);
    // SL item still exists → its qty back in plannedQty; direct item gone
    assert.equal(plannedQty, 3);
    assert.equal(onOrderQty, 0);
  });

  test("does not return orders from another workspace", async () => {
    const suffixA = uniqueSuffix("iso-a");
    const suffixB = uniqueSuffix("iso-b");
    const { workspaceId: wsA, supplierId: supA } = await createFixture(suffixA);
    const { workspaceId: wsB } = await createFixture(suffixB);

    await createPurchaseOrder({ workspaceId: wsA, supplierId: supA });

    const ordersB = await getPurchaseOrders(wsB);
    assert.equal(ordersB.items.length, 0);
  });
});

describe("purchase orders — items", () => {
  test("adds, updates, and removes an item", async () => {
    const suffix = uniqueSuffix("items");
    const { workspaceId, supplierId, partId } = await createFixture(suffix);

    const order = await createPurchaseOrder({ workspaceId, supplierId });
    const item = await addOrderItem({
      workspaceId,
      orderId: order.id,
      partId,
      quantity: "10",
      supplierSku: "SKU-123",
      unitPrice: "1.50",
      currency: "EUR",
      notes: "Bulk"
    });

    const detail = await getPurchaseOrderDetail(workspaceId, order.id);
    assert.ok(detail);
    assert.equal(detail.items.length, 1);
    assert.equal(detail.items[0].quantity, "10");
    assert.equal(detail.items[0].supplierSku, "SKU-123");
    assert.equal(detail.items[0].unitPrice, "1.5");
    assert.equal(detail.items[0].currency, "EUR");
    assert.equal(detail.items[0].receivedQuantity, "0");

    const orders = await getPurchaseOrders(workspaceId);
    assert.equal(orders.items[0].itemCount, 1);

    await updateOrderItem({
      workspaceId,
      orderId: order.id,
      itemId: item.id,
      quantity: "20",
      supplierSku: "SKU-456",
      unitPrice: null,
      currency: null,
      notes: null
    });

    const detailAfterUpdate = await getPurchaseOrderDetail(workspaceId, order.id);
    assert.ok(detailAfterUpdate);
    assert.equal(detailAfterUpdate.items[0].quantity, "20");
    assert.equal(detailAfterUpdate.items[0].supplierSku, "SKU-456");
    assert.equal(detailAfterUpdate.items[0].unitPrice, null);

    await removeOrderItem({ workspaceId, orderId: order.id, itemId: item.id });

    const detailAfterRemove = await getPurchaseOrderDetail(workspaceId, order.id);
    assert.ok(detailAfterRemove);
    assert.equal(detailAfterRemove.items.length, 0);
  });

  test("rejects adding item to received order", async () => {
    const suffix = uniqueSuffix("item-received");
    const { workspaceId, supplierId, partId, locationId, userId } = await createFixture(suffix);

    const order = await createPurchaseOrder({ workspaceId, supplierId });
    const item = await addOrderItem({ workspaceId, orderId: order.id, partId, quantity: "1" });
    await markOrdered({ workspaceId, orderId: order.id });
    await receiveItems({
      workspaceId,
      orderId: order.id,
      createdByUserId: userId,
      items: [{ itemId: item.id, quantity: "1", locationId }]
    });

    await assert.rejects(
      () => addOrderItem({ workspaceId, orderId: order.id, partId, quantity: "1" }),
      { message: "order-already-received" }
    );
  });
});

describe("purchase orders — status transitions", () => {
  test("markOrdered sets status ORDERED and records orderedAt", async () => {
    const suffix = uniqueSuffix("mark-ordered");
    const { workspaceId, supplierId, partId } = await createFixture(suffix);

    const order = await createPurchaseOrder({ workspaceId, supplierId });
    await addOrderItem({ workspaceId, orderId: order.id, partId, quantity: "5" });
    await markOrdered({ workspaceId, orderId: order.id });

    const detail = await getPurchaseOrderDetail(workspaceId, order.id);
    assert.ok(detail);
    assert.equal(detail.status, "ORDERED");
    assert.ok(detail.orderedAt !== null);
  });

  test("rejects markOrdered on empty order", async () => {
    const suffix = uniqueSuffix("mark-empty");
    const { workspaceId, supplierId } = await createFixture(suffix);

    const order = await createPurchaseOrder({ workspaceId, supplierId });

    await assert.rejects(
      () => markOrdered({ workspaceId, orderId: order.id }),
      { message: "order-has-no-items" }
    );
  });

  test("rejects markOrdered when already ordered", async () => {
    const suffix = uniqueSuffix("mark-twice");
    const { workspaceId, supplierId, partId } = await createFixture(suffix);

    const order = await createPurchaseOrder({ workspaceId, supplierId });
    await addOrderItem({ workspaceId, orderId: order.id, partId, quantity: "1" });
    await markOrdered({ workspaceId, orderId: order.id });

    await assert.rejects(
      () => markOrdered({ workspaceId, orderId: order.id }),
      { message: "order-not-in-draft" }
    );
  });
});

describe("purchase orders — receive flow", () => {
  test("partial receive: updates receivedQuantity and creates RECEIPT inventory entry", async () => {
    const suffix = uniqueSuffix("partial-receive");
    const { workspaceId, supplierId, partId, locationId, userId } = await createFixture(suffix);

    const order = await createPurchaseOrder({ workspaceId, supplierId });
    const item = await addOrderItem({ workspaceId, orderId: order.id, partId, quantity: "10" });
    await markOrdered({ workspaceId, orderId: order.id });

    await receiveItems({
      workspaceId,
      orderId: order.id,
      createdByUserId: userId,
      items: [{ itemId: item.id, quantity: "4", locationId }]
    });

    const detail = await getPurchaseOrderDetail(workspaceId, order.id);
    assert.ok(detail);
    assert.equal(detail.status, "ORDERED");
    assert.equal(detail.items[0].receivedQuantity, "4");

    const inventoryEntries = await prisma.inventoryEntry.findMany({
      where: { workspaceId, partId }
    });
    assert.equal(inventoryEntries.length, 1);
    assert.equal(inventoryEntries[0].entryType, "RECEIPT");
    assert.equal(inventoryEntries[0].quantity.toString(), "4");
    assert.equal(inventoryEntries[0].toLocationId, locationId);
  });

  test("full receive: auto-advances status to RECEIVED", async () => {
    const suffix = uniqueSuffix("full-receive");
    const { workspaceId, supplierId, partId, locationId, userId } = await createFixture(suffix);

    const order = await createPurchaseOrder({ workspaceId, supplierId });
    const item = await addOrderItem({ workspaceId, orderId: order.id, partId, quantity: "5" });
    await markOrdered({ workspaceId, orderId: order.id });

    await receiveItems({
      workspaceId,
      orderId: order.id,
      createdByUserId: userId,
      items: [{ itemId: item.id, quantity: "5", locationId }]
    });

    const detail = await getPurchaseOrderDetail(workspaceId, order.id);
    assert.ok(detail);
    assert.equal(detail.status, "RECEIVED");
    assert.equal(detail.items[0].receivedQuantity, "5");
  });

  test("two-step partial receive: RECEIPT created per step, auto-advances on completion", async () => {
    const suffix = uniqueSuffix("two-step");
    const { workspaceId, supplierId, partId, locationId, userId } = await createFixture(suffix);

    const order = await createPurchaseOrder({ workspaceId, supplierId });
    const item = await addOrderItem({ workspaceId, orderId: order.id, partId, quantity: "6" });
    await markOrdered({ workspaceId, orderId: order.id });

    await receiveItems({
      workspaceId,
      orderId: order.id,
      createdByUserId: userId,
      items: [{ itemId: item.id, quantity: "2", locationId }]
    });

    const afterFirst = await getPurchaseOrderDetail(workspaceId, order.id);
    assert.ok(afterFirst);
    assert.equal(afterFirst.status, "ORDERED");
    assert.equal(afterFirst.items[0].receivedQuantity, "2");

    await receiveItems({
      workspaceId,
      orderId: order.id,
      createdByUserId: userId,
      items: [{ itemId: item.id, quantity: "4", locationId }]
    });

    const afterSecond = await getPurchaseOrderDetail(workspaceId, order.id);
    assert.ok(afterSecond);
    assert.equal(afterSecond.status, "RECEIVED");
    assert.equal(afterSecond.items[0].receivedQuantity, "6");

    const entries = await prisma.inventoryEntry.findMany({
      where: { workspaceId, partId },
      orderBy: { createdAt: "asc" }
    });
    assert.equal(entries.length, 2);
    assert.equal(entries[0].quantity.toString(), "2");
    assert.equal(entries[1].quantity.toString(), "4");
  });

  test("rejects receive exceeding ordered quantity", async () => {
    const suffix = uniqueSuffix("exceed-qty");
    const { workspaceId, supplierId, partId, locationId, userId } = await createFixture(suffix);

    const order = await createPurchaseOrder({ workspaceId, supplierId });
    const item = await addOrderItem({ workspaceId, orderId: order.id, partId, quantity: "3" });
    await markOrdered({ workspaceId, orderId: order.id });

    await assert.rejects(
      () =>
        receiveItems({
          workspaceId,
          orderId: order.id,
          createdByUserId: userId,
          items: [{ itemId: item.id, quantity: "10", locationId }]
        }),
      { message: "receive-exceeds-ordered-quantity" }
    );
  });

  test("rejects receive to an archived location", async () => {
    const suffix = uniqueSuffix("archived-loc");
    const { workspaceId, supplierId, partId, userId } = await createFixture(suffix);

    const normalized = suffix.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    const archivedLocation = await prisma.storageLocation.create({
      data: {
        workspaceId,
        name: `PO Archived Loc ${suffix}`,
        normalizedName: `po-archived-loc-${normalized}`,
        isAssignable: true,
        isArchived: true
      }
    });

    const order = await createPurchaseOrder({ workspaceId, supplierId });
    const item = await addOrderItem({ workspaceId, orderId: order.id, partId, quantity: "2" });
    await markOrdered({ workspaceId, orderId: order.id });

    await assert.rejects(
      () =>
        receiveItems({
          workspaceId,
          orderId: order.id,
          createdByUserId: userId,
          items: [{ itemId: item.id, quantity: "2", locationId: archivedLocation.id }]
        }),
      { message: "location-archived" }
    );
  });

  test("rejects receive on draft order", async () => {
    const suffix = uniqueSuffix("receive-draft");
    const { workspaceId, supplierId, partId, locationId, userId } = await createFixture(suffix);

    const order = await createPurchaseOrder({ workspaceId, supplierId });
    const item = await addOrderItem({ workspaceId, orderId: order.id, partId, quantity: "1" });

    await assert.rejects(
      () =>
        receiveItems({
          workspaceId,
          orderId: order.id,
          createdByUserId: userId,
          items: [{ itemId: item.id, quantity: "1", locationId }]
        }),
      { message: "order-not-ordered" }
    );
  });
});

async function getPartQtys(partId: string) {
  const part = await prisma.part.findUniqueOrThrow({
    where: { id: partId },
    select: { plannedQty: true, onOrderQty: true }
  });
  return {
    plannedQty: part.plannedQty.toNumber(),
    onOrderQty: part.onOrderQty.toNumber()
  };
}

describe("plannedQty / onOrderQty maintenance — purchase orders", () => {
  test("addOrderItem without source increments plannedQty", async () => {
    const suffix = uniqueSuffix("poq-add-direct");
    const { workspaceId, partId, supplierId } = await createFixture(suffix);

    const order = await createPurchaseOrder({ workspaceId, supplierId });
    await addOrderItem({ workspaceId, orderId: order.id, partId, quantity: "4" });

    const { plannedQty, onOrderQty } = await getPartQtys(partId);
    assert.equal(plannedQty, 4);
    assert.equal(onOrderQty, 0);
  });

  test("addOrderItem with sourceShoppingListItemId does not change plannedQty", async () => {
    const suffix = uniqueSuffix("poq-add-src");
    const { workspaceId, partId, supplierId } = await createFixture(suffix);

    const list = await createShoppingList({ workspaceId, name: "PO SL Source" });
    const slItem = await addShoppingListItem({ workspaceId, listId: list.id, partId, quantity: "5" });

    const qtyBefore = await getPartQtys(partId);

    const order = await createPurchaseOrder({ workspaceId, supplierId });
    await addOrderItem({
      workspaceId,
      orderId: order.id,
      partId,
      quantity: "5",
      sourceShoppingListItemId: slItem.id
    });

    const { plannedQty } = await getPartQtys(partId);
    assert.equal(plannedQty, qtyBefore.plannedQty);
  });

  test("updateOrderItem (DRAFT, no source) adjusts plannedQty", async () => {
    const suffix = uniqueSuffix("poq-upd-direct");
    const { workspaceId, partId, supplierId } = await createFixture(suffix);

    const order = await createPurchaseOrder({ workspaceId, supplierId });
    const item = await addOrderItem({ workspaceId, orderId: order.id, partId, quantity: "4" });
    await updateOrderItem({ workspaceId, orderId: order.id, itemId: item.id, quantity: "7" });

    const { plannedQty } = await getPartQtys(partId);
    assert.equal(plannedQty, 7);
  });

  test("updateOrderItem (DRAFT, from SL) does not change plannedQty", async () => {
    const suffix = uniqueSuffix("poq-upd-src");
    const { workspaceId, partId, supplierId } = await createFixture(suffix);

    const list = await createShoppingList({ workspaceId, name: "PO SL Upd" });
    const slItem = await addShoppingListItem({ workspaceId, listId: list.id, partId, quantity: "5" });
    const poOrder = await convertShoppingListToOrder({
      workspaceId,
      listId: list.id,
      selectedItemIds: [slItem.id],
      supplierId
    });

    const detail = await prisma.purchaseOrder.findUniqueOrThrow({
      where: { id: poOrder.id },
      select: { items: { select: { id: true } } }
    });
    const poItemId = detail.items[0].id;

    await updateOrderItem({ workspaceId, orderId: poOrder.id, itemId: poItemId, quantity: "10" });

    const { plannedQty } = await getPartQtys(partId);
    assert.equal(plannedQty, 5);
  });

  test("removeOrderItem (DRAFT, no source) decrements plannedQty", async () => {
    const suffix = uniqueSuffix("poq-rm-direct");
    const { workspaceId, partId, supplierId } = await createFixture(suffix);

    const order = await createPurchaseOrder({ workspaceId, supplierId });
    const item = await addOrderItem({ workspaceId, orderId: order.id, partId, quantity: "4" });
    await removeOrderItem({ workspaceId, orderId: order.id, itemId: item.id });

    const { plannedQty } = await getPartQtys(partId);
    assert.equal(plannedQty, 0);
  });

  test("removeOrderItem (DRAFT, from SL) does not change plannedQty", async () => {
    const suffix = uniqueSuffix("poq-rm-src");
    const { workspaceId, partId, supplierId } = await createFixture(suffix);

    const list = await createShoppingList({ workspaceId, name: "PO SL Rm" });
    const slItem = await addShoppingListItem({ workspaceId, listId: list.id, partId, quantity: "5" });
    const poOrder = await convertShoppingListToOrder({
      workspaceId,
      listId: list.id,
      selectedItemIds: [slItem.id],
      supplierId
    });

    const detail = await prisma.purchaseOrder.findUniqueOrThrow({
      where: { id: poOrder.id },
      select: { items: { select: { id: true } } }
    });
    const poItemId = detail.items[0].id;

    await removeOrderItem({ workspaceId, orderId: poOrder.id, itemId: poItemId });

    const { plannedQty } = await getPartQtys(partId);
    assert.equal(plannedQty, 5);
  });

  test("deletePurchaseOrder decrements plannedQty for direct items only", async () => {
    const suffix = uniqueSuffix("poq-del-po");
    const { workspaceId, partId, supplierId } = await createFixture(suffix);

    const list = await createShoppingList({ workspaceId, name: "PO Del SL" });
    const slItem = await addShoppingListItem({ workspaceId, listId: list.id, partId, quantity: "5" });
    const poOrder = await convertShoppingListToOrder({
      workspaceId,
      listId: list.id,
      selectedItemIds: [slItem.id],
      supplierId
    });

    await addOrderItem({ workspaceId, orderId: poOrder.id, partId, quantity: "4" });

    await deletePurchaseOrder({ workspaceId, orderId: poOrder.id });

    const { plannedQty } = await getPartQtys(partId);
    assert.equal(plannedQty, 5);
  });

  test("markOrdered moves plannedQty to onOrderQty", async () => {
    const suffix = uniqueSuffix("poq-mark-ordered");
    const { workspaceId, partId, supplierId } = await createFixture(suffix);

    const list = await createShoppingList({ workspaceId, name: "PO Mark Ordered SL" });
    const slItem = await addShoppingListItem({ workspaceId, listId: list.id, partId, quantity: "5" });
    const poOrder = await convertShoppingListToOrder({
      workspaceId,
      listId: list.id,
      selectedItemIds: [slItem.id],
      supplierId
    });

    await addOrderItem({ workspaceId, orderId: poOrder.id, partId, quantity: "4" });

    await markOrdered({ workspaceId, orderId: poOrder.id });

    const { plannedQty, onOrderQty } = await getPartQtys(partId);
    assert.equal(plannedQty, 0);
    assert.equal(onOrderQty, 9);
  });

  test("receiveItems decrements onOrderQty", async () => {
    const suffix = uniqueSuffix("poq-receive");
    const { workspaceId, partId, supplierId, locationId, userId } = await createFixture(suffix);

    const order = await createPurchaseOrder({ workspaceId, supplierId });
    const item = await addOrderItem({ workspaceId, orderId: order.id, partId, quantity: "4" });
    await markOrdered({ workspaceId, orderId: order.id });

    await receiveItems({
      workspaceId,
      orderId: order.id,
      createdByUserId: userId,
      items: [{ itemId: item.id, quantity: "4", locationId }]
    });

    const { plannedQty, onOrderQty } = await getPartQtys(partId);
    assert.equal(plannedQty, 0);
    assert.equal(onOrderQty, 0);
  });

  test("removeOrderItem (ORDERED) decrements onOrderQty", async () => {
    const suffix = uniqueSuffix("poq-rm-ordered-direct");
    const { workspaceId, partId, supplierId } = await createFixture(suffix);

    const order = await createPurchaseOrder({ workspaceId, supplierId });
    const item = await addOrderItem({ workspaceId, orderId: order.id, partId, quantity: "6" });
    await markOrdered({ workspaceId, orderId: order.id });

    await removeOrderItem({ workspaceId, orderId: order.id, itemId: item.id });

    const { plannedQty, onOrderQty } = await getPartQtys(partId);
    assert.equal(plannedQty, 0);
    assert.equal(onOrderQty, 0);
  });

  test("removeOrderItem (ORDERED, SL-sourced) decrements onOrderQty and restores plannedQty", async () => {
    const suffix = uniqueSuffix("poq-rm-ordered-sl");
    const { workspaceId, partId, supplierId } = await createFixture(suffix);

    const list = await createShoppingList({ workspaceId, name: "PO RM Ordered SL" });
    const slItem = await addShoppingListItem({ workspaceId, listId: list.id, partId, quantity: "5" });
    const poOrder = await convertShoppingListToOrder({
      workspaceId,
      listId: list.id,
      selectedItemIds: [slItem.id],
      supplierId
    });

    const detail = await prisma.purchaseOrder.findUniqueOrThrow({
      where: { id: poOrder.id },
      select: { items: { select: { id: true } } }
    });
    const poItemId = detail.items[0].id;

    await markOrdered({ workspaceId, orderId: poOrder.id });
    await removeOrderItem({ workspaceId, orderId: poOrder.id, itemId: poItemId });

    // onOrderQty should be 0; plannedQty should be restored to 5 (SL item still exists)
    const { plannedQty, onOrderQty } = await getPartQtys(partId);
    assert.equal(onOrderQty, 0);
    assert.equal(plannedQty, 5);
  });
});

describe("purchase orders — revert to draft", () => {
  test("revertOrderToDraft moves onOrderQty back to plannedQty", async () => {
    const suffix = uniqueSuffix("revert-draft");
    const { workspaceId, partId, supplierId } = await createFixture(suffix);

    const order = await createPurchaseOrder({ workspaceId, supplierId });
    await addOrderItem({ workspaceId, orderId: order.id, partId, quantity: "7" });
    await markOrdered({ workspaceId, orderId: order.id });

    const before = await getPartQtys(partId);
    assert.equal(before.onOrderQty, 7);
    assert.equal(before.plannedQty, 0);

    await revertOrderToDraft({ workspaceId, orderId: order.id });

    const after = await getPartQtys(partId);
    assert.equal(after.onOrderQty, 0);
    assert.equal(after.plannedQty, 7);

    const reverted = await getPurchaseOrderDetail(workspaceId, order.id);
    assert.equal(reverted?.status, "DRAFT");
    assert.equal(reverted?.orderedAt, null);
  });

  test("revertOrderToDraft rejects non-ordered status", async () => {
    const suffix = uniqueSuffix("revert-reject");
    const { workspaceId, supplierId } = await createFixture(suffix);

    const order = await createPurchaseOrder({ workspaceId, supplierId });

    await assert.rejects(
      () => revertOrderToDraft({ workspaceId, orderId: order.id }),
      { message: "order-not-ordered" }
    );
  });
});

describe("purchase orders — quick-add part flow", () => {
  test("getDraftPurchaseOrders returns only DRAFT orders", async () => {
    const { getDraftPurchaseOrders } = await import("../../src/server/purchase-orders/purchaseOrderMutations");
    const suffix = uniqueSuffix("qa-po-draft-filter");
    const { workspaceId, partId, supplierId } = await createFixture(suffix);

    const draft = await createPurchaseOrder({ workspaceId, supplierId });
    const ordered = await createPurchaseOrder({ workspaceId, supplierId });
    await addOrderItem({ workspaceId, orderId: ordered.id, partId, quantity: "1" });
    await markOrdered({ workspaceId, orderId: ordered.id });

    const drafts = await getDraftPurchaseOrders(workspaceId);
    const ids = drafts.map((po) => po.id);
    assert.ok(ids.includes(draft.id), "draft PO should appear");
    assert.ok(!ids.includes(ordered.id), "ordered PO should not appear");
  });

  test("createPurchaseOrder + addOrderItem creates PO with part in history", async () => {
    const suffix = uniqueSuffix("qa-po-create-add");
    const { workspaceId, partId, supplierId } = await createFixture(suffix);

    const order = await createPurchaseOrder({ workspaceId, supplierId });
    await addOrderItem({ workspaceId, orderId: order.id, partId, quantity: "3" });

    const detail = await getPurchaseOrderDetail(workspaceId, order.id);
    assert.ok(detail, "PO detail should exist");
    assert.equal(detail.items.length, 1);
    assert.equal(detail.items[0].partId, partId);
    assert.equal(detail.items[0].quantity, "3");
  });

  test("updateOrderItem merges quantity on existing PO line", async () => {
    const suffix = uniqueSuffix("qa-po-update-qty");
    const { workspaceId, partId, supplierId } = await createFixture(suffix);

    const order = await createPurchaseOrder({ workspaceId, supplierId });
    const item = await addOrderItem({ workspaceId, orderId: order.id, partId, quantity: "5" });
    await updateOrderItem({ workspaceId, orderId: order.id, itemId: item.id, quantity: "8" });

    const detail = await getPurchaseOrderDetail(workspaceId, order.id);
    assert.equal(detail?.items[0].quantity, "8");
  });
});
