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
  cancelBuild,
  createBuild,
  getPartProductionBuilds,
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
  outputPartId: string;
  componentPartId: string;
  sourceLocationId: string;
  outputLocationId: string;
};

async function createWorkspaceWithOwner(suffix: string) {
  await ensurePermissions();
  const { workspaceId, workspaceSlug, userId } = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        email: `part-production-builds-${suffix}@ohmsweetohm.local`,
        emailVerified: true,
        name: "Part Production Builds User"
      }
    });
    const slug = `part-prod-builds-${suffix}`;
    const workspace = await tx.workspace.create({
      data: { name: `Part Production Builds Workspace ${suffix}`, slug }
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
 * Workspace with a component part (stocked), a design whose output is a separate part, and a BOM
 * line pinned to the component. This mirrors the shape needed to create and start builds.
 */
async function createScenario(suffix: string): Promise<Scenario> {
  const { workspaceId, userId, unitId } = await createWorkspaceWithOwner(suffix);

  const manufacturer = await prisma.organization.create({
    data: {
      workspaceId,
      name: `Part Production Builds Manufacturer ${suffix}`,
      normalizedName: `part-prod-builds-mfr-${suffix}`
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
    quantity: "10",
    toLocationId: sourceLocation.id
  });

  const design = await createDesign({
    userId,
    workspaceId,
    workspaceName: `Part Production Builds Workspace ${suffix}`,
    name: `Board ${suffix}`,
    catalogNumber: `BOARD-${suffix}`,
    unitId
  });
  assert.ok(design.ok, JSON.stringify(design));

  const revision = await prisma.designRevision.findFirstOrThrow({
    where: { workspaceId, designId: design.id },
    select: { id: true }
  });

  // Output part is created by createDesign; fetch it via the Design record.
  const designRecord = await prisma.design.findFirstOrThrow({
    where: { id: design.id },
    select: { outputPartId: true }
  });
  const outputPart = { id: designRecord.outputPartId };

  const created = await createBomLineItem({
    userId,
    workspaceId,
    revisionId: revision.id,
    input: {
      designators: "U1, U2",
      pinnedPartId: componentPart.id,
      categoryId: null,
      matchers: []
    }
  });
  assert.ok(created.ok, JSON.stringify(created));

  return {
    workspaceId,
    userId,
    revisionId: revision.id,
    outputPartId: outputPart.id,
    componentPartId: componentPart.id,
    sourceLocationId: sourceLocation.id,
    outputLocationId: outputLocation.id
  };
}

async function createAllocatedBuild(scenario: Scenario, targetQuantity = 2) {
  const build = await createBuild({
    userId: scenario.userId,
    workspaceId: scenario.workspaceId,
    designRevisionId: scenario.revisionId,
    targetQuantity,
    outputLocationId: scenario.outputLocationId
  });
  assert.ok(build.ok, JSON.stringify(build));
  const buildId = build.data.id;

  const line = await prisma.buildLineItem.findFirstOrThrow({
    where: { buildId },
    select: { id: true, designatorCount: true }
  });

  const alloc = await setBuildLineAllocations({
    userId: scenario.userId,
    workspaceId: scenario.workspaceId,
    buildLineItemId: line.id,
    entries: [
      {
        partId: scenario.componentPartId,
        sourceLocationId: scenario.sourceLocationId,
        quantity: line.designatorCount * targetQuantity
      }
    ]
  });
  assert.ok(alloc.ok, JSON.stringify(alloc));

  return buildId;
}

async function startedBuild(scenario: Scenario, targetQuantity = 2) {
  const buildId = await createAllocatedBuild(scenario, targetQuantity);
  const started = await startBuild({
    userId: scenario.userId,
    workspaceId: scenario.workspaceId,
    buildId
  });
  assert.ok(started.ok, JSON.stringify(started));
  return buildId;
}

describe("getPartProductionBuilds", () => {
  test("returns empty array when no active production builds exist", async () => {
    const scenario = await createScenario(uniqueSuffix());

    const items = await getPartProductionBuilds({
      userId: scenario.userId,
      workspaceId: scenario.workspaceId,
      partId: scenario.outputPartId
    });

    assert.equal(items.length, 0);
  });

  test("build in STARTED state appears with inProductionQty equal to targetQuantity", async () => {
    const scenario = await createScenario(uniqueSuffix());
    const targetQuantity = 3;
    const buildId = await startedBuild(scenario, targetQuantity);

    const items = await getPartProductionBuilds({
      userId: scenario.userId,
      workspaceId: scenario.workspaceId,
      partId: scenario.outputPartId
    });

    assert.equal(items.length, 1);
    assert.equal(items[0]?.buildId, buildId);
    assert.equal(items[0]?.state, "STARTED");
    assert.equal(items[0]?.targetQuantity, targetQuantity);
    assert.equal(items[0]?.inProductionQty, targetQuantity);
  });

  test("build in IN_PROGRESS state appears", async () => {
    const scenario = await createScenario(uniqueSuffix());
    const buildId = await startedBuild(scenario, 2);

    // Assemble one designator to advance to IN_PROGRESS.
    const assignment = await prisma.buildDesignatorAssignment.findFirstOrThrow({
      where: { buildLineItem: { buildId } },
      select: { id: true }
    });
    const assembled = await import("../../src/server/builds/builds").then((m) =>
      m.assembleDesignator({
        userId: scenario.userId,
        workspaceId: scenario.workspaceId,
        assignmentId: assignment.id
      })
    );
    assert.ok(assembled.ok, JSON.stringify(assembled));

    const items = await getPartProductionBuilds({
      userId: scenario.userId,
      workspaceId: scenario.workspaceId,
      partId: scenario.outputPartId
    });

    assert.equal(items.length, 1);
    assert.equal(items[0]?.state, "IN_PROGRESS");
  });

  test("build in ALLOCATING state is excluded", async () => {
    const scenario = await createScenario(uniqueSuffix());
    await createAllocatedBuild(scenario, 2);

    const items = await getPartProductionBuilds({
      userId: scenario.userId,
      workspaceId: scenario.workspaceId,
      partId: scenario.outputPartId
    });

    assert.equal(items.length, 0);
  });

  test("CANCELLED build is excluded", async () => {
    const scenario = await createScenario(uniqueSuffix());
    const buildId = await startedBuild(scenario, 2);

    const cancelled = await cancelBuild({
      userId: scenario.userId,
      workspaceId: scenario.workspaceId,
      buildId
    });
    assert.ok(cancelled.ok, JSON.stringify(cancelled));

    const items = await getPartProductionBuilds({
      userId: scenario.userId,
      workspaceId: scenario.workspaceId,
      partId: scenario.outputPartId
    });

    assert.equal(items.length, 0);
  });

  test("query is scoped to the given part — another design's builds do not appear", async () => {
    const scenario = await createScenario(uniqueSuffix());
    await startedBuild(scenario, 2);

    const otherScenario = await createScenario(uniqueSuffix());

    const items = await getPartProductionBuilds({
      userId: otherScenario.userId,
      workspaceId: otherScenario.workspaceId,
      partId: otherScenario.outputPartId
    });

    assert.equal(items.length, 0, "other design's build should not appear");
  });

  test("results are ordered by createdAt descending", async () => {
    const scenario = await createScenario(uniqueSuffix());
    const buildId1 = await startedBuild(scenario, 2);
    const buildId2 = await startedBuild(scenario, 2);

    const items = await getPartProductionBuilds({
      userId: scenario.userId,
      workspaceId: scenario.workspaceId,
      partId: scenario.outputPartId
    });

    assert.equal(items.length, 2);
    // Most recent first — buildId2 was created last.
    assert.equal(items[0]?.buildId, buildId2);
    assert.equal(items[1]?.buildId, buildId1);
  });

  test("throws when builds:read permission is denied", async () => {
    const scenario = await createScenario(uniqueSuffix());

    // Create a user with no permissions.
    const { workspaceId, userId } = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: `no-perm-prod-builds-${uniqueSuffix()}@ohmsweetohm.local`,
          emailVerified: true,
          name: "No Permission User"
        }
      });
      const member = await tx.workspaceMember.create({
        data: { userId: user.id, workspaceId: scenario.workspaceId },
        select: { id: true }
      });
      void member;
      return { workspaceId: scenario.workspaceId, userId: user.id };
    });

    await assert.rejects(
      () =>
        getPartProductionBuilds({
          userId,
          workspaceId,
          partId: scenario.outputPartId
        }),
      (err: Error) => {
        assert.ok(err.message.includes("permission"), `expected permission error, got: ${err.message}`);
        return true;
      }
    );
  });
});
