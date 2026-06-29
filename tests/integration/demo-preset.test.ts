import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { randomBytes } from "node:crypto";

import { prisma } from "../../src/server/db/prisma";
import { applyDemoPreset } from "../../src/server/workspaces/applyDemoPreset";
import { DEMO_PRESET_FIXTURE } from "../../src/server/workspaces/demoPresetFixture";
import { ensureDefaultUnitsForWorkspace, getDefaultPartUnitId } from "../../src/server/units/defaultUnits";
import { ensurePermissions } from "../../src/server/workspaces/createWorkspace";

function uniqueSuffix() {
  return randomBytes(4).toString("hex");
}

async function createTestWorkspace(suffix: string) {
  const normalized = suffix.toLowerCase();

  const user = await prisma.user.create({
    data: {
      email: `demo-preset-test-${suffix}@ohmsweetohm.local`,
      emailVerified: true,
      name: "Demo Preset Test User"
    }
  });

  await ensurePermissions();

  const workspace = await prisma.workspace.create({
    data: {
      name: `Demo Preset Workspace ${suffix}`,
      slug: `demo-preset-workspace-${normalized}`
    }
  });

  await ensureDefaultUnitsForWorkspace(prisma, workspace.id);
  const unitId = await getDefaultPartUnitId(prisma, workspace.id);

  return { workspace, user, unitId };
}

