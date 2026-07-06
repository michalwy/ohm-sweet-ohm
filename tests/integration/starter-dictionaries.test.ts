import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { randomBytes } from "node:crypto";

import { prisma } from "../../src/server/db/prisma";
import { applyDemoPreset } from "../../src/server/workspaces/applyDemoPreset";
import { applyStarterDictionaries } from "../../src/server/workspaces/applyStarterDictionaries";
import { DEMO_PRESET_FIXTURE } from "../../src/server/workspaces/demoPresetFixture";
import { ensureDefaultUnitsForWorkspace } from "../../src/server/units/defaultUnits";
import { ensurePermissions } from "../../src/server/workspaces/createWorkspace";

function uniqueSuffix() {
  return randomBytes(4).toString("hex");
}

async function createTestWorkspace(suffix: string) {
  const normalized = suffix.toLowerCase();

  const user = await prisma.user.create({
    data: {
      email: `starter-dictionaries-test-${suffix}@ohmsweetohm.local`,
      emailVerified: true,
      name: "Starter Dictionaries Test User"
    }
  });

  await ensurePermissions();

  const workspace = await prisma.workspace.create({
    data: {
      name: `Starter Dictionaries Workspace ${suffix}`,
      slug: `starter-dictionaries-workspace-${normalized}`
    }
  });

  await ensureDefaultUnitsForWorkspace(prisma, workspace.id);

  return { workspace, user };
}

describe("starter dictionaries seeding", () => {
  test("creates the expected dictionary layer with no parts, locations, or stock", async () => {
    const suffix = uniqueSuffix();
    const { workspace } = await createTestWorkspace(suffix);
    const wid = workspace.id;

    await applyStarterDictionaries(prisma, wid);

    const attributeCount = await prisma.attribute.count({ where: { workspaceId: wid } });
    assert.ok(attributeCount >= 3, `Expected ≥3 attributes, got ${attributeCount}`);

    const categoryCount = await prisma.partCategory.count({ where: { workspaceId: wid } });
    assert.ok(categoryCount >= 5, `Expected ≥5 categories, got ${categoryCount}`);

    const manufacturerCount = await prisma.organizationRole.count({
      where: { role: "manufacturer", organization: { workspaceId: wid } }
    });
    assert.ok(manufacturerCount > 0, "Expected manufacturer organizations to be created");

    const supplierCount = await prisma.organizationRole.count({
      where: { role: "supplier", organization: { workspaceId: wid } }
    });
    assert.ok(supplierCount > 0, "Expected supplier organizations to be created");

    const extraUnits = await prisma.unit.findMany({
      where: { workspaceId: wid, normalizedName: { in: ["grams", "rolls", "boxes", "sets"] } },
      select: { normalizedName: true }
    });
    assert.equal(extraUnits.length, 4, "Expected all 4 extra stock units to be created");

    const partCount = await prisma.part.count({ where: { workspaceId: wid } });
    assert.equal(partCount, 0, "Expected no parts to be created");

    const locationCount = await prisma.storageLocation.count({ where: { workspaceId: wid } });
    assert.equal(locationCount, 0, "Expected no storage locations to be created");

    const inventoryCount = await prisma.inventoryEntry.count({ where: { workspaceId: wid } });
    assert.equal(inventoryCount, 0, "Expected no inventory entries to be created");
  });

  test("idempotency: applying twice yields the same counts", async () => {
    const suffix = uniqueSuffix();
    const { workspace } = await createTestWorkspace(suffix);
    const wid = workspace.id;

    await applyStarterDictionaries(prisma, wid);
    const attributeCountAfterFirst = await prisma.attribute.count({ where: { workspaceId: wid } });
    const categoryCountAfterFirst = await prisma.partCategory.count({ where: { workspaceId: wid } });
    const organizationCountAfterFirst = await prisma.organization.count({ where: { workspaceId: wid } });
    const unitCountAfterFirst = await prisma.unit.count({ where: { workspaceId: wid } });

    await applyStarterDictionaries(prisma, wid);
    const attributeCountAfterSecond = await prisma.attribute.count({ where: { workspaceId: wid } });
    const categoryCountAfterSecond = await prisma.partCategory.count({ where: { workspaceId: wid } });
    const organizationCountAfterSecond = await prisma.organization.count({ where: { workspaceId: wid } });
    const unitCountAfterSecond = await prisma.unit.count({ where: { workspaceId: wid } });

    assert.equal(attributeCountAfterSecond, attributeCountAfterFirst, "Attribute count should not change");
    assert.equal(categoryCountAfterSecond, categoryCountAfterFirst, "Category count should not change");
    assert.equal(organizationCountAfterSecond, organizationCountAfterFirst, "Organization count should not change");
    assert.equal(unitCountAfterSecond, unitCountAfterFirst, "Unit count should not change");
  });

  test("applying to a workspace that already has demo data does not duplicate shared dictionary rows", async () => {
    const suffix = uniqueSuffix();
    const { workspace } = await createTestWorkspace(suffix);
    const wid = workspace.id;
    const unitId = (
      await prisma.unit.findUniqueOrThrow({
        where: { workspaceId_normalizedName: { workspaceId: wid, normalizedName: "pieces" } },
        select: { id: true }
      })
    ).id;

    await applyDemoPreset(prisma, wid, unitId, "parts-only", DEMO_PRESET_FIXTURE);
    const attributeCountAfterDemo = await prisma.attribute.count({ where: { workspaceId: wid } });
    const categoryCountAfterDemo = await prisma.partCategory.count({ where: { workspaceId: wid } });
    const organizationCountAfterDemo = await prisma.organization.count({ where: { workspaceId: wid } });
    const partCountAfterDemo = await prisma.part.count({ where: { workspaceId: wid } });

    await applyStarterDictionaries(prisma, wid);

    const attributeCountAfterStarter = await prisma.attribute.count({ where: { workspaceId: wid } });
    const categoryCountAfterStarter = await prisma.partCategory.count({ where: { workspaceId: wid } });
    const organizationCountAfterStarter = await prisma.organization.count({ where: { workspaceId: wid } });
    const partCountAfterStarter = await prisma.part.count({ where: { workspaceId: wid } });

    assert.equal(attributeCountAfterStarter, attributeCountAfterDemo, "Attribute count should not change");
    assert.equal(categoryCountAfterStarter, categoryCountAfterDemo, "Category count should not change");
    assert.equal(organizationCountAfterStarter, organizationCountAfterDemo, "Organization count should not change");
    assert.equal(partCountAfterStarter, partCountAfterDemo, "Existing parts should be untouched");

    const extraUnits = await prisma.unit.findMany({
      where: { workspaceId: wid, normalizedName: { in: ["grams", "rolls", "boxes", "sets"] } },
      select: { normalizedName: true }
    });
    assert.equal(extraUnits.length, 4, "Expected extra stock units to be added on top of demo data");
  });
});
