import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { describe, test } from "node:test";

import { prisma } from "../../src/server/db/prisma";
import {
  getPartPreview,
  getPurchaseOrderPreview,
  getShoppingListPreview
} from "../../src/server/entity-previews/entityPreviews";

// Entity link hover previews (#123): a few key fields, scoped to the workspace.

async function createFixture(label: string) {
  const suffix = `${label}-${randomBytes(4).toString("hex")}`;
  const workspace = await prisma.workspace.create({
    data: { name: `Preview ${suffix}`, slug: `preview-${suffix}` }
  });
  const unit = await prisma.unit.create({
    data: {
      workspaceId: workspace.id,
      name: `Preview unit ${suffix}`,
      normalizedName: `preview-unit-${suffix}`,
      symbol: "pcs",
      allowsFraction: false
    }
  });
  const manufacturer = await prisma.organization.create({
    data: { workspaceId: workspace.id, name: `Maker ${suffix}`, normalizedName: `maker-${suffix}` }
  });
  const supplier = await prisma.organization.create({
    data: { workspaceId: workspace.id, name: `Supplier ${suffix}`, normalizedName: `supplier-${suffix}` }
  });
  const part = await prisma.part.create({
    data: {
      workspaceId: workspace.id,
      unitId: unit.id,
      manufacturerId: manufacturer.id,
      catalogNumber: `CAT-${suffix}`,
      description: "10k resistor"
    }
  });
  const list = await prisma.shoppingList.create({
    data: {
      workspaceId: workspace.id,
      name: `List ${suffix}`,
      description: "Weekend build",
      items: { create: [{ partId: part.id, quantity: 5 }] }
    }
  });
  const order = await prisma.purchaseOrder.create({
    data: {
      workspaceId: workspace.id,
      supplierId: supplier.id,
      orderNumber: `PO-${suffix}`,
      items: { create: [{ partId: part.id, quantity: 5 }] }
    }
  });
  return { workspaceId: workspace.id, suffix, part, list, order };
}

describe("entity previews (#123)", () => {
  test("return the key fields of each entity", async () => {
    const { workspaceId, suffix, part, list, order } = await createFixture("fields");

    assert.deepEqual(await getPartPreview(workspaceId, part.id), {
      id: part.id,
      manufacturerName: `Maker ${suffix}`,
      catalogNumber: `CAT-${suffix}`,
      description: "10k resistor"
    });
    assert.deepEqual(await getPurchaseOrderPreview(workspaceId, order.id), {
      id: order.id,
      orderNumber: `PO-${suffix}`,
      status: "DRAFT",
      supplierName: `Supplier ${suffix}`,
      itemCount: 1
    });
    assert.deepEqual(await getShoppingListPreview(workspaceId, list.id), {
      id: list.id,
      name: `List ${suffix}`,
      description: "Weekend build",
      itemCount: 1
    });
  });

  test("do not reveal another workspace's entities", async () => {
    const own = await createFixture("own");
    const other = await createFixture("other");

    assert.equal(await getPartPreview(own.workspaceId, other.part.id), null);
    assert.equal(await getPurchaseOrderPreview(own.workspaceId, other.order.id), null);
    assert.equal(await getShoppingListPreview(own.workspaceId, other.list.id), null);
  });

  test("answer null for an unknown id", async () => {
    const { workspaceId } = await createFixture("missing");

    assert.equal(await getPartPreview(workspaceId, "missing"), null);
    assert.equal(await getPurchaseOrderPreview(workspaceId, "missing"), null);
    assert.equal(await getShoppingListPreview(workspaceId, "missing"), null);
  });
});
