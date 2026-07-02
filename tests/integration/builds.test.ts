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
import { createInventoryEntry } from "../../src/server/inventory/entryMutations";
import {
  allocateBuildLine,
  assembleDesignator,
  cancelBuild,
  createBuild,
  markBuildAllocated,
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

/**
 * Build a workspace with one component part, two locations, an output design + revision, and a
 * BOM line pinned to the component with designators R1-R3. Returns the ids needed to drive a
 * build. `stockAtSource` parts are received into the source location (default 6).
 */
async function createScenario(
  suffix: string,
  options: { stockAtSource?: string; stockAtSecond?: string } = {}
): Promise<Scenario> {
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

  const manufacturer = await prisma.organization.create({
    data: {
      workspaceId,
      name: `Builds Manufacturer ${suffix}`,
      normalizedName: `builds-manufacturer-${suffix}`
    },
    select: { id: true }
  });

  const componentPart = await prisma.part.create({
    data: {
      workspaceId,
      unitId: unitId as string,
      manufacturerId: manufacturer.id,
      catalogNumber: `RES-${suffix}`
    },
    select: { id: true }
  });

  const sourceLocation = await prisma.storageLocation.create({
    data: {
      workspaceId,
      name: `Source ${suffix}`,
      normalizedName: `source-${suffix}`,
      isAssignable: true
    },
    select: { id: true }
  });
  const secondLocation = await prisma.storageLocation.create({
    data: {
      workspaceId,
      name: `Second ${suffix}`,
      normalizedName: `second-${suffix}`,
      isAssignable: true
    },
    select: { id: true }
  });
  const outputLocation = await prisma.storageLocation.create({
    data: {
      workspaceId,
      name: `Output ${suffix}`,
      normalizedName: `output-${suffix}`,
      isAssignable: true
    },
    select: { id: true }
  });

  const stockAtSource = options.stockAtSource ?? "6";
  if (stockAtSource !== "0") {
    await createInventoryEntry({
      workspaceId,
      partId: componentPart.id,
      entryType: "RECEIPT",
      quantity: stockAtSource,
      toLocationId: sourceLocation.id
    });
  }
  if (options.stockAtSecond && options.stockAtSecond !== "0") {
    await createInventoryEntry({
      workspaceId,
      partId: componentPart.id,
      entryType: "RECEIPT",
      quantity: options.stockAtSecond,
      toLocationId: secondLocation.id
    });
  }

  const design = await createDesign({
    userId,
    workspaceId,
    workspaceName: `Builds Workspace ${suffix}`,
    name: "Board",
    catalogNumber: `BOARD-${suffix}`,
    unitId: unitId as string
  });
  assert.ok(design.ok);

  const revision = await prisma.designRevision.findFirst({
    where: { workspaceId, designId: design.id },
    select: { id: true }
  });
  assert.ok(revision);

  const design2 = await prisma.design.findUnique({
    where: { id: design.id },
    select: { outputPartId: true }
  });
  assert.ok(design2);

  const line = await createBomLineItem({
    userId,
    workspaceId,
    revisionId: revision.id,
    input: {
      designators: "R1, R2, R3",
      pinnedPartId: componentPart.id,
      matchers: []
    }
  });
  assert.ok(line.ok, JSON.stringify(line));

  return {
    workspaceId,
    userId,
    revisionId: revision.id,
    buildLinePartId: componentPart.id,
    outputPartId: design2.outputPartId,
    sourceLocationId: sourceLocation.id,
    secondLocationId: secondLocation.id,
    outputLocationId: outputLocation.id
  };
}

async function reservedAndStock(workspaceId: string, partId: string) {
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

async function createAndAllocateBuild(scenario: Scenario, targetQuantity = 2) {
  const build = await createBuild({
    userId: scenario.userId,
    workspaceId: scenario.workspaceId,
    designRevisionId: scenario.revisionId,
    targetQuantity,
    outputLocationId: scenario.outputLocationId
  });
  assert.ok(build.ok, JSON.stringify(build));

  const line = await prisma.buildLineItem.findFirstOrThrow({
    where: { buildId: build.data.id },
    select: { id: true }
  });

  const allocate = await allocateBuildLine({
    userId: scenario.userId,
    workspaceId: scenario.workspaceId,
    buildLineItemId: line.id,
    partId: scenario.buildLinePartId,
    sourceLocationId: scenario.sourceLocationId
  });
  assert.ok(allocate.ok, JSON.stringify(allocate));

  return { buildId: build.data.id, lineId: line.id };
}

describe("build flow", () => {
  test("createBuild snapshots one line and three designator assignments", async () => {
    const scenario = await createScenario(uniqueSuffix());
    const build = await createBuild({
      userId: scenario.userId,
      workspaceId: scenario.workspaceId,
      designRevisionId: scenario.revisionId,
      targetQuantity: 2,
      outputLocationId: scenario.outputLocationId
    });
    assert.ok(build.ok);

    const lines = await prisma.buildLineItem.findMany({
      where: { buildId: build.data.id },
      select: {
        designatorCount: true,
        partId: true,
        assignments: { select: { designator: true, quantity: true, assembledQuantity: true } }
      }
    });
    assert.equal(lines.length, 1);
    assert.equal(lines[0]?.designatorCount, 3);
    assert.equal(lines[0]?.partId, scenario.buildLinePartId, "pinned part auto-assigned");
    assert.equal(lines[0]?.assignments.length, 3);
    assert.ok(lines[0]?.assignments.every((a) => a.quantity === 2 && a.assembledQuantity === 0));
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
    assert.equal((await reservedAndStock(scenario.workspaceId, scenario.buildLinePartId)).allocatedQty, "6");

    const started = await startBuild({
      userId: scenario.userId,
      workspaceId: scenario.workspaceId,
      buildId
    });
    assert.ok(started.ok, JSON.stringify(started));

    let component = await reservedAndStock(scenario.workspaceId, scenario.buildLinePartId);
    assert.equal(component.reservedQty, "6", "reservation applied");
    assert.equal(component.allocatedQty, "0", "allocation converted to reservation");
    assert.equal(component.currentStock, "6", "stock not yet consumed");

    const assignments = await prisma.buildDesignatorAssignment.findMany({
      where: { buildLineItem: { buildId } },
      orderBy: { designator: "asc" },
      select: { id: true }
    });
    assert.equal(assignments.length, 3);

    // Partially assemble the first designator: 1 of its 2 units. Consumes 1, releases 1
    // reserved, build → IN_PROGRESS but not complete.
    const partial = await assembleDesignator({
      userId: scenario.userId,
      workspaceId: scenario.workspaceId,
      assignmentId: assignments[0]!.id,
      quantity: 1
    });
    assert.ok(partial.ok, JSON.stringify(partial));
    assert.equal(partial.data.completed, false);

    component = await reservedAndStock(scenario.workspaceId, scenario.buildLinePartId);
    assert.equal(component.currentStock, "5", "only one unit consumed");
    assert.equal(component.reservedQty, "5");
    assert.equal(
      (await prisma.build.findFirstOrThrow({ where: { id: buildId }, select: { state: true } })).state,
      "IN_PROGRESS"
    );

    // Assemble the second unit of the first designator, then the remaining two designators.
    const first = await assembleDesignator({
      userId: scenario.userId,
      workspaceId: scenario.workspaceId,
      assignmentId: assignments[0]!.id,
      quantity: 1
    });
    assert.ok(first.ok && first.data.completed === false);

    const second = await assembleDesignator({
      userId: scenario.userId,
      workspaceId: scenario.workspaceId,
      assignmentId: assignments[1]!.id,
      quantity: 2
    });
    assert.ok(second.ok && second.data.completed === false);

    const third = await assembleDesignator({
      userId: scenario.userId,
      workspaceId: scenario.workspaceId,
      assignmentId: assignments[2]!.id,
      quantity: 2
    });
    assert.ok(third.ok, JSON.stringify(third));
    assert.equal(third.data.completed, true);

    component = await reservedAndStock(scenario.workspaceId, scenario.buildLinePartId);
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

  test("start is rejected when available stock is insufficient", async () => {
    const scenario = await createScenario(uniqueSuffix(), { stockAtSource: "5" });
    const { buildId } = await createAndAllocateBuild(scenario, 2); // requires 6

    await markBuildAllocated({ userId: scenario.userId, workspaceId: scenario.workspaceId, buildId });
    const started = await startBuild({
      userId: scenario.userId,
      workspaceId: scenario.workspaceId,
      buildId
    });
    assert.equal(started.ok, false);
    if (!started.ok) assert.equal(started.error, "insufficient-available-stock");

    const component = await reservedAndStock(scenario.workspaceId, scenario.buildLinePartId);
    assert.equal(component.reservedQty, "0", "no reservation on failed start");
  });

  test("start is rejected when the source location balance is insufficient", async () => {
    // Part-level available is 6 (3 + 3) but only 3 sit in the chosen source location.
    const scenario = await createScenario(uniqueSuffix(), {
      stockAtSource: "3",
      stockAtSecond: "3"
    });
    const { buildId } = await createAndAllocateBuild(scenario, 2); // requires 6 at source

    await markBuildAllocated({ userId: scenario.userId, workspaceId: scenario.workspaceId, buildId });
    const started = await startBuild({
      userId: scenario.userId,
      workspaceId: scenario.workspaceId,
      buildId
    });
    assert.equal(started.ok, false);
    if (!started.ok) assert.equal(started.error, "insufficient-location-stock");
  });

  test("cancel from started releases reservation without reversing assembled parts", async () => {
    const scenario = await createScenario(uniqueSuffix(), { stockAtSource: "6" });
    const { buildId } = await createAndAllocateBuild(scenario, 2);

    await markBuildAllocated({ userId: scenario.userId, workspaceId: scenario.workspaceId, buildId });
    await startBuild({ userId: scenario.userId, workspaceId: scenario.workspaceId, buildId });

    const assignments = await prisma.buildDesignatorAssignment.findMany({
      where: { buildLineItem: { buildId } },
      orderBy: { designator: "asc" },
      select: { id: true }
    });
    // Assemble one full designator (consumes 2), then cancel.
    await assembleDesignator({
      userId: scenario.userId,
      workspaceId: scenario.workspaceId,
      assignmentId: assignments[0]!.id,
      quantity: 2
    });

    const cancelled = await cancelBuild({
      userId: scenario.userId,
      workspaceId: scenario.workspaceId,
      buildId
    });
    assert.ok(cancelled.ok, JSON.stringify(cancelled));

    const component = await reservedAndStock(scenario.workspaceId, scenario.buildLinePartId);
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
    assert.equal((await reservedAndStock(scenario.workspaceId, scenario.buildLinePartId)).allocatedQty, "6");

    const cancelled = await cancelBuild({
      userId: scenario.userId,
      workspaceId: scenario.workspaceId,
      buildId
    });
    assert.ok(cancelled.ok);

    const component = await reservedAndStock(scenario.workspaceId, scenario.buildLinePartId);
    assert.equal(component.allocatedQty, "0", "soft allocation released");
    assert.equal(component.reservedQty, "0");
  });
});
