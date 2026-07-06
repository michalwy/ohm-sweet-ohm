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
  assembleDesignator,
  cancelBuild,
  createBuild,
  getPartBuildAllocations,
  setBuildLineAllocations,
  startBuild
} from "../../src/server/builds/builds";

function uniqueSuffix() {
  return randomBytes(4).toString("hex");
}

type Scenario = {
  workspaceId: string;
  workspaceSlug: string;
  userId: string;
  revisionId: string;
  buildLinePartId: string;
  sourceLocationId: string;
  outputLocationId: string;
};

async function createWorkspaceWithOwner(suffix: string) {
  await ensurePermissions();
  const { workspaceId, workspaceSlug, userId } = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        email: `part-build-allocations-${suffix}@ohmsweetohm.local`,
        emailVerified: true,
        name: "Part Build Allocations User"
      }
    });
    const slug = `part-build-allocations-${suffix}`;
    const workspace = await tx.workspace.create({
      data: { name: `Part Build Allocations Workspace ${suffix}`, slug }
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
    return { workspaceId: workspace.id, workspaceSlug: slug, userId: user.id };
  });

  await ensureDefaultUnitsForWorkspace(prisma, workspaceId);
  const unitId = await getDefaultPartUnitId(prisma, workspaceId);
  assert.ok(unitId, "default unit must exist");
  return { workspaceId, workspaceSlug, userId, unitId: unitId as string };
}

async function createLocation(workspaceId: string, name: string, normalized: string) {
  return prisma.storageLocation.create({
    data: { workspaceId, name, normalizedName: normalized, isAssignable: true },
    select: { id: true }
  });
}

/**
 * Build a workspace with one component part (stocked at a source location), an output design +
 * revision, and a BOM line pinned to the component with designators R1-R3.
 */
async function createScenario(suffix: string, stockAtSource = "6"): Promise<Scenario> {
  const { workspaceId, workspaceSlug, userId, unitId } = await createWorkspaceWithOwner(suffix);

  const manufacturer = await prisma.organization.create({
    data: {
      workspaceId,
      name: `Part Build Allocations Manufacturer ${suffix}`,
      normalizedName: `part-build-allocations-manufacturer-${suffix}`
    },
    select: { id: true }
  });

  const componentPart = await prisma.part.create({
    data: { workspaceId, unitId, manufacturerId: manufacturer.id, catalogNumber: `RES-${suffix}` },
    select: { id: true }
  });

  const sourceLocation = await createLocation(workspaceId, `Source ${suffix}`, `source-${suffix}`);
  const outputLocation = await createLocation(workspaceId, `Output ${suffix}`, `output-${suffix}`);

  await createInventoryEntry({
    workspaceId,
    partId: componentPart.id,
    entryType: "RECEIPT",
    quantity: stockAtSource,
    toLocationId: sourceLocation.id
  });

  const design = await createDesign({
    userId,
    workspaceId,
    workspaceName: `Part Build Allocations Workspace ${suffix}`,
    name: "Board",
    catalogNumber: `BOARD-${suffix}`,
    unitId
  });
  assert.ok(design.ok, JSON.stringify(design));

  const revision = await prisma.designRevision.findFirstOrThrow({
    where: { workspaceId, designId: design.id },
    select: { id: true }
  });

  const created = await createBomLineItem({
    userId,
    workspaceId,
    revisionId: revision.id,
    input: {
      designators: "R1, R2, R3",
      pinnedPartId: componentPart.id,
      categoryId: null,
      matchers: []
    }
  });
  assert.ok(created.ok, JSON.stringify(created));

  return {
    workspaceId,
    workspaceSlug,
    userId,
    revisionId: revision.id,
    buildLinePartId: componentPart.id,
    sourceLocationId: sourceLocation.id,
    outputLocationId: outputLocation.id
  };
}

