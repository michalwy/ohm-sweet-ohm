import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { randomBytes } from "node:crypto";

import { prisma } from "../../src/server/db/prisma";
import {
  createShoppingList,
  updateShoppingList,
  deleteShoppingList,
  addShoppingListItem,
  updateShoppingListItem,
  removeShoppingListItem,
  getShoppingLists,
  getShoppingListDetail,
  convertShoppingListToOrder
} from "../../src/server/shopping-lists/shoppingListMutations";
import { createPurchaseOrder, markOrdered } from "../../src/server/purchase-orders/purchaseOrderMutations";

function uniqueSuffix(label: string) {
  return `${label}-${randomBytes(4).toString("hex")}`;
}

async function createFixture(suffix: string) {
  const normalized = suffix.toLowerCase().replace(/[^a-z0-9]+/g, "-");

  const workspace = await prisma.workspace.create({
    data: {
      name: `SL Workspace ${suffix}`,
      slug: `sl-workspace-${normalized}`
    }
  });

  const unit = await prisma.unit.create({
    data: {
      workspaceId: workspace.id,
      name: `SL Unit ${suffix}`,
      normalizedName: `sl-unit-${normalized}`,
      symbol: "pcs",
      allowsFraction: false
    }
  });

  const manufacturer = await prisma.organization.create({
    data: {
      workspaceId: workspace.id,
      name: `SL Manufacturer ${suffix}`,
      normalizedName: `sl-manufacturer-${normalized}`
    }
  });

  const supplier = await prisma.organization.create({
    data: {
      workspaceId: workspace.id,
      name: `SL Supplier ${suffix}`,
      normalizedName: `sl-supplier-${normalized}`
    }
  });

  const part = await prisma.part.create({
    data: {
      workspaceId: workspace.id,
      unitId: unit.id,
      manufacturerId: manufacturer.id,
      catalogNumber: `SL-PART-${normalized}`
    }
  });

  return {
    workspaceId: workspace.id,
    partId: part.id,
    supplierId: supplier.id
  };
}

describe("shopping lists — CRUD", () => {
  test("creates, reads, updates, and deletes a shopping list", async () => {
    const suffix = uniqueSuffix("crud");
    const { workspaceId } = await createFixture(suffix);

    const list = await createShoppingList({
      workspaceId,
      name: "Weekend Order",
      description: "Caps and resistors"
    });

    assert.equal(list.name, "Weekend Order");
    assert.equal(list.description, "Caps and resistors");

    const lists = await getShoppingLists(workspaceId);
    assert.equal(lists.items.length, 1);
    assert.equal(lists.items[0].name, "Weekend Order");
    assert.equal(lists.items[0].itemCount, 0);

    await updateShoppingList({
      workspaceId,
      listId: list.id,
      name: "Weekend Order Updated",
      description: null
    });

    const updated = await getShoppingLists(workspaceId);
    assert.equal(updated.items[0].name, "Weekend Order Updated");
    assert.equal(updated.items[0].description, null);

    await deleteShoppingList({ workspaceId, listId: list.id });

    const after = await getShoppingLists(workspaceId);
    assert.equal(after.items.length, 0);
  });

  test("rejects blank name on create", async () => {
    const suffix = uniqueSuffix("blank-name");
    const { workspaceId } = await createFixture(suffix);

    await assert.rejects(
      () => createShoppingList({ workspaceId, name: "   " }),
      { message: "name-required" }
    );
  });

  test("rejects list not belonging to workspace on update", async () => {
    const suffix = uniqueSuffix("wrong-ws");
    const { workspaceId } = await createFixture(suffix);
    const { workspaceId: otherWorkspaceId } = await createFixture(uniqueSuffix("other-ws"));

    const list = await createShoppingList({ workspaceId, name: "My List" });

    await assert.rejects(
      () => updateShoppingList({ workspaceId: otherWorkspaceId, listId: list.id, name: "Hack" }),
      { message: "shopping-list-not-found" }
    );
  });

  test("does not return lists from another workspace", async () => {
    const suffixA = uniqueSuffix("isolation-a");
    const suffixB = uniqueSuffix("isolation-b");
    const { workspaceId: wsA } = await createFixture(suffixA);
    const { workspaceId: wsB } = await createFixture(suffixB);

    await createShoppingList({ workspaceId: wsA, name: "List A" });

    const listsB = await getShoppingLists(wsB);
    assert.equal(listsB.items.length, 0);
  });
});

