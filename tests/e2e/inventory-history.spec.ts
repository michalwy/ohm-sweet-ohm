import assert from "node:assert/strict";

import { test } from "@playwright/test";

import { prisma } from "../../src/server/db/prisma";
import {
  createInventoryEntry,
  getPartInventoryHistory
} from "../../src/server/inventory/entryMutations";

test.describe("inventory history (ledger)", () => {
  test("returns entries in reverse-chronological order", async (_context, testInfo) => {
    const suffix = `${testInfo.project.name}-${testInfo.retry}-order`;
    const { workspaceId, partId, locationId } = await createFixture(suffix);

    await createInventoryEntry({
      workspaceId,
      partId,
      entryType: "RECEIPT",
      quantity: "10",
      toLocationId: locationId
    });

    await createInventoryEntry({
      workspaceId,
      partId,
      entryType: "ISSUE",
      quantity: "3",
      fromLocationId: locationId
    });

    const history = await getPartInventoryHistory({ workspaceId, partId });

    assert.equal(history.length, 2);
    assert.equal(history[0].entryType, "ISSUE");
    assert.equal(history[1].entryType, "RECEIPT");

    const firstDate = new Date(history[0].createdAt);
    const secondDate = new Date(history[1].createdAt);
    assert.ok(firstDate >= secondDate);
  });

  test("returns correct field values for each entry type", async (_context, testInfo) => {
    const suffix = `${testInfo.project.name}-${testInfo.retry}-fields`;
    const { workspaceId, partId, locationId } = await createFixture(suffix);

    await createInventoryEntry({
      workspaceId,
      partId,
      entryType: "RECEIPT",
      quantity: "5",
      toLocationId: locationId,
      note: "Initial stock"
    });

    const history = await getPartInventoryHistory({ workspaceId, partId });

    assert.equal(history.length, 1);
    assert.equal(history[0].entryType, "RECEIPT");
    assert.equal(history[0].quantity, "5");
    assert.equal(history[0].fromLocationName, null);
    assert.ok(history[0].toLocationName !== null);
    assert.equal(history[0].note, "Initial stock");
  });

  test("records author when createdByUserId is provided", async (_context, testInfo) => {
    const suffix = `${testInfo.project.name}-${testInfo.retry}-author`;
    const { workspaceId, partId, locationId, userId } = await createFixture(suffix);

    await createInventoryEntry({
      workspaceId,
      partId,
      entryType: "RECEIPT",
      quantity: "2",
      toLocationId: locationId,
      createdByUserId: userId
    });

    const history = await getPartInventoryHistory({ workspaceId, partId });

    assert.equal(history.length, 1);
    assert.equal(history[0].authorName, "History Test User");
  });

  test("does not return entries from another workspace", async (_context, testInfo) => {
    const suffix = `${testInfo.project.name}-${testInfo.retry}-isolation`;
    const fixtureA = await createFixture(`${suffix}-a`);
    const fixtureB = await createFixture(`${suffix}-b`);

    await createInventoryEntry({
      workspaceId: fixtureA.workspaceId,
      partId: fixtureA.partId,
      entryType: "RECEIPT",
      quantity: "1",
      toLocationId: fixtureA.locationId
    });

    const history = await getPartInventoryHistory({
      workspaceId: fixtureB.workspaceId,
      partId: fixtureB.partId
    });

    assert.equal(history.length, 0);
  });

  test("caps results at 50 entries", async (_context, testInfo) => {
    const suffix = `${testInfo.project.name}-${testInfo.retry}-cap`;
    const { workspaceId, partId, locationId } = await createFixture(suffix);

    for (let i = 0; i < 55; i++) {
      await createInventoryEntry({
        workspaceId,
        partId,
        entryType: "RECEIPT",
        quantity: "1",
        toLocationId: locationId
      });
    }

    const history = await getPartInventoryHistory({ workspaceId, partId });
    assert.equal(history.length, 50);
  });
});

async function createFixture(suffix: string) {
  const normalizedSuffix = suffix.toLowerCase().replace(/[^a-z0-9]+/g, "-");

  const workspace = await prisma.workspace.create({
    data: {
      name: `History Workspace ${suffix}`,
      slug: `history-workspace-${normalizedSuffix}`
    }
  });

  const user = await prisma.user.create({
    data: {
      email: `history-user-${normalizedSuffix}@example.com`,
      name: "History Test User",
      emailVerified: true
    }
  });

  const unit = await prisma.unit.create({
    data: {
      workspaceId: workspace.id,
      name: `History Unit ${suffix}`,
      normalizedName: `history-unit-${normalizedSuffix}`,
      symbol: "pcs",
      allowsFraction: false
    }
  });

  const manufacturer = await prisma.organization.create({
    data: {
      workspaceId: workspace.id,
      name: `History Manufacturer ${suffix}`,
      normalizedName: `history-manufacturer-${normalizedSuffix}`
    }
  });

  const location = await prisma.storageLocation.create({
    data: {
      workspaceId: workspace.id,
      name: `History Location ${suffix}`,
      normalizedName: `history-location-${normalizedSuffix}`,
      isAssignable: true
    }
  });

  const part = await prisma.part.create({
    data: {
      workspaceId: workspace.id,
      unitId: unit.id,
      manufacturerId: manufacturer.id,
      catalogNumber: `HIST-${normalizedSuffix}`
    }
  });

  return {
    workspaceId: workspace.id,
    partId: part.id,
    locationId: location.id,
    userId: user.id
  };
}
