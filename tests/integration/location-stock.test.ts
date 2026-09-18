import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { randomBytes } from "node:crypto";

import { prisma } from "../../src/server/db/prisma";
import { createInventoryEntry } from "../../src/server/inventory/entryMutations";
import { getLocationStock } from "../../src/server/inventory/locationStock";

function uniqueSuffix(label: string) {
  return `${label}-${randomBytes(4).toString("hex")}`;
}

describe("location stock", () => {
  test("lists parts with non-zero stock held directly at the location", async () => {
    const fixture = await createFixture(uniqueSuffix("direct"));
    const { workspaceId, cabinet, drawer, resistor, capacitor } = fixture;

    await receive(fixture, resistor, cabinet, "10");
    await createInventoryEntry({
      workspaceId,
      partId: resistor,
      entryType: "ISSUE",
      quantity: "4",
      fromLocationId: cabinet
    });
    // Moved away entirely: must not appear with a zero row.
    await receive(fixture, capacitor, cabinet, "5");
    await createInventoryEntry({
      workspaceId,
      partId: capacitor,
      entryType: "TRANSFER",
      quantity: "5",
      fromLocationId: cabinet,
      toLocationId: drawer
    });

    const stock = await getLocationStock({
      workspaceId,
      locationId: cabinet,
      includeSublocations: false
    });

    assert.deepEqual(
      stock.map((row) => [row.partId, row.locationId, row.quantity, row.availableQuantity]),
      [[resistor, cabinet, "6", "6"]]
    );
    assert.equal(stock[0].locationPath, "Cabinet");
    assert.equal(stock[0].catalogNumber, fixture.resistorCatalogNumber);
    assert.equal(stock[0].manufacturerName, fixture.manufacturerName);
  });

  test("with sublocations, adds one row per part and location below it, direct stock first", async () => {
    const fixture = await createFixture(uniqueSuffix("subtree"));
    const { workspaceId, cabinet, drawer, bin, resistor, capacitor } = fixture;

    await receive(fixture, resistor, cabinet, "3");
    await receive(fixture, resistor, bin, "7");
    await receive(fixture, capacitor, drawer, "2");
    await createInventoryEntry({
      workspaceId,
      partId: capacitor,
      entryType: "ADJUSTMENT",
      quantity: "1",
      toLocationId: drawer
    });

    const stock = await getLocationStock({
      workspaceId,
      locationId: cabinet,
      includeSublocations: true
    });

    assert.deepEqual(
      stock.map((row) => [row.partId, row.locationPath, row.quantity]),
      [
        [resistor, "Cabinet", "3"],
        [capacitor, "Drawer", "3"],
        [resistor, "Drawer / Bin", "7"]
      ]
    );

    const directOnly = await getLocationStock({
      workspaceId,
      locationId: drawer,
      includeSublocations: false
    });
    assert.deepEqual(
      directOnly.map((row) => row.partId),
      [capacitor]
    );
  });

  test("available subtracts only reservations held at that location by a running build", async () => {
    const fixture = await createFixture(uniqueSuffix("reserved"));
    const { workspaceId, cabinet, drawer, resistor } = fixture;

    await receive(fixture, resistor, cabinet, "10");
    await receive(fixture, resistor, drawer, "4");
    await createReservations(fixture, [
      { sourceLocationId: cabinet, assembled: false },
      { sourceLocationId: cabinet, assembled: false },
      // Assembled units no longer hold a reservation.
      { sourceLocationId: cabinet, assembled: true },
      { sourceLocationId: drawer, assembled: false }
    ]);

    const stock = await getLocationStock({
      workspaceId,
      locationId: cabinet,
      includeSublocations: true
    });

    assert.deepEqual(
      stock.map((row) => [row.locationId, row.quantity, row.availableQuantity]),
      [
        [cabinet, "10", "8"],
        [drawer, "4", "3"]
      ]
    );
  });

  test("rejects a location from another workspace", async () => {
    const fixtureA = await createFixture(uniqueSuffix("isolation-a"));
    const fixtureB = await createFixture(uniqueSuffix("isolation-b"));

    await receive(fixtureA, fixtureA.resistor, fixtureA.cabinet, "1");

    await assert.rejects(
      getLocationStock({
        workspaceId: fixtureB.workspaceId,
        locationId: fixtureA.cabinet,
        includeSublocations: true
      }),
      /location-not-found/
    );
  });
});