describe("shopping lists — items", () => {
  test("adds, updates, and removes an item", async () => {
    const suffix = uniqueSuffix("items");
    const { workspaceId, partId } = await createFixture(suffix);

    const list = await createShoppingList({ workspaceId, name: "Item Test" });

    const item = await addShoppingListItem({
      workspaceId,
      listId: list.id,
      partId,
      quantity: "10",
      description: "Initial stock"
    });

    const detail = await getShoppingListDetail(workspaceId, list.id);
    assert.ok(detail);
    assert.equal(detail.items.length, 1);
    assert.equal(detail.items[0].partId, partId);
    assert.equal(detail.items[0].quantity, "10");
    assert.equal(detail.items[0].description, "Initial stock");

    const lists = await getShoppingLists(workspaceId);
    assert.equal(lists.items[0].itemCount, 1);

    await updateShoppingListItem({
      workspaceId,
      listId: list.id,
      itemId: item.id,
      quantity: "20",
      description: null
    });

    const detailAfterUpdate = await getShoppingListDetail(workspaceId, list.id);
    assert.ok(detailAfterUpdate);
    assert.equal(detailAfterUpdate.items[0].quantity, "20");
    assert.equal(detailAfterUpdate.items[0].description, null);

    await removeShoppingListItem({ workspaceId, listId: list.id, itemId: item.id });

    const detailAfterRemove = await getShoppingListDetail(workspaceId, list.id);
    assert.ok(detailAfterRemove);
    assert.equal(detailAfterRemove.items.length, 0);
  });

  test("rejects item with invalid quantity", async () => {
    const suffix = uniqueSuffix("bad-qty");
    const { workspaceId, partId } = await createFixture(suffix);
    const list = await createShoppingList({ workspaceId, name: "Bad Qty" });

    await assert.rejects(
      () => addShoppingListItem({ workspaceId, listId: list.id, partId, quantity: "0" }),
      { message: "invalid-quantity" }
    );

    await assert.rejects(
      () => addShoppingListItem({ workspaceId, listId: list.id, partId, quantity: "-5" }),
      { message: "invalid-quantity" }
    );
  });

  test("rejects item belonging to a different list", async () => {
    const suffix = uniqueSuffix("wrong-list");
    const { workspaceId, partId } = await createFixture(suffix);

    const listA = await createShoppingList({ workspaceId, name: "List A" });
    const listB = await createShoppingList({ workspaceId, name: "List B" });

    const item = await addShoppingListItem({ workspaceId, listId: listA.id, partId, quantity: "1" });

    await assert.rejects(
      () => removeShoppingListItem({ workspaceId, listId: listB.id, itemId: item.id }),
      { message: "shopping-list-item-not-found" }
    );
  });
});

