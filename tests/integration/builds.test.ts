import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { randomBytes } from "node:crypto";

import { prisma } from "../../src/server/db/prisma";
import { ensurePermissions } from "../../src/server/workspaces/createWorkspace";
import {
  ensureDefaultUnitsForWorkspace,
  getDefaultPartUnitId
} from "../../src/server/units/defaultUnits";
import { createDesign } from "../../src/server/designs/designs";
import { createBomLineItem } from "../../src/server/designs/bomLineItems";
import { createPartCategory } from "../../src/server/parts/categories";
import {
  createInventoryEntry,
  getPartLocationAvailableBalances,
  getPartLocationBalances
} from "../../src/server/inventory/entryMutations";
import {
  assembleBuildUnit,
  assembleDesignator,
  cancelBuild,
  createBuild,
  getBuildDetail,
  markBuildAllocated,
  reassignDesignatorAssignment,
  setBuildAllocations,
  setBuildLineAllocations,
  startBuild
} from "../../src/server/builds/builds";

function uniqueSuffix() {
  return randomBytes(4).toString("hex");
}

type Scenario = {
  workspaceId: string;
  userId: string;
  revisionId: string;
  buildLinePartId: string;
  outputPartId: string;
  sourceLocationId: string;
  secondLocationId: string;
  outputLocationId: string;
};

async function createWorkspaceWithOwner(suffix: string) {
  await ensurePermissions();
  const { workspaceId, userId } = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        email: `builds-${suffix}@ohmsweetohm.local`,
        emailVerified: true,
        name: "Builds User"
      }
    });
    const workspace = await tx.workspace.create({
      data: { name: `Builds Workspace ${suffix}`, slug: `builds-${suffix}` }
    });
    const ownerRole = await tx.role.create({
      data: {
        workspaceId: workspace.id,
        name: "owner",
        isSystem: true,
        permissions: { create: [{ permissionKey: "admin" }] }
      }
    });
    const member = await tx.workspaceMember.create({
      data: { userId: user.id, workspaceId: workspace.id },
      select: { id: true }
    });
    await tx.workspaceMemberRole.create({
      data: { workspaceMemberId: member.id, roleId: ownerRole.id }
    });
    return { workspaceId: workspace.id, userId: user.id };
  });

  await ensureDefaultUnitsForWorkspace(prisma, workspaceId);
  const unitId = await getDefaultPartUnitId(prisma, workspaceId);
  assert.ok(unitId, "default unit must exist");
  return { workspaceId, userId, unitId: unitId as string };
}

async function createLocation(workspaceId: string, name: string, normalized: string) {
  return prisma.storageLocation.create({
    data: { workspaceId, name, normalizedName: normalized, isAssignable: true },
    select: { id: true }
  });
}

async function receive(
  workspaceId: string,
  partId: string,
  quantity: string,
  toLocationId: string
) {
  if (quantity === "0") return;
  await createInventoryEntry({
    workspaceId,
    partId,
    entryType: "RECEIPT",
    quantity,
    toLocationId
  });
}

/**
 * Build a workspace with one component part, two locations, an output design + revision, and a
 * BOM line pinned to the component with designators R1-R3. `stockAtSource` parts are received into
 * the source location (default 6).
 */
async function createScenario(
  suffix: string,
  options: { stockAtSource?: string; stockAtSecond?: string } = {}
): Promise<Scenario> {
  const { workspaceId, userId, unitId } = await createWorkspaceWithOwner(suffix);

  const manufacturer = await prisma.organization.create({
    data: {
      workspaceId,
      name: `Builds Manufacturer ${suffix}`,
      normalizedName: `builds-manufacturer-${suffix}`
    },
    select: { id: true }
  });

  const componentPart = await prisma.part.create({
    data: { workspaceId, unitId, manufacturerId: manufacturer.id, catalogNumber: `RES-${suffix}` },
    select: { id: true }
  });

  const sourceLocation = await createLocation(workspaceId, `Source ${suffix}`, `source-${suffix}`);
  const secondLocation = await createLocation(workspaceId, `Second ${suffix}`, `second-${suffix}`);
  const outputLocation = await createLocation(workspaceId, `Output ${suffix}`, `output-${suffix}`);

  await receive(workspaceId, componentPart.id, options.stockAtSource ?? "6", sourceLocation.id);
  if (options.stockAtSecond) {
    await receive(workspaceId, componentPart.id, options.stockAtSecond, secondLocation.id);
  }

  const { revisionId, outputPartId } = await createDesignWithLine(
    suffix,
    workspaceId,
    userId,
    unitId,
    { designators: "R1, R2, R3", pinnedPartId: componentPart.id, matchers: [] }
  );

  return {
    workspaceId,
    userId,
    revisionId,
    buildLinePartId: componentPart.id,
    outputPartId,
    sourceLocationId: sourceLocation.id,
    secondLocationId: secondLocation.id,
    outputLocationId: outputLocation.id
  };
}

type SplitScenario = {
  workspaceId: string;
  userId: string;
  revisionId: string;
  partAId: string;
  partBId: string;
  outsiderPartId: string;
  locationAId: string;
  locationBId: string;
  outputPartId: string;
  outputLocationId: string;
};

/**
 * Build a workspace with a category holding two matching parts (A, B), one non-matching outsider
 * part, per-part locations, and an unpinned category-based BOM line. This drives split allocation
 * across multiple parts and assembly-time reassignment.
 */