async function firstLineId(buildId: string) {
  return prisma.buildLineItem.findFirstOrThrow({
    where: { buildId },
    select: { id: true, designatorCount: true }
  });
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
  const buildId = build.data.id;

  const line = await firstLineId(buildId);
  const allocationResult = await setBuildLineAllocations({
    userId: scenario.userId,
    workspaceId: scenario.workspaceId,
    buildLineItemId: line.id,
    entries: [
      {
        partId: scenario.buildLinePartId,
        sourceLocationId: scenario.sourceLocationId,
        quantity: line.designatorCount * targetQuantity
      }
    ]
  });
  assert.ok(allocationResult.ok, JSON.stringify(allocationResult));

  return { buildId, lineId: line.id, requiredUnits: line.designatorCount * targetQuantity };
}

describe("getPartBuildAllocations", () => {
  test("build in ALLOCATING state (with a live allocation) contributes to allocatedQty only", async () => {
    const scenario = await createScenario(uniqueSuffix());
    const { buildId, requiredUnits } = await createAndAllocateBuild(scenario, 2);

    const items = await getPartBuildAllocations({
      userId: scenario.userId,
      workspaceId: scenario.workspaceId,
      partId: scenario.buildLinePartId
    });

    assert.equal(items.length, 1);
    assert.equal(items[0]?.buildId, buildId);
    assert.equal(items[0]?.state, "ALLOCATING");
    assert.equal(items[0]?.allocatedQty, requiredUnits);
    assert.equal(items[0]?.reservedQty, 0);
  });

  test("build in STARTED state contributes to reservedQty only (unassembled units)", async () => {
    const scenario = await createScenario(uniqueSuffix());
    const { buildId, requiredUnits } = await createAndAllocateBuild(scenario, 2);

    const started = await startBuild({
      userId: scenario.userId,
      workspaceId: scenario.workspaceId,
      buildId
    });
    assert.ok(started.ok, JSON.stringify(started));

    const items = await getPartBuildAllocations({
      userId: scenario.userId,
      workspaceId: scenario.workspaceId,
      partId: scenario.buildLinePartId
    });

    assert.equal(items.length, 1);
    assert.equal(items[0]?.buildId, buildId);
    assert.equal(items[0]?.state, "STARTED");
    assert.equal(items[0]?.allocatedQty, 0);
    assert.equal(items[0]?.reservedQty, requiredUnits);
  });

  test("build in IN_PROGRESS state only counts unassembled units toward reservedQty", async () => {
    const scenario = await createScenario(uniqueSuffix());
    const { buildId, requiredUnits } = await createAndAllocateBuild(scenario, 2);

    await startBuild({ userId: scenario.userId, workspaceId: scenario.workspaceId, buildId });

    const assignments = await prisma.buildDesignatorAssignment.findMany({
      where: { buildLineItem: { buildId } },
      orderBy: [{ designator: "asc" }, { unitIndex: "asc" }],
      select: { id: true }
    });
    assert.equal(assignments.length, requiredUnits);

    // Assemble one unit; the build moves to IN_PROGRESS and that unit is no longer "reserved".
    const assembled = await assembleDesignator({
      userId: scenario.userId,
      workspaceId: scenario.workspaceId,
      assignmentId: assignments[0]!.id
    });
    assert.ok(assembled.ok, JSON.stringify(assembled));

    const items = await getPartBuildAllocations({
      userId: scenario.userId,
      workspaceId: scenario.workspaceId,
      partId: scenario.buildLinePartId
    });

    assert.equal(items.length, 1);
    assert.equal(items[0]?.buildId, buildId);
    assert.equal(items[0]?.state, "IN_PROGRESS");
    assert.equal(items[0]?.allocatedQty, 0);
    assert.equal(items[0]?.reservedQty, requiredUnits - 1);
  });

  test("CANCELLED and COMPLETED builds are excluded", async () => {
    const scenario = await createScenario(uniqueSuffix(), "12");

    // ALLOCATING (with a live allocation) appears — see the dedicated test above. Cancelling it
    // must remove it from the list.
    const { buildId: createdBuildId } = await createAndAllocateBuild(scenario, 2);

    let items = await getPartBuildAllocations({
      userId: scenario.userId,
      workspaceId: scenario.workspaceId,
      partId: scenario.buildLinePartId
    });
    assert.equal(items.length, 1, "the ALLOCATING build appears before cancellation");

    const cancelled = await cancelBuild({
      userId: scenario.userId,
      workspaceId: scenario.workspaceId,
      buildId: createdBuildId
    });
    assert.ok(cancelled.ok, JSON.stringify(cancelled));

    items = await getPartBuildAllocations({
      userId: scenario.userId,
      workspaceId: scenario.workspaceId,
      partId: scenario.buildLinePartId
    });
    assert.equal(items.length, 0, "a CANCELLED build must not appear");

    // COMPLETED: a second build, run to completion by assembling every unit.
    const { buildId: completedBuildId, requiredUnits } = await createAndAllocateBuild(scenario, 1);
    await startBuild({
      userId: scenario.userId,
      workspaceId: scenario.workspaceId,
      buildId: completedBuildId
    });
    const assignments = await prisma.buildDesignatorAssignment.findMany({
      where: { buildLineItem: { buildId: completedBuildId } },
      select: { id: true }
    });
    assert.equal(assignments.length, requiredUnits);
    for (const assignment of assignments) {
      const result = await assembleDesignator({
        userId: scenario.userId,
        workspaceId: scenario.workspaceId,
        assignmentId: assignment.id
      });
      assert.ok(result.ok, JSON.stringify(result));
    }

    const completedBuild = await prisma.build.findFirstOrThrow({
      where: { id: completedBuildId },
      select: { state: true }
    });
    assert.equal(completedBuild.state, "COMPLETED");

    items = await getPartBuildAllocations({
      userId: scenario.userId,
      workspaceId: scenario.workspaceId,
      partId: scenario.buildLinePartId
    });
    assert.equal(items.length, 0, "a COMPLETED build must not appear");
  });

  test("part with no live allocation or reservation returns an empty array", async () => {
    const scenario = await createScenario(uniqueSuffix());

    const items = await getPartBuildAllocations({
      userId: scenario.userId,
      workspaceId: scenario.workspaceId,
      partId: scenario.buildLinePartId
    });

    assert.deepEqual(items, []);
  });

  test("multiple live builds for the same part are all returned, split correctly", async () => {
    const scenario = await createScenario(uniqueSuffix(), "18");

    const { buildId: allocatedBuildId, requiredUnits: allocatedUnits } =
      await createAndAllocateBuild(scenario, 2);

    const { buildId: startedBuildId, requiredUnits: startedUnits } =
      await createAndAllocateBuild(scenario, 2);
    await startBuild({
      userId: scenario.userId,
      workspaceId: scenario.workspaceId,
      buildId: startedBuildId
    });

    const items = await getPartBuildAllocations({
      userId: scenario.userId,
      workspaceId: scenario.workspaceId,
      partId: scenario.buildLinePartId
    });

    assert.equal(items.length, 2);
    const byId = new Map(items.map((item) => [item.buildId, item]));
    assert.equal(byId.get(allocatedBuildId)?.state, "ALLOCATING");
    assert.equal(byId.get(allocatedBuildId)?.allocatedQty, allocatedUnits);
    assert.equal(byId.get(allocatedBuildId)?.reservedQty, 0);
    assert.equal(byId.get(startedBuildId)?.state, "STARTED");
    assert.equal(byId.get(startedBuildId)?.allocatedQty, 0);
    assert.equal(byId.get(startedBuildId)?.reservedQty, startedUnits);
  });

  test("a user without builds:read is denied", async () => {
    const scenario = await createScenario(uniqueSuffix());
    await createAndAllocateBuild(scenario, 2);

    const outsider = await prisma.user.create({
      data: {
        email: `part-build-allocations-outsider-${uniqueSuffix()}@ohmsweetohm.local`,
        emailVerified: true,
        name: "Outsider"
      },
      select: { id: true }
    });
    // A member with no role attached has no permissions in this workspace.
    await prisma.workspaceMember.create({
      data: { userId: outsider.id, workspaceId: scenario.workspaceId }
    });

    await assert.rejects(
      () =>
        getPartBuildAllocations({
          userId: outsider.id,
          workspaceId: scenario.workspaceId,
          partId: scenario.buildLinePartId
        }),
      /workspace-permission-denied/
    );
  });
});