describe("shopping lists — convert to order", () => {
  test("creates a purchase order with source FKs set correctly", async () => {
    const suffix = uniqueSuffix("convert");
    const { workspaceId, partId, supplierId } = await createFixture(suffix);

    const list = await createShoppingList({ workspaceId, name: "Convert Test" });
    const item = await addShoppingListItem({ workspaceId, listId: list.id, partId, quantity: "5" });

    const order = await convertShoppingListToOrder({
      workspaceId,
      listId: list.id,
      selectedItemIds: [item.id],
      supplierId
    });

    assert.equal(order.workspaceId, workspaceId);
    assert.equal(order.supplierId, supplierId);
    assert.equal(order.sourceShoppingListId, list.id);
    assert.equal(order.status, "DRAFT");

    const orderItems = await prisma.purchaseOrderItem.findMany({
      where: { purchaseOrderId: order.id }
    });

    assert.equal(orderItems.length, 1);
    assert.equal(orderItems[0].partId, partId);
    assert.equal(orderItems[0].sourceShoppingListItemId, item.id);
    assert.equal(orderItems[0].quantity.toString(), "5");
  });

  test("sets source FK on converted items via detail query", async () => {
    const suffix = uniqueSuffix("convert-detail");
    const { workspaceId, partId, supplierId } = await createFixture(suffix);

    const list = await createShoppingList({ workspaceId, name: "Convert Detail Test" });
    const item = await addShoppingListItem({ workspaceId, listId: list.id, partId, quantity: "3" });

    await convertShoppingListToOrder({
      workspaceId,
      listId: list.id,
      selectedItemIds: [item.id],
      supplierId
    });

    const detail = await getShoppingListDetail(workspaceId, list.id);
    assert.ok(detail);
    assert.equal(detail.items.length, 1);
    assert.ok(detail.items[0].orderedInPurchaseOrderId !== null);
  });

  test("rejects when no items selected", async () => {
    const suffix = uniqueSuffix("convert-empty");
    const { workspaceId, supplierId } = await createFixture(suffix);
    const list = await createShoppingList({ workspaceId, name: "Empty Convert" });

    await assert.rejects(
      () => convertShoppingListToOrder({ workspaceId, listId: list.id, selectedItemIds: [], supplierId }),
      { message: "no-items-selected" }
    );
  });

  test("rejects unknown supplier", async () => {
    const suffix = uniqueSuffix("convert-bad-sup");
    const { workspaceId, partId } = await createFixture(suffix);
    const list = await createShoppingList({ workspaceId, name: "Bad Supplier" });
    const item = await addShoppingListItem({ workspaceId, listId: list.id, partId, quantity: "1" });

    await assert.rejects(
      () => convertShoppingListToOrder({
        workspaceId,
        listId: list.id,
        selectedItemIds: [item.id],
        supplierId: "nonexistent-supplier-id"
      }),
      { message: "supplier-not-found" }
    );
  });

  test("rejects items already on a purchase order", async () => {
    const suffix = uniqueSuffix("convert-already");
    const { workspaceId, partId, supplierId } = await createFixture(suffix);

    const list = await createShoppingList({ workspaceId, name: "Already Converted" });
    const item = await addShoppingListItem({ workspaceId, listId: list.id, partId, quantity: "2" });

    await convertShoppingListToOrder({
      workspaceId,
      listId: list.id,
      selectedItemIds: [item.id],
      supplierId
    });

    await assert.rejects(
      () => convertShoppingListToOrder({
        workspaceId,
        listId: list.id,
        selectedItemIds: [item.id],
        supplierId
      }),
      { message: "items-already-on-order" }
    );
  });

  test("with existingOrderId adds items to existing draft order", async () => {
    const suffix = uniqueSuffix("convert-existing");
    const { workspaceId, partId, supplierId } = await createFixture(suffix);

    const existingOrder = await createPurchaseOrder({ workspaceId, supplierId });

    const list = await createShoppingList({ workspaceId, name: "Existing PO SL" });
    const item = await addShoppingListItem({ workspaceId, listId: list.id, partId, quantity: "4" });

    const result = await convertShoppingListToOrder({
      workspaceId,
      listId: list.id,
      selectedItemIds: [item.id],
      existingOrderId: existingOrder.id
    });

    assert.equal(result.id, existingOrder.id);

    const addedItems = await prisma.purchaseOrderItem.findMany({
      where: { purchaseOrderId: existingOrder.id }
    });
    assert.equal(addedItems.length, 1);
    assert.equal(addedItems[0].sourceShoppingListItemId, item.id);
    assert.equal(addedItems[0].quantity.toString(), "4");
  });

  test("with existingOrderId rejects non-draft target order", async () => {
    const suffix = uniqueSuffix("convert-existing-ordered");
    const { workspaceId, partId, supplierId } = await createFixture(suffix);

    const existingOrder = await createPurchaseOrder({ workspaceId, supplierId });
    const directItem = await prisma.purchaseOrderItem.create({
      data: { purchaseOrderId: existingOrder.id, partId, quantity: "1" }
    });
    await markOrdered({ workspaceId, orderId: existingOrder.id });

    const list = await createShoppingList({ workspaceId, name: "Existing Ordered SL" });
    const item = await addShoppingListItem({ workspaceId, listId: list.id, partId, quantity: "2" });

    await assert.rejects(
      () => convertShoppingListToOrder({
        workspaceId,
        listId: list.id,
        selectedItemIds: [item.id],
        existingOrderId: existingOrder.id
      }),
      { message: "order-not-in-draft" }
    );

    // suppress unused-variable warning
    void directItem;
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

describe("plannedQty / onOrderQty maintenance — shopping lists", () => {
  test("addShoppingListItem increments plannedQty", async () => {
    const suffix = uniqueSuffix("sq-add");
    const { workspaceId, partId, supplierId: _s } = await createFixture(suffix);

    const list = await createShoppingList({ workspaceId, name: "SQ Add List" });
    await addShoppingListItem({ workspaceId, listId: list.id, partId, quantity: "5" });

    const { plannedQty, onOrderQty } = await getPartQtys(partId);
    assert.equal(plannedQty, 5);
    assert.equal(onOrderQty, 0);
  });

  test("updateShoppingListItem with no PO link adjusts plannedQty", async () => {
    const suffix = uniqueSuffix("sq-upd");
    const { workspaceId, partId } = await createFixture(suffix);

    const list = await createShoppingList({ workspaceId, name: "SQ Upd List" });
    const item = await addShoppingListItem({ workspaceId, listId: list.id, partId, quantity: "5" });
    await updateShoppingListItem({ workspaceId, listId: list.id, itemId: item.id, quantity: "8" });

    const { plannedQty } = await getPartQtys(partId);
    assert.equal(plannedQty, 8);
  });

  test("updateShoppingListItem with linked PO item does not change plannedQty", async () => {
    const suffix = uniqueSuffix("sq-upd-po");
    const { workspaceId, partId, supplierId } = await createFixture(suffix);

    const list = await createShoppingList({ workspaceId, name: "SQ Upd PO List" });
    const item = await addShoppingListItem({ workspaceId, listId: list.id, partId, quantity: "5" });
    await convertShoppingListToOrder({
      workspaceId,
      listId: list.id,
      selectedItemIds: [item.id],
      supplierId
    });

    await updateShoppingListItem({ workspaceId, listId: list.id, itemId: item.id, quantity: "10" });

    const { plannedQty } = await getPartQtys(partId);
    assert.equal(plannedQty, 5);
  });

  test("removeShoppingListItem with no PO link decrements plannedQty", async () => {
    const suffix = uniqueSuffix("sq-rm");
    const { workspaceId, partId } = await createFixture(suffix);

    const list = await createShoppingList({ workspaceId, name: "SQ Rm List" });
    const item = await addShoppingListItem({ workspaceId, listId: list.id, partId, quantity: "5" });
    await removeShoppingListItem({ workspaceId, listId: list.id, itemId: item.id });

    const { plannedQty } = await getPartQtys(partId);
    assert.equal(plannedQty, 0);
  });

  test("removeShoppingListItem with linked draft PO item does not change plannedQty", async () => {
    const suffix = uniqueSuffix("sq-rm-po");
    const { workspaceId, partId, supplierId } = await createFixture(suffix);

    const list = await createShoppingList({ workspaceId, name: "SQ Rm PO List" });
    const item = await addShoppingListItem({ workspaceId, listId: list.id, partId, quantity: "5" });
    await convertShoppingListToOrder({
      workspaceId,
      listId: list.id,
      selectedItemIds: [item.id],
      supplierId
    });

    await removeShoppingListItem({ workspaceId, listId: list.id, itemId: item.id });

    const { plannedQty } = await getPartQtys(partId);
    assert.equal(plannedQty, 5);
  });

  test("deleteShoppingList decrements plannedQty for unconverted items only", async () => {
    const suffix = uniqueSuffix("sq-del-list");
    const normalized = suffix.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    const { workspaceId, partId, supplierId } = await createFixture(suffix);

    const unit = await prisma.unit.findFirstOrThrow({ where: { workspaceId } });
    const manufacturer = await prisma.organization.findFirstOrThrow({ where: { workspaceId } });
    const part2 = await prisma.part.create({
      data: {
        workspaceId,
        unitId: unit.id,
        manufacturerId: manufacturer.id,
        catalogNumber: `SL-PART2-${normalized}`
      }
    });

    const list = await createShoppingList({ workspaceId, name: "SQ Del List" });
    const item1 = await addShoppingListItem({ workspaceId, listId: list.id, partId, quantity: "5" });
    await addShoppingListItem({ workspaceId, listId: list.id, partId: part2.id, quantity: "3" });

    await convertShoppingListToOrder({
      workspaceId,
      listId: list.id,
      selectedItemIds: [item1.id],
      supplierId
    });

    await deleteShoppingList({ workspaceId, listId: list.id });

    const p1Qtys = await getPartQtys(partId);
    const p2Qtys = await getPartQtys(part2.id);
    assert.equal(p1Qtys.plannedQty, 5);
    assert.equal(p2Qtys.plannedQty, 0);
  });

  test("convertShoppingListToOrder does not change plannedQty", async () => {
    const suffix = uniqueSuffix("sq-convert");
    const { workspaceId, partId, supplierId } = await createFixture(suffix);

    const list = await createShoppingList({ workspaceId, name: "SQ Convert List" });
    const item = await addShoppingListItem({ workspaceId, listId: list.id, partId, quantity: "5" });
    await convertShoppingListToOrder({
      workspaceId,
      listId: list.id,
      selectedItemIds: [item.id],
      supplierId
    });

    const { plannedQty } = await getPartQtys(partId);
    assert.equal(plannedQty, 5);
  });
});

describe("shopping lists — quick-add part flow", () => {
  test("addShoppingListItem for the same part twice creates two separate rows", async () => {
    const suffix = uniqueSuffix("qa-sl-two-rows");
    const { workspaceId, partId } = await createFixture(suffix);

    const list = await createShoppingList({ workspaceId, name: "QA Two Rows" });
    await addShoppingListItem({ workspaceId, listId: list.id, partId, quantity: "3" });
    await addShoppingListItem({ workspaceId, listId: list.id, partId, quantity: "2" });

    const detail = await getShoppingListDetail(workspaceId, list.id);
    assert.equal(detail?.items.length, 2, "two separate rows should exist");
  });

  test("updateShoppingListItem changes quantity on the last existing line", async () => {
    const suffix = uniqueSuffix("qa-sl-update-qty");
    const { workspaceId, partId } = await createFixture(suffix);

    const list = await createShoppingList({ workspaceId, name: "QA Update Qty" });
    const item1 = await addShoppingListItem({ workspaceId, listId: list.id, partId, quantity: "3" });
    const item2 = await addShoppingListItem({ workspaceId, listId: list.id, partId, quantity: "2" });

    await updateShoppingListItem({ workspaceId, listId: list.id, itemId: item2.id, quantity: "7" });

    const detail = await getShoppingListDetail(workspaceId, list.id);
    const row1 = detail?.items.find((i) => i.id === item1.id);
    const row2 = detail?.items.find((i) => i.id === item2.id);
    assert.equal(row1?.quantity, "3", "first row unchanged");
    assert.equal(row2?.quantity, "7", "last row updated");
  });

  test("createShoppingList + addShoppingListItem creates a list with one item", async () => {
    const suffix = uniqueSuffix("qa-sl-create-add");
    const { workspaceId, partId } = await createFixture(suffix);

    const list = await createShoppingList({ workspaceId, name: "QA Create Add" });
    await addShoppingListItem({ workspaceId, listId: list.id, partId, quantity: "5" });

    const detail = await getShoppingListDetail(workspaceId, list.id);
    assert.equal(detail?.items.length, 1);
    assert.equal(detail?.items[0].partId, partId);
    assert.equal(detail?.items[0].quantity, "5");
  });
});