type Fixture = Awaited<ReturnType<typeof createFixture>>;

async function receive(fixture: Fixture, partId: string, locationId: string, quantity: string) {
  await createInventoryEntry({
    workspaceId: fixture.workspaceId,
    partId,
    entryType: "RECEIPT",
    quantity,
    toLocationId: locationId
  });
}

async function createReservations(
  fixture: Fixture,
  units: Array<{ sourceLocationId: string; assembled: boolean }>
) {
  const { workspaceId } = fixture;
  const design = await prisma.design.create({
    data: { workspaceId, name: "Location stock design", outputPartId: fixture.boardPart }
  });
  const revision = await prisma.designRevision.create({
    data: { workspaceId, designId: design.id, revisionNumber: 1 }
  });
  const build = await prisma.build.create({
    data: {
      workspaceId,
      designRevisionId: revision.id,
      targetQuantity: 1,
      state: "STARTED",
      startedAt: new Date()
    }
  });
  const line = await prisma.buildLineItem.create({
    data: {
      workspaceId,
      buildId: build.id,
      designators: "R1",
      designatorCount: 1
    }
  });

  await prisma.buildDesignatorAssignment.createMany({
    data: units.map((unit, index) => ({
      workspaceId,
      buildLineItemId: line.id,
      designator: "R1",
      unitIndex: index,
      partId: fixture.resistor,
      sourceLocationId: unit.sourceLocationId,
      assembled: unit.assembled
    }))
  });
}

async function createFixture(suffix: string) {
  const normalizedSuffix = suffix.toLowerCase().replace(/[^a-z0-9]+/g, "-");

  const workspace = await prisma.workspace.create({
    data: {
      name: `Location Stock Workspace ${suffix}`,
      slug: `location-stock-workspace-${normalizedSuffix}`
    }
  });
  const workspaceId = workspace.id;

  const unit = await prisma.unit.create({
    data: {
      workspaceId,
      name: `Location Stock Unit ${suffix}`,
      normalizedName: `location-stock-unit-${normalizedSuffix}`,
      symbol: "pcs",
      allowsFraction: false
    }
  });

  const manufacturerName = `Location Stock Manufacturer ${suffix}`;
  const manufacturer = await prisma.organization.create({
    data: {
      workspaceId,
      name: manufacturerName,
      normalizedName: manufacturerName.toLowerCase()
    }
  });

  async function createLocation(name: string, parentId: string | null) {
    const location = await prisma.storageLocation.create({
      data: {
        workspaceId,
        parentId,
        name,
        normalizedName: name.toLowerCase(),
        isAssignable: true
      }
    });
    return location.id;
  }

  const cabinet = await createLocation("Cabinet", null);
  const drawer = await createLocation("Drawer", cabinet);
  const bin = await createLocation("Bin", drawer);

  async function createPart(catalogNumber: string) {
    const part = await prisma.part.create({
      data: { workspaceId, unitId: unit.id, manufacturerId: manufacturer.id, catalogNumber }
    });
    return part.id;
  }

  // Catalog numbers sort capacitor before resistor, so row order is by location, not by part.
  const resistorCatalogNumber = `R-${normalizedSuffix}`;
  const resistor = await createPart(resistorCatalogNumber);
  const capacitor = await createPart(`C-${normalizedSuffix}`);
  const boardPart = await createPart(`PCB-${normalizedSuffix}`);

  return {
    workspaceId,
    manufacturerName,
    cabinet,
    drawer,
    bin,
    resistor,
    resistorCatalogNumber,
    capacitor,
    boardPart
  };
}