describe("demo preset seeding", () => {
  test("fixture has at least 200 parts", () => {
    assert.ok(
      DEMO_PRESET_FIXTURE.parts.length >= 200,
      `Expected ≥200 parts, got ${DEMO_PRESET_FIXTURE.parts.length}`
    );
  });

  test("parts-only preset creates expected entity counts", async () => {
    const suffix = uniqueSuffix();
    const { workspace, unitId } = await createTestWorkspace(suffix);
    const wid = workspace.id;

    await applyDemoPreset(prisma, wid, unitId, "parts-only", DEMO_PRESET_FIXTURE);

    const partCount = await prisma.part.count({ where: { workspaceId: wid } });
    assert.ok(partCount >= 200, `Expected ≥200 parts, got ${partCount}`);

    const categoryCount = await prisma.partCategory.count({ where: { workspaceId: wid } });
    assert.ok(categoryCount >= 5, `Expected ≥5 categories, got ${categoryCount}`);

    const attributeCount = await prisma.attribute.count({ where: { workspaceId: wid } });
    assert.ok(attributeCount >= 3, `Expected ≥3 attributes, got ${attributeCount}`);

    const inventoryCount = await prisma.inventoryEntry.count({ where: { workspaceId: wid } });
    assert.ok(inventoryCount > 0, "Expected inventory entries to be created");

    const slCount = await prisma.shoppingList.count({ where: { workspaceId: wid } });
    assert.equal(slCount, 0, "Expected no shopping lists for parts-only preset");

    const poCount = await prisma.purchaseOrder.count({ where: { workspaceId: wid } });
    assert.equal(poCount, 0, "Expected no purchase orders for parts-only preset");
  });

  test("parts-and-orders preset creates POs and shopping lists", async () => {
    const suffix = uniqueSuffix();
    const { workspace, unitId } = await createTestWorkspace(suffix);
    const wid = workspace.id;

    await applyDemoPreset(prisma, wid, unitId, "parts-and-orders", DEMO_PRESET_FIXTURE);

    const slCount = await prisma.shoppingList.count({ where: { workspaceId: wid } });
    assert.ok(slCount >= 2, `Expected ≥2 shopping lists, got ${slCount}`);

    const poCount = await prisma.purchaseOrder.count({ where: { workspaceId: wid } });
    assert.ok(poCount >= 3, `Expected ≥3 purchase orders, got ${poCount}`);

    const receivedCount = await prisma.purchaseOrder.count({
      where: { workspaceId: wid, status: "RECEIVED" }
    });
    assert.ok(receivedCount >= 1, "Expected at least one RECEIVED purchase order");

    const draftCount = await prisma.purchaseOrder.count({
      where: { workspaceId: wid, status: "DRAFT" }
    });
    assert.ok(draftCount >= 1, "Expected at least one DRAFT purchase order");

    const partCount = await prisma.part.count({ where: { workspaceId: wid } });
    assert.ok(partCount >= 200, `Expected ≥200 parts, got ${partCount}`);
  });

  test("parts-only preset creates designs with BOM line items", async () => {
    const suffix = uniqueSuffix();
    const { workspace, unitId } = await createTestWorkspace(suffix);
    const wid = workspace.id;

    await applyDemoPreset(prisma, wid, unitId, "parts-only", DEMO_PRESET_FIXTURE);

    const designCount = await prisma.design.count({ where: { workspaceId: wid } });
    assert.ok(designCount >= 3, `Expected ≥3 designs, got ${designCount}`);

    const lineItemCount = await prisma.bomLineItem.count({ where: { workspaceId: wid } });
    assert.ok(lineItemCount >= 9, `Expected ≥9 BOM line items, got ${lineItemCount}`);

    // A pinned line item must resolve to its exact part; a matcher line item must store
    // normalized values that resolve against inventory.
    const pinned = await prisma.bomLineItem.findFirst({
      where: { workspaceId: wid, pinnedPartId: { not: null } },
      select: { pinnedPart: { select: { catalogNumber: true } } }
    });
    assert.ok(pinned?.pinnedPart, "Expected at least one pinned line item");

    const matcher = await prisma.bomMatcher.findFirst({
      where: { workspaceId: wid, quantityBaseValue: { not: null } },
      select: { quantityBaseValue: true, displayValue: true }
    });
    assert.ok(matcher, "Expected at least one quantity matcher");
  });

  test("idempotency: applying parts-only twice yields same counts", async () => {
    const suffix = uniqueSuffix();
    const { workspace, unitId } = await createTestWorkspace(suffix);
    const wid = workspace.id;

    await applyDemoPreset(prisma, wid, unitId, "parts-only", DEMO_PRESET_FIXTURE);
    const countAfterFirst = await prisma.part.count({ where: { workspaceId: wid } });

    await applyDemoPreset(prisma, wid, unitId, "parts-only", DEMO_PRESET_FIXTURE);
    const countAfterSecond = await prisma.part.count({ where: { workspaceId: wid } });

    assert.equal(countAfterSecond, countAfterFirst, "Part count should not change on second apply");
  });

  test("category closure table is populated correctly", async () => {
    const suffix = uniqueSuffix();
    const { workspace, unitId } = await createTestWorkspace(suffix);
    const wid = workspace.id;

    await applyDemoPreset(prisma, wid, unitId, "parts-only", DEMO_PRESET_FIXTURE);

    const categoryCount = await prisma.partCategory.count({ where: { workspaceId: wid } });
    const closureCount = await prisma.partCategoryClosure.count({ where: { workspaceId: wid } });

    // Every category must have at least a self-closure (depth=0)
    assert.ok(
      closureCount >= categoryCount,
      `Expected ≥${categoryCount} closure rows (one self-closure each), got ${closureCount}`
    );
  });

  test("parts have attribute values", async () => {
    const suffix = uniqueSuffix();
    const { workspace, unitId } = await createTestWorkspace(suffix);
    const wid = workspace.id;

    await applyDemoPreset(prisma, wid, unitId, "parts-only", DEMO_PRESET_FIXTURE);

    const pavCount = await prisma.partAttributeValue.count({ where: { workspaceId: wid } });
    assert.ok(pavCount > 0, "Expected part attribute values to be created");

    // A known Yageo 10kΩ resistor should have a resistance value
    const resistor = await prisma.part.findFirst({
      where: { workspaceId: wid, catalogNumber: "RC0402FR-0710KL" },
      select: { id: true }
    });
    assert.ok(resistor, "Expected to find RC0402FR-0710KL");

    const resistorAttr = await prisma.attribute.findFirst({
      where: { workspaceId: wid, normalizedName: "resistance" },
      select: { id: true }
    });
    assert.ok(resistorAttr, "Expected to find resistance attribute");

    const pav = await prisma.partAttributeValue.findFirst({
      where: { partId: resistor.id, attributeId: resistorAttr.id },
      select: { quantityBaseValue: true }
    });
    assert.ok(pav, "Expected resistance attribute value on resistor");
    assert.ok(
      pav.quantityBaseValue !== null && Number(pav.quantityBaseValue) === 10000,
      `Expected 10000 Ω, got ${pav.quantityBaseValue}`
    );
  });
});
