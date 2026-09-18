import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { randomBytes } from "node:crypto";

import type { LocationGeneratorLevel } from "../../src/lib/locationGenerator";
import { prisma } from "../../src/server/db/prisma";
import { generateStorageLocations } from "../../src/server/inventory/locationMutations";

function level(overrides: Partial<LocationGeneratorLevel> = {}): LocationGeneratorLevel {
  return {
    prefix: "",
    suffix: "",
    counter: "numeric",
    start: "1",
    count: 2,
    padding: "auto",
    isAssignable: true,
    ...overrides
  };
}

async function createWorkspace(label: string) {
  const suffix = `${label}-${randomBytes(4).toString("hex")}`;
  const workspace = await prisma.workspace.create({
    data: { name: `Location Generator ${suffix}`, slug: `location-generator-${suffix}` }
  });
  return workspace.id;
}

async function createLocation(
  workspaceId: string,
  name: string,
  parentId: string | null,
  isAssignable = false
) {
  const location = await prisma.storageLocation.create({
    data: { workspaceId, parentId, name, normalizedName: name.toLowerCase(), isAssignable }
  });
  return location.id;
}

/** Every location of the workspace as "Parent / Child" paths with their type, sorted. */
async function describeTree(workspaceId: string) {
  const locations = await prisma.storageLocation.findMany({ where: { workspaceId } });
  const byId = new Map(locations.map((location) => [location.id, location]));
  function path(id: string): string {
    const location = byId.get(id)!;
    return location.parentId ? `${path(location.parentId)} / ${location.name}` : location.name;
  }
  return locations
    .map((location) => ({ path: path(location.id), isAssignable: location.isAssignable }))
    .sort((a, b) => (a.path < b.path ? -1 : 1))
    .map((location) => `${location.path}${location.isAssignable ? "" : " [org]"}`);
}

describe("location generator", () => {
  test("creates the whole hierarchy under the chosen parent, each level with its type", async () => {
    const workspaceId = await createWorkspace("create");
    const cabinet = await createLocation(workspaceId, "Cabinet", null);

    const result = await generateStorageLocations({
      workspaceId,
      parentId: cabinet,
      levels: [
        level({ prefix: "Row ", counter: "alphabetic", start: "A", isAssignable: false }),
        level({ prefix: "Bin {1}" })
      ]
    });

    assert.equal(result.created.length, 6);
    assert.equal(result.reusedCount, 0);
    assert.deepEqual(await describeTree(workspaceId), [
      "Cabinet [org]",
      "Cabinet / Row A [org]",
      "Cabinet / Row A / Bin A1",
      "Cabinet / Row A / Bin A2",
      "Cabinet / Row B [org]",
      "Cabinet / Row B / Bin B1",
      "Cabinet / Row B / Bin B2"
    ]);
  });

  test("reuses existing same-named locations untouched and fills in below them", async () => {
    const workspaceId = await createWorkspace("extend");
    const cabinet = await createLocation(workspaceId, "Cabinet", null);
    // Existing, differently cased and assignable: kept as it is, not renamed or retyped.
    const row1 = await createLocation(workspaceId, "ROW 1", cabinet, true);
    await createLocation(workspaceId, "Bin 1", row1, true);

    const result = await generateStorageLocations({
      workspaceId,
      parentId: cabinet,
      levels: [level({ prefix: "Row ", isAssignable: false }), level({ prefix: "Bin " })]
    });

    assert.equal(result.reusedCount, 2);
    assert.deepEqual(
      result.created.map((location) => location.name).sort(),
      ["Bin 1", "Bin 2", "Bin 2", "Row 2"]
    );
    assert.deepEqual(await describeTree(workspaceId), [
      "Cabinet [org]",
      "Cabinet / ROW 1",
      "Cabinet / ROW 1 / Bin 1",
      "Cabinet / ROW 1 / Bin 2",
      "Cabinet / Row 2 [org]",
      "Cabinet / Row 2 / Bin 1",
      "Cabinet / Row 2 / Bin 2"
    ]);
  });

  test("generates at root level when no parent is given", async () => {
    const workspaceId = await createWorkspace("root");
    await createLocation(workspaceId, "Shelf 1", null);

    const result = await generateStorageLocations({
      workspaceId,
      parentId: null,
      levels: [level({ prefix: "Shelf ", count: 3 })]
    });

    assert.deepEqual(result.created.map((location) => [location.name, location.parentId]), [
      ["Shelf 2", null],
      ["Shelf 3", null]
    ]);
    assert.equal(result.reusedCount, 1);
  });

  test("refuses more new locations than the limit and creates nothing", async () => {
    const workspaceId = await createWorkspace("limit");

    await assert.rejects(
      generateStorageLocations({
        workspaceId,
        parentId: null,
        levels: [level({ count: 11 }), level({ count: 100 })]
      }),
      /too-many-generated-locations/
    );
    assert.equal(await prisma.storageLocation.count({ where: { workspaceId } }), 0);
  });

  test("refuses a parent from another workspace", async () => {
    const workspaceId = await createWorkspace("scope");
    const otherWorkspaceId = await createWorkspace("scope-other");
    const foreignParent = await createLocation(otherWorkspaceId, "Foreign", null);

    await assert.rejects(
      generateStorageLocations({ workspaceId, parentId: foreignParent, levels: [level()] }),
      /invalid-parent-location/
    );
    assert.equal(
      await prisma.storageLocation.count({ where: { parentId: foreignParent } }),
      0
    );
  });

  test("refuses invalid levels before touching the database", async () => {
    const workspaceId = await createWorkspace("invalid");

    await assert.rejects(
      generateStorageLocations({ workspaceId, parentId: null, levels: [level({ start: "A" })] }),
      /invalid-location-generator/
    );
    assert.equal(await prisma.storageLocation.count({ where: { workspaceId } }), 0);
  });
});
