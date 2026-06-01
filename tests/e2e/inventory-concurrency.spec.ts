import assert from "node:assert/strict";

import { test } from "@playwright/test";

import { prisma } from "../../src/server/db/prisma";
import {
  createInventoryEntry,
  getPartLocationBalances
} from "../../src/server/inventory/entryMutations";

test.describe("inventory concurrency safety", () => {
  test("prevents concurrent issue entries from driving location stock below zero", async (
    _context,
    testInfo
  ) => {
    const suffix = `${testInfo.project.name}-${testInfo.retry}-issue`;
    const { workspaceId, partId, locationAId } = await createFixture(suffix);

    await createInventoryEntry({
      workspaceId,
      partId,
      entryType: "RECEIPT",
      quantity: "10",
      toLocationId: locationAId
    });

    const results = await Promise.allSettled([
      createInventoryEntry({
        workspaceId,
        partId,
        entryType: "ISSUE",
        quantity: "7",
        fromLocationId: locationAId
      }),
      createInventoryEntry({
        workspaceId,
        partId,
        entryType: "ISSUE",
        quantity: "7",
        fromLocationId: locationAId
      })
    ]);

    assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
    assert.equal(results.filter((result) => result.status === "rejected").length, 1);
    assert.equal(
      (results.find((result) => result.status === "rejected") as PromiseRejectedResult)
        .reason?.message,
      "insufficient-stock"
    );

    const balances = await getPartLocationBalances({ workspaceId, partId });
    assert.equal(balances.get(locationAId)?.toString(), "3");
  });

  test("prevents concurrent transfers from over-drawing the source location", async (
    _context,
    testInfo
  ) => {
    const suffix = `${testInfo.project.name}-${testInfo.retry}-transfer`;
    const { workspaceId, partId, locationAId, locationBId } = await createFixture(suffix);

    await createInventoryEntry({
      workspaceId,
      partId,
      entryType: "RECEIPT",
      quantity: "10",
      toLocationId: locationAId
    });

    const results = await Promise.allSettled([
      createInventoryEntry({
        workspaceId,
        partId,
        entryType: "TRANSFER",
        quantity: "7",
        fromLocationId: locationAId,
        toLocationId: locationBId
      }),
      createInventoryEntry({
        workspaceId,
        partId,
        entryType: "TRANSFER",
        quantity: "7",
        fromLocationId: locationAId,
        toLocationId: locationBId
      })
    ]);

    assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
    assert.equal(results.filter((result) => result.status === "rejected").length, 1);
    assert.equal(
      (results.find((result) => result.status === "rejected") as PromiseRejectedResult)
        .reason?.message,
      "insufficient-stock"
    );

    const balances = await getPartLocationBalances({ workspaceId, partId });
    assert.equal(balances.get(locationAId)?.toString(), "3");
    assert.equal(balances.get(locationBId)?.toString(), "7");
  });

  test(
    "prevents concurrent negative adjustments from driving location stock below zero",
    async (_context, testInfo) => {
    const suffix = `${testInfo.project.name}-${testInfo.retry}-adjustment`;
    const { workspaceId, partId, locationAId } = await createFixture(suffix);

    await createInventoryEntry({
      workspaceId,
      partId,
      entryType: "RECEIPT",
      quantity: "10",
      toLocationId: locationAId
    });

    const results = await Promise.allSettled([
      createInventoryEntry({
        workspaceId,
        partId,
        entryType: "ADJUSTMENT",
        quantity: "-7",
        toLocationId: locationAId
      }),
      createInventoryEntry({
        workspaceId,
        partId,
        entryType: "ADJUSTMENT",
        quantity: "-7",
        toLocationId: locationAId
      })
    ]);

    assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
    assert.equal(results.filter((result) => result.status === "rejected").length, 1);
    assert.equal(
      (results.find((result) => result.status === "rejected") as PromiseRejectedResult)
        .reason?.message,
      "insufficient-stock"
    );

    const balances = await getPartLocationBalances({ workspaceId, partId });
    assert.equal(balances.get(locationAId)?.toString(), "3");
    }
  );
});

async function createFixture(suffix: string) {
  const workspace = await prisma.workspace.findFirst({
    where: {
      slug: "default"
    },
    select: {
      id: true
    }
  });

  if (!workspace) {
    throw new Error("workspace-not-found");
  }

  const normalizedSuffix = suffix.toLowerCase().replace(/[^a-z0-9]+/g, "-");

  return prisma.$transaction(async (tx) => {
    const unit = await tx.unit.create({
      data: {
        workspaceId: workspace.id,
        name: `Concurrency Unit ${suffix}`,
        normalizedName: `concurrency-unit-${normalizedSuffix}`,
        symbol: "pcs",
        allowsFraction: false
      }
    });

    const manufacturer = await tx.organization.create({
      data: {
        workspaceId: workspace.id,
        name: `Concurrency Manufacturer ${suffix}`,
        normalizedName: `concurrency-manufacturer-${normalizedSuffix}`
      }
    });

    const locationA = await tx.storageLocation.create({
      data: {
        workspaceId: workspace.id,
        name: `Concurrency A ${suffix}`,
        normalizedName: `concurrency-a-${normalizedSuffix}`,
        isAssignable: true
      }
    });

    const locationB = await tx.storageLocation.create({
      data: {
        workspaceId: workspace.id,
        name: `Concurrency B ${suffix}`,
        normalizedName: `concurrency-b-${normalizedSuffix}`,
        isAssignable: true
      }
    });

    const part = await tx.part.create({
      data: {
        workspaceId: workspace.id,
        unitId: unit.id,
        manufacturerId: manufacturer.id,
        catalogNumber: `CONC-${normalizedSuffix}`
      }
    });

    return {
      workspaceId: workspace.id,
      partId: part.id,
      locationAId: locationA.id,
      locationBId: locationB.id
    };
  });
}