async function createSplitScenario(
  suffix: string,
  options: {
    designators?: string;
    secondLineDesignators?: string;
    stockA?: string;
    stockB?: string;
  } = {}
): Promise<SplitScenario> {
  const { workspaceId, userId, unitId } = await createWorkspaceWithOwner(suffix);

  const manufacturer = await prisma.organization.create({
    data: {
      workspaceId,
      name: `Split Manufacturer ${suffix}`,
      normalizedName: `split-manufacturer-${suffix}`
    },
    select: { id: true }
  });

  const category = await createPartCategory({
    workspaceId,
    parentId: null,
    name: `Resistors ${suffix}`,
    isAssignable: true
  });

  const partA = await prisma.part.create({
    data: {
      workspaceId,
      unitId,
      manufacturerId: manufacturer.id,
      catalogNumber: `A-${suffix}`,
      primaryCategoryId: category.id
    },
    select: { id: true }
  });
  const partB = await prisma.part.create({
    data: {
      workspaceId,
      unitId,
      manufacturerId: manufacturer.id,
      catalogNumber: `B-${suffix}`,
      primaryCategoryId: category.id
    },
    select: { id: true }
  });
  // A part outside the category never satisfies the line spec.
  const outsider = await prisma.part.create({
    data: { workspaceId, unitId, manufacturerId: manufacturer.id, catalogNumber: `Z-${suffix}` },
    select: { id: true }
  });

  const locationA = await createLocation(workspaceId, `Drawer A ${suffix}`, `drawer-a-${suffix}`);
  const locationB = await createLocation(workspaceId, `Drawer B ${suffix}`, `drawer-b-${suffix}`);
  const outputLocation = await createLocation(workspaceId, `Output ${suffix}`, `output-${suffix}`);

  await receive(workspaceId, partA.id, options.stockA ?? "10", locationA.id);
  await receive(workspaceId, partB.id, options.stockB ?? "10", locationB.id);

  const { revisionId, outputPartId } = await createDesignWithLine(
    suffix,
    workspaceId,
    userId,
    unitId,
    { designators: options.designators ?? "R1, R2, R3", categoryId: category.id, matchers: [] }
  );

  if (options.secondLineDesignators) {
    const second = await createBomLineItem({
      userId,
      workspaceId,
      revisionId,
      input: { designators: options.secondLineDesignators, categoryId: category.id, matchers: [] }
    });
    assert.ok(second.ok, JSON.stringify(second));
  }

  return {
    workspaceId,
    userId,
    revisionId,
    partAId: partA.id,
    partBId: partB.id,
    outsiderPartId: outsider.id,
    locationAId: locationA.id,
    locationBId: locationB.id,
    outputPartId,
    outputLocationId: outputLocation.id
  };
}

async function createDesignWithLine(
  suffix: string,
  workspaceId: string,
  userId: string,
  unitId: string,
  line: { designators: string; pinnedPartId?: string; categoryId?: string; matchers: [] }
) {
  const design = await createDesign({
    userId,
    workspaceId,
    workspaceName: `Builds Workspace ${suffix}`,
    name: "Board",
    catalogNumber: `BOARD-${suffix}`,
    unitId
  });
  assert.ok(design.ok, JSON.stringify(design));

  const revision = await prisma.designRevision.findFirstOrThrow({
    where: { workspaceId, designId: design.id },
    select: { id: true }
  });
  const designRow = await prisma.design.findUniqueOrThrow({
    where: { id: design.id },
    select: { outputPartId: true }
  });

  const created = await createBomLineItem({
    userId,
    workspaceId,
    revisionId: revision.id,
    input: {
      designators: line.designators,
      pinnedPartId: line.pinnedPartId ?? null,
      categoryId: line.categoryId ?? null,
      matchers: line.matchers
    }
  });
  assert.ok(created.ok, JSON.stringify(created));

  return { revisionId: revision.id, outputPartId: designRow.outputPartId };
}

async function partStock(workspaceId: string, partId: string) {
  const part = await prisma.part.findFirstOrThrow({
    where: { id: partId, workspaceId },
    select: { currentStock: true, reservedQty: true, allocatedQty: true }
  });
  return {
    currentStock: part.currentStock.toString(),
    reservedQty: part.reservedQty.toString(),
    allocatedQty: part.allocatedQty.toString()
  };
}

async function firstLineId(buildId: string) {
  const line = await prisma.buildLineItem.findFirstOrThrow({
    where: { buildId },
    select: { id: true, designatorCount: true }
  });
  return line;
}

async function createBuildFor(
  scenario: { userId: string; workspaceId: string; revisionId: string; outputLocationId: string },
  targetQuantity: number
) {
  const build = await createBuild({
    userId: scenario.userId,
    workspaceId: scenario.workspaceId,
    designRevisionId: scenario.revisionId,
    targetQuantity,
    outputLocationId: scenario.outputLocationId
  });
  assert.ok(build.ok, JSON.stringify(build));
  return build.data.id;
}

async function setAllocations(
  scenario: { userId: string; workspaceId: string },
  buildLineItemId: string,
  entries: { partId: string; sourceLocationId: string | null; quantity: number }[]
) {
  const result = await setBuildLineAllocations({
    userId: scenario.userId,
    workspaceId: scenario.workspaceId,
    buildLineItemId,
    entries
  });
  assert.ok(result.ok, JSON.stringify(result));
}

/** Single-part build allocated fully at the source location. */
async function createAndAllocateBuild(scenario: Scenario, targetQuantity = 2) {
  const buildId = await createBuildFor(scenario, targetQuantity);
  const line = await firstLineId(buildId);
  await setAllocations(scenario, line.id, [
    {
      partId: scenario.buildLinePartId,
      sourceLocationId: scenario.sourceLocationId,
      quantity: line.designatorCount * targetQuantity
    }
  ]);
  return { buildId, lineId: line.id };
}

