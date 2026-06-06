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
});