describe("build flow", () => {
  test("createBuild snapshots one line and pre-fills its allocation", async () => {
    const scenario = await createScenario(uniqueSuffix());
    const buildId = await createBuildFor(scenario, 2);

    const lines = await prisma.buildLineItem.findMany({
      where: { buildId },
      select: {
        designatorCount: true,
        assignments: { select: { id: true } },
        allocations: { select: { partId: true, sourceLocationId: true, quantity: true } }
      }
    });
    assert.equal(lines.length, 1);
    assert.equal(lines[0]?.designatorCount, 3);
    // Designator assignment rows are only created at start (distribution), not at creation.
    assert.equal(lines[0]?.assignments.length, 0);
    // The pinned part is greedily pre-filled from its stocked location for the full requirement.
    assert.equal(lines[0]?.allocations.length, 1);
    assert.equal(lines[0]?.allocations[0]?.partId, scenario.buildLinePartId);
    assert.equal(lines[0]?.allocations[0]?.sourceLocationId, scenario.sourceLocationId);
    assert.equal(lines[0]?.allocations[0]?.quantity, 6);
  });

  test("createBuild rejects a missing output location", async () => {
    const scenario = await createScenario(uniqueSuffix());
    const build = await createBuild({
      userId: scenario.userId,
      workspaceId: scenario.workspaceId,
      designRevisionId: scenario.revisionId,
      targetQuantity: 2,
      outputLocationId: null
    });
    assert.equal(build.ok, false);
    assert.equal((build as { ok: false; error: string }).error, "output-location-required");
  });

  test("allocate → start reserves stock; assemble consumes and completes", async () => {
    const scenario = await createScenario(uniqueSuffix(), { stockAtSource: "6" });
    const { buildId } = await createAndAllocateBuild(scenario, 2);

    const allocated = await markBuildAllocated({
      userId: scenario.userId,
      workspaceId: scenario.workspaceId,
      buildId
    });
    assert.ok(allocated.ok, JSON.stringify(allocated));
    assert.equal((await partStock(scenario.workspaceId, scenario.buildLinePartId)).allocatedQty, "6");

    const started = await startBuild({
      userId: scenario.userId,
      workspaceId: scenario.workspaceId,
      buildId
    });
    assert.ok(started.ok, JSON.stringify(started));

    let component = await partStock(scenario.workspaceId, scenario.buildLinePartId);
    assert.equal(component.reservedQty, "6", "reservation applied");
    assert.equal(component.allocatedQty, "0", "allocation converted to reservation");
    assert.equal(component.currentStock, "6", "stock not yet consumed");

    const assignments = await prisma.buildDesignatorAssignment.findMany({
      where: { buildLineItem: { buildId } },
      orderBy: [{ designator: "asc" }, { unitIndex: "asc" }],
      select: { id: true, partId: true, designator: true, unitIndex: true }
    });
    // 3 designators × targetQuantity 2 = 6 (designator, unit) rows.
    assert.equal(assignments.length, 6);
    assert.ok(assignments.every((a) => a.partId === scenario.buildLinePartId));

    // Partially assemble the first designator: unit 1 of its 2 units.
    const partial = await assembleDesignator({
      userId: scenario.userId,
      workspaceId: scenario.workspaceId,
      assignmentId: assignments[0]!.id
    });
    assert.ok(partial.ok, JSON.stringify(partial));
    assert.equal(partial.data.completed, false);

    component = await partStock(scenario.workspaceId, scenario.buildLinePartId);
    assert.equal(component.currentStock, "5", "only one unit consumed");
    assert.equal(component.reservedQty, "5");
    assert.equal(
      (await prisma.build.findFirstOrThrow({ where: { id: buildId }, select: { state: true } })).state,
      "IN_PROGRESS"
    );

    // Assemble unit 2 of the first designator, then both units of the remaining two designators.
    for (const assignment of assignments.slice(1, 5)) {
      await assembleDesignator({
        userId: scenario.userId,
        workspaceId: scenario.workspaceId,
        assignmentId: assignment.id
      });
    }
    const third = await assembleDesignator({
      userId: scenario.userId,
      workspaceId: scenario.workspaceId,
      assignmentId: assignments[5]!.id
    });
    assert.ok(third.ok, JSON.stringify(third));
    assert.equal(third.data.completed, true);

    component = await partStock(scenario.workspaceId, scenario.buildLinePartId);
    assert.equal(component.currentStock, "0", "all component stock consumed");
    assert.equal(component.reservedQty, "0", "all reservation released");

    const build = await prisma.build.findFirstOrThrow({
      where: { id: buildId },
      select: { state: true, completedAt: true }
    });
    assert.equal(build.state, "COMPLETED");
    assert.ok(build.completedAt);

    const output = await prisma.part.findFirstOrThrow({
      where: { id: scenario.outputPartId },
      select: { currentStock: true }
    });
    assert.equal(output.currentStock.toString(), "2", "output part received targetQuantity");
  });

  test("split allocation across two parts reserves and assembles each part", async () => {
    const scenario = await createSplitScenario(uniqueSuffix(), { stockA: "10", stockB: "10" });
    const buildId = await createBuildFor(scenario, 2); // R1-R3 × 2 = 6 units
    const line = await firstLineId(buildId);

    // 4 from part A, 2 from part B.
    await setAllocations(scenario, line.id, [
      { partId: scenario.partAId, sourceLocationId: scenario.locationAId, quantity: 4 },
      { partId: scenario.partBId, sourceLocationId: scenario.locationBId, quantity: 2 }
    ]);

    await markBuildAllocated({ userId: scenario.userId, workspaceId: scenario.workspaceId, buildId });
    assert.equal((await partStock(scenario.workspaceId, scenario.partAId)).allocatedQty, "4");
    assert.equal((await partStock(scenario.workspaceId, scenario.partBId)).allocatedQty, "2");

    const started = await startBuild({ userId: scenario.userId, workspaceId: scenario.workspaceId, buildId });
    assert.ok(started.ok, JSON.stringify(started));
    assert.equal((await partStock(scenario.workspaceId, scenario.partAId)).reservedQty, "4");
    assert.equal((await partStock(scenario.workspaceId, scenario.partBId)).reservedQty, "2");

    const assignments = await prisma.buildDesignatorAssignment.findMany({
      where: { buildLineItem: { buildId } },
      orderBy: [{ designator: "asc" }, { unitIndex: "asc" }],
      select: { id: true, designator: true, partId: true, unitIndex: true }
    });
    // R1, R2 -> part A (2 units each); R3 -> part B (2 units). One row per (designator, unit).
    assert.equal(assignments.length, 6);
    const partAUnits = assignments.filter((a) => a.partId === scenario.partAId).length;
    const partBUnits = assignments.filter((a) => a.partId === scenario.partBId).length;
    assert.equal(partAUnits, 4);
    assert.equal(partBUnits, 2);

    // Assemble everything and confirm each part is consumed from its own stock.
    for (const assignment of assignments) {
      const result = await assembleDesignator({
        userId: scenario.userId,
        workspaceId: scenario.workspaceId,
        assignmentId: assignment.id
      });
      assert.ok(result.ok, JSON.stringify(result));
    }

    assert.equal((await partStock(scenario.workspaceId, scenario.partAId)).currentStock, "6");
    assert.equal((await partStock(scenario.workspaceId, scenario.partBId)).currentStock, "8");
    assert.equal(
      (await prisma.build.findFirstOrThrow({ where: { id: buildId }, select: { state: true } })).state,
      "COMPLETED"
    );
    assert.equal(
      (await prisma.part.findFirstOrThrow({ where: { id: scenario.outputPartId }, select: { currentStock: true } }))
        .currentStock.toString(),
      "2"
    );
  });

  test("assembleBuildUnit assembles every designator for one unit and completes only when all units are done", async () => {
    const scenario = await createScenario(uniqueSuffix(), { stockAtSource: "6" });
    const { buildId } = await createAndAllocateBuild(scenario, 2); // 3 designators × 2 units

    await markBuildAllocated({ userId: scenario.userId, workspaceId: scenario.workspaceId, buildId });
    await startBuild({ userId: scenario.userId, workspaceId: scenario.workspaceId, buildId });

    const unit1 = await assembleBuildUnit({
      userId: scenario.userId,
      workspaceId: scenario.workspaceId,
      buildId,
      unitIndex: 1
    });
    assert.ok(unit1.ok, JSON.stringify(unit1));
    assert.equal(unit1.data.completed, false);

    const rowsAfterUnit1 = await prisma.buildDesignatorAssignment.findMany({
      where: { buildLineItem: { buildId } },
      select: { unitIndex: true, assembled: true }
    });
    assert.ok(rowsAfterUnit1.filter((r) => r.unitIndex === 1).every((r) => r.assembled));
    assert.ok(rowsAfterUnit1.filter((r) => r.unitIndex === 2).every((r) => !r.assembled));

    const partial = await partStock(scenario.workspaceId, scenario.buildLinePartId);
    assert.equal(partial.currentStock, "3", "one whole unit (3 designators) consumed");
    assert.equal(
      (await prisma.build.findFirstOrThrow({ where: { id: buildId }, select: { state: true } })).state,
      "IN_PROGRESS"
    );

    // Re-assembling an already-complete unit is rejected.
    const again = await assembleBuildUnit({
      userId: scenario.userId,
      workspaceId: scenario.workspaceId,
      buildId,
      unitIndex: 1
    });
    assert.equal(again.ok, false);
    if (!again.ok) assert.equal(again.error, "unit-already-assembled");

    const unit2 = await assembleBuildUnit({
      userId: scenario.userId,
      workspaceId: scenario.workspaceId,
      buildId,
      unitIndex: 2
    });
    assert.ok(unit2.ok, JSON.stringify(unit2));
    assert.equal(unit2.data.completed, true);

    const build = await prisma.build.findFirstOrThrow({
      where: { id: buildId },
      select: { state: true }
    });
    assert.equal(build.state, "COMPLETED");
  });

  test("per-unit split assigns mixed parts to a single designator", async () => {
    // 2 designators × build qty 5 = 10 units; 7 from A + 3 from B splits R2 across both.
    const scenario = await createSplitScenario(uniqueSuffix(), {
      designators: "R1, R2",
      stockA: "10",
      stockB: "10"
    });
    const buildId = await createBuildFor(scenario, 5);
    const line = await firstLineId(buildId);

    await setAllocations(scenario, line.id, [
      { partId: scenario.partAId, sourceLocationId: scenario.locationAId, quantity: 7 },
      { partId: scenario.partBId, sourceLocationId: scenario.locationBId, quantity: 3 }
    ]);
    await markBuildAllocated({ userId: scenario.userId, workspaceId: scenario.workspaceId, buildId });
    const started = await startBuild({ userId: scenario.userId, workspaceId: scenario.workspaceId, buildId });
    assert.ok(started.ok, JSON.stringify(started));

    const r2Rows = await prisma.buildDesignatorAssignment.findMany({
      where: { buildLineItem: { buildId }, designator: "R2" },
      orderBy: { unitIndex: "asc" },
      select: { partId: true, unitIndex: true }
    });
    // R1 takes 5 of A, so R2 is 2×A + 3×B — 5 (designator, unit) rows split across two parts.
    assert.equal(r2Rows.length, 5);
    const r2ByPart = new Map<string, number>();
    for (const row of r2Rows) {
      r2ByPart.set(row.partId as string, (r2ByPart.get(row.partId as string) ?? 0) + 1);
    }
    assert.equal(r2ByPart.get(scenario.partAId), 2);
    assert.equal(r2ByPart.get(scenario.partBId), 3);

    assert.equal((await partStock(scenario.workspaceId, scenario.partAId)).reservedQty, "7");
    assert.equal((await partStock(scenario.workspaceId, scenario.partBId)).reservedQty, "3");
  });

  test("reassign moves a designator to another matching part and rejects invalid targets", async () => {
    const scenario = await createSplitScenario(uniqueSuffix(), {
      designators: "R1, R2, R3",
      stockA: "10",
      stockB: "10"
    });
    const buildId = await createBuildFor(scenario, 1); // 3 units
    const line = await firstLineId(buildId);
    await setAllocations(scenario, line.id, [
      { partId: scenario.partAId, sourceLocationId: scenario.locationAId, quantity: 3 }
    ]);
    await markBuildAllocated({ userId: scenario.userId, workspaceId: scenario.workspaceId, buildId });
    await startBuild({ userId: scenario.userId, workspaceId: scenario.workspaceId, buildId });

    assert.equal((await partStock(scenario.workspaceId, scenario.partAId)).reservedQty, "3");

    const rows = await prisma.buildDesignatorAssignment.findMany({
      where: { buildLineItem: { buildId } },
      orderBy: { designator: "asc" },
      select: { id: true }
    });

    // Reject a non-matching part.
    const badPart = await reassignDesignatorAssignment({
      userId: scenario.userId,
      workspaceId: scenario.workspaceId,
      assignmentId: rows[0]!.id,
      partId: scenario.outsiderPartId,
      sourceLocationId: scenario.locationAId
    });
    assert.equal(badPart.ok, false);
    if (!badPart.ok) assert.equal(badPart.error, "part-does-not-match-spec");

    // Move R1 from part A to part B.
    const moved = await reassignDesignatorAssignment({
      userId: scenario.userId,
      workspaceId: scenario.workspaceId,
      assignmentId: rows[0]!.id,
      partId: scenario.partBId,
      sourceLocationId: scenario.locationBId
    });
    assert.ok(moved.ok, JSON.stringify(moved));
    assert.equal((await partStock(scenario.workspaceId, scenario.partAId)).reservedQty, "2");
    assert.equal((await partStock(scenario.workspaceId, scenario.partBId)).reservedQty, "1");

    // An already-assembled row can no longer be reassigned.
    await assembleDesignator({
      userId: scenario.userId,
      workspaceId: scenario.workspaceId,
      assignmentId: rows[1]!.id
    });
    const tooLate = await reassignDesignatorAssignment({
      userId: scenario.userId,
      workspaceId: scenario.workspaceId,
      assignmentId: rows[1]!.id,
      partId: scenario.partBId,
      sourceLocationId: scenario.locationBId
    });
    assert.equal(tooLate.ok, false);
    if (!tooLate.ok) assert.equal(tooLate.error, "designator-already-assembled");
  });

  test("setBuildLineAllocations rejects allocating more than available stock", async () => {
    const scenario = await createSplitScenario(uniqueSuffix(), { stockA: "3", stockB: "3" });
    const buildId = await createBuildFor(scenario, 2); // R1-R3 × 2 = 6 units
    const line = await firstLineId(buildId);

    // Over part A's available (3).
    const overPart = await setBuildLineAllocations({
      userId: scenario.userId,
      workspaceId: scenario.workspaceId,
      buildLineItemId: line.id,
      entries: [{ partId: scenario.partAId, sourceLocationId: scenario.locationAId, quantity: 6 }]
    });
    assert.equal(overPart.ok, false);
    if (!overPart.ok) assert.equal(overPart.error, "insufficient-available-stock");

    // Give part A enough overall (6) but keep only 3 at location A; allocating 6 there overdraws
    // the location even though the part-level total would cover it.
    await createInventoryEntry({
      workspaceId: scenario.workspaceId,
      partId: scenario.partAId,
      entryType: "RECEIPT",
      quantity: "3",
      toLocationId: scenario.locationBId
    });
    const overLocation = await setBuildLineAllocations({
      userId: scenario.userId,
      workspaceId: scenario.workspaceId,
      buildLineItemId: line.id,
      entries: [{ partId: scenario.partAId, sourceLocationId: scenario.locationAId, quantity: 6 }]
    });
    assert.equal(overLocation.ok, false);
    if (!overLocation.ok) assert.equal(overLocation.error, "insufficient-location-stock");

    // Within stock: 3 from A (location A) + 3 from A (location B).
    const ok = await setBuildLineAllocations({
      userId: scenario.userId,
      workspaceId: scenario.workspaceId,
      buildLineItemId: line.id,
      entries: [
        { partId: scenario.partAId, sourceLocationId: scenario.locationAId, quantity: 3 },
        { partId: scenario.partAId, sourceLocationId: scenario.locationBId, quantity: 3 }
      ]
    });
    assert.ok(ok.ok, JSON.stringify(ok));
  });

  test("setBuildAllocations saves all lines atomically and rejects aggregate over-allocation", async () => {
    // Two lines share part A (only 5 in stock): line 1 needs 5, line 2 needs 1.
    const scenario = await createSplitScenario(uniqueSuffix(), {
      designators: "R1, R2, R3, R4, R5",
      secondLineDesignators: "R6",
      stockA: "5",
      stockB: "10"
    });
    const buildId = await createBuildFor(scenario, 1);
    const lines = await prisma.buildLineItem.findMany({
      where: { buildId },
      orderBy: { createdAt: "asc" },
      select: { id: true }
    });
    const [line1, line2] = lines;

    // Both lines on A at once would need 6 > 5 — rejected atomically.
    const over = await setBuildAllocations({
      userId: scenario.userId,
      workspaceId: scenario.workspaceId,
      buildId,
      lines: [
        { buildLineItemId: line1!.id, entries: [{ partId: scenario.partAId, sourceLocationId: scenario.locationAId, quantity: 5 }] },
        { buildLineItemId: line2!.id, entries: [{ partId: scenario.partAId, sourceLocationId: scenario.locationAId, quantity: 1 }] }
      ]
    });
    assert.equal(over.ok, false);
    if (!over.ok) assert.equal(over.error, "insufficient-available-stock");

    // Valid: line 1 uses all of A, line 2 uses B.
    const ok = await setBuildAllocations({
      userId: scenario.userId,
      workspaceId: scenario.workspaceId,
      buildId,
      lines: [
        { buildLineItemId: line1!.id, entries: [{ partId: scenario.partAId, sourceLocationId: scenario.locationAId, quantity: 5 }] },
        { buildLineItemId: line2!.id, entries: [{ partId: scenario.partBId, sourceLocationId: scenario.locationBId, quantity: 1 }] }
      ]
    });
    assert.ok(ok.ok, JSON.stringify(ok));

    // Reallocate atomically — move A off line 1 and onto line 2 in a single save. Because it is one
    // transaction, the intermediate "A on both lines" over-allocation can never be persisted.
    const moved = await setBuildAllocations({
      userId: scenario.userId,
      workspaceId: scenario.workspaceId,
      buildId,
      lines: [
        { buildLineItemId: line1!.id, entries: [] },
        { buildLineItemId: line2!.id, entries: [{ partId: scenario.partAId, sourceLocationId: scenario.locationAId, quantity: 1 }] }
      ]
    });
    assert.ok(moved.ok, JSON.stringify(moved));

    const line1Allocs = await prisma.buildLineAllocation.count({ where: { buildLineItemId: line1!.id } });
    const line2Allocs = await prisma.buildLineAllocation.findMany({
      where: { buildLineItemId: line2!.id },
      select: { partId: true, quantity: true }
    });
    assert.equal(line1Allocs, 0, "line 1 emptied");
    assert.equal(line2Allocs.length, 1);
    assert.equal(line2Allocs[0]?.partId, scenario.partAId);
    assert.equal(line2Allocs[0]?.quantity, 1);
  });

  test("createBuild pre-fill does not over-allocate a part shared by two lines", async () => {
    // Part A has only 3 in stock; two lines each need 2. The greedy pre-fill must split A across the
    // lines rather than suggest 2+2, so its total suggested quantity of A never exceeds 3.
    const scenario = await createSplitScenario(uniqueSuffix(), {
      designators: "R1, R2",
      secondLineDesignators: "R3, R4",
      stockA: "3",
      stockB: "5"
    });
    const buildId = await createBuildFor(scenario, 1); // each line requires 2

    const allocations = await prisma.buildLineAllocation.findMany({
      where: { buildLineItem: { buildId }, partId: scenario.partAId },
      select: { quantity: true }
    });
    const totalA = allocations.reduce((sum, a) => sum + a.quantity, 0);
    assert.ok(totalA <= 3, `pre-fill suggested ${totalA} of part A but only 3 exist`);
  });

  test("allocation nets stock already allocated by the build's other lines", async () => {
    // Two lines share the same matching part A, which has only 5 available.
    const scenario = await createSplitScenario(uniqueSuffix(), {
      designators: "R1, R2",
      secondLineDesignators: "R3, R4",
      stockA: "5",
      stockB: "0"
    });
    const buildId = await createBuildFor(scenario, 1); // each line requires 2
    const lines = await prisma.buildLineItem.findMany({
      where: { buildId },
      orderBy: { createdAt: "asc" },
      select: { id: true }
    });
    const [line1, line2] = lines;

    // Line 2 takes 2 of A.
    await setAllocations(scenario, line2!.id, [
      { partId: scenario.partAId, sourceLocationId: scenario.locationAId, quantity: 2 }
    ]);

    // Line 1 cannot take 4: only 3 of A remain once line 2's 2 are netted out.
    const over = await setBuildLineAllocations({
      userId: scenario.userId,
      workspaceId: scenario.workspaceId,
      buildLineItemId: line1!.id,
      entries: [{ partId: scenario.partAId, sourceLocationId: scenario.locationAId, quantity: 4 }]
    });
    assert.equal(over.ok, false);
    if (!over.ok) assert.equal(over.error, "insufficient-available-stock");

    // 3 fits within what remains.
    const ok = await setBuildLineAllocations({
      userId: scenario.userId,
      workspaceId: scenario.workspaceId,
      buildLineItemId: line1!.id,
      entries: [{ partId: scenario.partAId, sourceLocationId: scenario.locationAId, quantity: 3 }]
    });
    assert.ok(ok.ok, JSON.stringify(ok));
  });

  test("start is rejected when available stock drops after allocation", async () => {
    // Allocation succeeds against 6 on hand; stock is then consumed elsewhere so start no longer
    // has enough available — the start guard is the safety net once allocation is locked in.
    const scenario = await createScenario(uniqueSuffix(), { stockAtSource: "6" });
    const { buildId } = await createAndAllocateBuild(scenario, 2); // requires 6
    await markBuildAllocated({ userId: scenario.userId, workspaceId: scenario.workspaceId, buildId });

    await createInventoryEntry({
      workspaceId: scenario.workspaceId,
      partId: scenario.buildLinePartId,
      entryType: "ISSUE",
      quantity: "3",
      fromLocationId: scenario.sourceLocationId
    });

    const started = await startBuild({
      userId: scenario.userId,
      workspaceId: scenario.workspaceId,
      buildId
    });
    assert.equal(started.ok, false);
    if (!started.ok) assert.equal(started.error, "insufficient-available-stock");

    const component = await partStock(scenario.workspaceId, scenario.buildLinePartId);
    assert.equal(component.reservedQty, "0", "no reservation on failed start");
  });

  test("start is rejected when the source location balance drops after allocation", async () => {
    // Allocate 6 at the source, then move 3 away so part-level available (6) still covers the
    // requirement but the chosen source location no longer does.
    const scenario = await createScenario(uniqueSuffix(), { stockAtSource: "6" });
    const { buildId } = await createAndAllocateBuild(scenario, 2); // requires 6 at source
    await markBuildAllocated({ userId: scenario.userId, workspaceId: scenario.workspaceId, buildId });

    await createInventoryEntry({
      workspaceId: scenario.workspaceId,
      partId: scenario.buildLinePartId,
      entryType: "TRANSFER",
      quantity: "3",
      fromLocationId: scenario.sourceLocationId,
      toLocationId: scenario.secondLocationId
    });

    const started = await startBuild({
      userId: scenario.userId,
      workspaceId: scenario.workspaceId,
      buildId
    });
    assert.equal(started.ok, false);
    if (!started.ok) assert.equal(started.error, "insufficient-location-stock");
  });

  test("transfer after start carries reserved units along so source available never goes negative", async () => {
    // Start reserves 3 of the 6 units at the source (targetQuantity 1 × 3 designators). Transferring
    // 5 of the 6 units away dips 2 units into the reservation, so 2 of the 3 reserved designator
    // assignments must relocate to the destination, leaving the source with 1 unreserved unit.
    const scenario = await createScenario(uniqueSuffix(), { stockAtSource: "6" });
    const { buildId } = await createAndAllocateBuild(scenario, 1); // requires 3 at source
    await markBuildAllocated({ userId: scenario.userId, workspaceId: scenario.workspaceId, buildId });
    const started = await startBuild({
      userId: scenario.userId,
      workspaceId: scenario.workspaceId,
      buildId
    });
    assert.ok(started.ok, JSON.stringify(started));

    await createInventoryEntry({
      workspaceId: scenario.workspaceId,
      partId: scenario.buildLinePartId,
      entryType: "TRANSFER",
      quantity: "5",
      fromLocationId: scenario.sourceLocationId,
      toLocationId: scenario.secondLocationId
    });

    const available = await getPartLocationAvailableBalances({
      workspaceId: scenario.workspaceId,
      partId: scenario.buildLinePartId
    });
    assert.equal(available.get(scenario.sourceLocationId)?.toString(), "0", "source available never negative");
    assert.equal(available.get(scenario.secondLocationId)?.toString(), "3");

    const balances = await getPartLocationBalances({
      workspaceId: scenario.workspaceId,
      partId: scenario.buildLinePartId
    });
    assert.equal(balances.get(scenario.sourceLocationId)?.toString(), "1");
    assert.equal(balances.get(scenario.secondLocationId)?.toString(), "5");

    const assignmentsBySource = await prisma.buildDesignatorAssignment.groupBy({
      by: ["sourceLocationId"],
      where: { buildLineItem: { buildId }, assembled: false },
      _count: { _all: true }
    });
    const countByLocation = new Map(
      assignmentsBySource.map((row) => [row.sourceLocationId, row._count._all])
    );
    assert.equal(countByLocation.get(scenario.sourceLocationId), 1, "one reservation stays at source");
    assert.equal(countByLocation.get(scenario.secondLocationId), 2, "two reservations relocate with the transfer");
  });

  test("getBuildDetail flags an ALLOCATED build whose available stock dropped since allocation", async () => {
    const scenario = await createScenario(uniqueSuffix(), { stockAtSource: "6" });
    const { buildId, lineId } = await createAndAllocateBuild(scenario, 2); // requires 6
    await markBuildAllocated({ userId: scenario.userId, workspaceId: scenario.workspaceId, buildId });

    const beforeDetail = await getBuildDetail({
      userId: scenario.userId,
      workspaceId: scenario.workspaceId,
      buildId
    });
    assert.equal(beforeDetail?.allocationWarnings.length, 0);

    await createInventoryEntry({
      workspaceId: scenario.workspaceId,
      partId: scenario.buildLinePartId,
      entryType: "ISSUE",
      quantity: "3",
      fromLocationId: scenario.sourceLocationId
    });

    const detail = await getBuildDetail({
      userId: scenario.userId,
      workspaceId: scenario.workspaceId,
      buildId
    });
    assert.equal(detail?.allocationWarnings.length, 1);
    assert.equal(detail?.allocationWarnings[0]?.lineItemId, lineId);
    assert.equal(detail?.allocationWarnings[0]?.partId, scenario.buildLinePartId);
    assert.equal(detail?.allocationWarnings[0]?.reason, "insufficient-available-stock");

    // The build is still allocated, not reserved — the warning does not itself change stock.
    const component = await partStock(scenario.workspaceId, scenario.buildLinePartId);
    assert.equal(component.reservedQty, "0");
  });

  test("getBuildDetail flags an ALLOCATED build whose source-location balance dropped since allocation", async () => {
    const scenario = await createScenario(uniqueSuffix(), { stockAtSource: "6" });
    const { buildId } = await createAndAllocateBuild(scenario, 2); // requires 6 at source
    await markBuildAllocated({ userId: scenario.userId, workspaceId: scenario.workspaceId, buildId });

    await createInventoryEntry({
      workspaceId: scenario.workspaceId,
      partId: scenario.buildLinePartId,
      entryType: "TRANSFER",
      quantity: "3",
      fromLocationId: scenario.sourceLocationId,
      toLocationId: scenario.secondLocationId
    });

    const detail = await getBuildDetail({
      userId: scenario.userId,
      workspaceId: scenario.workspaceId,
      buildId
    });
    assert.equal(detail?.allocationWarnings.length, 1);
    assert.equal(detail?.allocationWarnings[0]?.reason, "insufficient-location-stock");
  });

  test("cancel from started releases reservation without reversing assembled parts", async () => {
    const scenario = await createScenario(uniqueSuffix(), { stockAtSource: "6" });
    const { buildId } = await createAndAllocateBuild(scenario, 2);

    await markBuildAllocated({ userId: scenario.userId, workspaceId: scenario.workspaceId, buildId });
    await startBuild({ userId: scenario.userId, workspaceId: scenario.workspaceId, buildId });

    const assignments = await prisma.buildDesignatorAssignment.findMany({
      where: { buildLineItem: { buildId } },
      orderBy: [{ designator: "asc" }, { unitIndex: "asc" }],
      select: { id: true }
    });
    // Assemble both units of the first designator.
    await assembleDesignator({
      userId: scenario.userId,
      workspaceId: scenario.workspaceId,
      assignmentId: assignments[0]!.id
    });
    await assembleDesignator({
      userId: scenario.userId,
      workspaceId: scenario.workspaceId,
      assignmentId: assignments[1]!.id
    });

    const cancelled = await cancelBuild({
      userId: scenario.userId,
      workspaceId: scenario.workspaceId,
      buildId
    });
    assert.ok(cancelled.ok, JSON.stringify(cancelled));

    const component = await partStock(scenario.workspaceId, scenario.buildLinePartId);
    assert.equal(component.currentStock, "4", "assembled parts stay consumed");
    assert.equal(component.reservedQty, "0", "remaining reservation released");

    assert.equal(
      (await prisma.build.findFirstOrThrow({ where: { id: buildId }, select: { state: true } })).state,
      "CANCELLED"
    );
  });

  test("cancel from allocated releases the soft allocation", async () => {
    const scenario = await createScenario(uniqueSuffix(), { stockAtSource: "6" });
    const { buildId } = await createAndAllocateBuild(scenario, 2);

    await markBuildAllocated({ userId: scenario.userId, workspaceId: scenario.workspaceId, buildId });
    assert.equal((await partStock(scenario.workspaceId, scenario.buildLinePartId)).allocatedQty, "6");

    const cancelled = await cancelBuild({
      userId: scenario.userId,
      workspaceId: scenario.workspaceId,
      buildId
    });
    assert.ok(cancelled.ok);

    const component = await partStock(scenario.workspaceId, scenario.buildLinePartId);
    assert.equal(component.allocatedQty, "0", "soft allocation released");
    assert.equal(component.reservedQty, "0");
  });

  test("per-location available balance nets out another build's hard reservation at that location (refs #172)", async () => {
    const scenario = await createScenario(uniqueSuffix(), { stockAtSource: "10" });

    // Build A reserves 6 units of the component at the source location (STARTED).
    const { buildId: buildAId } = await createAndAllocateBuild(scenario, 2); // 3 designators × 2
    await markBuildAllocated({ userId: scenario.userId, workspaceId: scenario.workspaceId, buildId: buildAId });
    const startedA = await startBuild({ userId: scenario.userId, workspaceId: scenario.workspaceId, buildId: buildAId });
    assert.ok(startedA.ok, JSON.stringify(startedA));

    // Raw physical stock at the location is untouched by reservation; only what's usable shrinks.
    const rawBalances = await getPartLocationBalances({
      workspaceId: scenario.workspaceId,
      partId: scenario.buildLinePartId
    });
    assert.equal(rawBalances.get(scenario.sourceLocationId)?.toString(), "10");

    const availableBalances = await getPartLocationAvailableBalances({
      workspaceId: scenario.workspaceId,
      partId: scenario.buildLinePartId
    });
    assert.equal(availableBalances.get(scenario.sourceLocationId)?.toString(), "4");

    // A second, still-CREATED build's allocation picker must offer the reservation-aware figure,
    // not the raw physical balance, for the same source location.
    const buildBId = await createBuildFor(scenario, 1); // 3 designators × 1
    const detail = await getBuildDetail({
      userId: scenario.userId,
      workspaceId: scenario.workspaceId,
      buildId: buildBId
    });
    const line = detail?.lines[0];
    const partBalances = line?.partBalances.find((pb) => pb.partId === scenario.buildLinePartId);
    const sourceBalance = partBalances?.balances.find((b) => b.locationId === scenario.sourceLocationId);
    assert.equal(sourceBalance?.balance, "4");
  });
});
