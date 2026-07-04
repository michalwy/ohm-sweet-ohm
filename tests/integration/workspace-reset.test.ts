import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { randomBytes } from "node:crypto";

import { prisma } from "../../src/server/db/prisma";
import { wipeDomainData } from "../../src/server/workspaces/resetMutations";
import { applyDemoPreset } from "../../src/server/workspaces/applyDemoPreset";
import { DEMO_PRESET_FIXTURE } from "../../src/server/workspaces/demoPresetFixture";
import { ensureDefaultUnitsForWorkspace, getDefaultPartUnitId } from "../../src/server/units/defaultUnits";
import { ensurePermissions } from "../../src/server/workspaces/createWorkspace";

function uniqueSuffix() {
  return randomBytes(4).toString("hex");
}

async function createTestWorkspaceWithMember(suffix: string) {
  await ensurePermissions();

  const { workspaceId, userId } = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        email: `reset-test-${suffix}@ohmsweetohm.local`,
        emailVerified: true,
        name: "Reset Test User"
      }
    });

    const workspace = await tx.workspace.create({
      data: {
        name: `Reset Test Workspace ${suffix}`,
        slug: `reset-test-${suffix}`
      }
    });

    const role = await tx.role.create({
      data: { workspaceId: workspace.id, name: "owner", isSystem: true }
    });

    const member = await tx.workspaceMember.create({
      data: { userId: user.id, workspaceId: workspace.id },
      select: { id: true }
    });

    await tx.workspaceMemberRole.create({
      data: { workspaceMemberId: member.id, roleId: role.id }
    });

    return { workspaceId: workspace.id, userId: user.id };
  });

  await ensureDefaultUnitsForWorkspace(prisma, workspaceId);
  const unitId = await getDefaultPartUnitId(prisma, workspaceId);

  return { workspaceId, userId, unitId };
}

async function addMinimalDomainData(workspaceId: string, unitId: string) {
  await prisma.$transaction(async (tx) => {
    const org = await tx.organization.create({
      data: {
        workspaceId,
        name: "Test Mfr",
        normalizedName: "test mfr",
        roles: { create: [{ role: "manufacturer" }] }
      }
    });

    const attr = await tx.attribute.create({
      data: { workspaceId, name: "Resistance", normalizedName: "resistance", type: "NUMBER" }
    });

    const category = await tx.partCategory.create({
      data: { workspaceId, name: "Passives", valueAttributeId: attr.id }
    });

    await tx.partCategoryClosure.create({
      data: { workspaceId, ancestorId: category.id, descendantId: category.id, depth: 0 }
    });

    const location = await tx.storageLocation.create({
      data: { workspaceId, name: "Shelf A", normalizedName: "shelf a" }
    });

    const part = await tx.part.create({
      data: { workspaceId, catalogNumber: "TEST-001", unitId, manufacturerId: org.id }
    });

    await tx.inventoryEntry.create({
      data: { workspaceId, partId: part.id, toLocationId: location.id, entryType: "RECEIPT", quantity: 5 }
    });

    const list = await tx.shoppingList.create({
      data: { workspaceId, name: "Buy list" }
    });

    await tx.shoppingListItem.create({
      data: { shoppingListId: list.id, partId: part.id, quantity: 2 }
    });
  });
}

async function addDesignData(workspaceId: string, unitId: string) {
  const internalOrg = await prisma.organization.create({
    data: {
      workspaceId,
      name: "Internal",
      normalizedName: "__internal__internal",
      isInternal: true,
      roles: { create: [{ role: "manufacturer" }] }
    },
    select: { id: true }
  });

  const outputPart = await prisma.part.create({
    data: { workspaceId, catalogNumber: "DESIGN-0001", unitId, manufacturerId: internalOrg.id },
    select: { id: true }
  });

  await prisma.design.create({
    data: {
      workspaceId,
      name: "Test Assembly",
      outputPartId: outputPart.id,
      revisions: {
        create: [
          { workspaceId, revisionNumber: 1 },
          { workspaceId, revisionNumber: 2, notes: "rev 2" }
        ]
      }
    }
  });
}

async function addBuildData(workspaceId: string, unitId: string) {
  const internalOrg = await prisma.organization.create({
    data: {
      workspaceId,
      name: "Internal",
      normalizedName: "__internal__internal2",
      isInternal: true,
      roles: { create: [{ role: "manufacturer" }] }
    },
    select: { id: true }
  });

  const outputPart = await prisma.part.create({
    data: { workspaceId, catalogNumber: "DESIGN-0002", unitId, manufacturerId: internalOrg.id },
    select: { id: true }
  });

  const componentPart = await prisma.part.create({
    data: { workspaceId, catalogNumber: "COMPONENT-0001", unitId, manufacturerId: internalOrg.id },
    select: { id: true }
  });

  const location = await prisma.storageLocation.create({
    data: { workspaceId, name: "Build Shelf", normalizedName: "build shelf" },
    select: { id: true }
  });

  const design = await prisma.design.create({
    data: {
      workspaceId,
      name: "Buildable Assembly",
      outputPartId: outputPart.id,
      revisions: { create: [{ workspaceId, revisionNumber: 1 }] }
    },
    include: { revisions: true }
  });

  const build = await prisma.build.create({
    data: {
      workspaceId,
      designRevisionId: design.revisions[0].id,
      outputLocationId: location.id,
      targetQuantity: 1,
      state: "CREATED"
    }
  });

  const lineItem = await prisma.buildLineItem.create({
    data: { workspaceId, buildId: build.id, designators: "R1", designatorCount: 1 }
  });

  await prisma.buildLineAllocation.create({
    data: {
      workspaceId,
      buildLineItemId: lineItem.id,
      partId: componentPart.id,
      sourceLocationId: location.id,
      quantity: 1
    }
  });

  await prisma.buildDesignatorAssignment.create({
    data: {
      workspaceId,
      buildLineItemId: lineItem.id,
      designator: "R1",
      unitIndex: 0,
      partId: componentPart.id,
      sourceLocationId: location.id
    }
  });
}

describe("wipeDomainData", () => {
  test("leaves workspace, members, and roles intact while removing all domain data", async () => {
    const suffix = uniqueSuffix();
    const { workspaceId, userId, unitId } = await createTestWorkspaceWithMember(suffix);
    await addMinimalDomainData(workspaceId, unitId);

    // Confirm domain data exists
    assert.ok((await prisma.part.count({ where: { workspaceId } })) > 0, "parts should exist before wipe");
    assert.ok((await prisma.attribute.count({ where: { workspaceId } })) > 0, "attributes should exist before wipe");

    await wipeDomainData(workspaceId);

    // Workspace shell must survive
    const workspace = await prisma.workspace.findUnique({ where: { id: workspaceId } });
    assert.ok(workspace !== null, "workspace should still exist after wipe");

    const member = await prisma.workspaceMember.findFirst({ where: { workspaceId, userId } });
    assert.ok(member !== null, "workspace member should still exist after wipe");

    const role = await prisma.role.findFirst({ where: { workspaceId } });
    assert.ok(role !== null, "workspace role should still exist after wipe");

    // All domain data must be gone
    assert.equal(await prisma.part.count({ where: { workspaceId } }), 0, "parts should be gone");
    assert.equal(await prisma.partCategory.count({ where: { workspaceId } }), 0, "categories should be gone");
    assert.equal(await prisma.attribute.count({ where: { workspaceId } }), 0, "attributes should be gone");
    assert.equal(await prisma.storageLocation.count({ where: { workspaceId } }), 0, "locations should be gone");
    assert.equal(await prisma.inventoryEntry.count({ where: { workspaceId } }), 0, "inventory entries should be gone");
    assert.equal(await prisma.organization.count({ where: { workspaceId } }), 0, "organizations should be gone");
    assert.equal(await prisma.shoppingList.count({ where: { workspaceId } }), 0, "shopping lists should be gone");
    assert.equal(await prisma.unit.count({ where: { workspaceId } }), 0, "units should be gone");
  });

  test("removes designs and their output parts (Design RESTRICTs Part deletion)", async () => {
    const suffix = uniqueSuffix();
    const { workspaceId, unitId } = await createTestWorkspaceWithMember(suffix);
    await addDesignData(workspaceId, unitId);

    assert.ok((await prisma.design.count({ where: { workspaceId } })) > 0, "design should exist before wipe");
    assert.ok(
      (await prisma.designRevision.count({ where: { workspaceId } })) > 0,
      "revisions should exist before wipe"
    );

    // Reproduces the bug: Design.outputPart RESTRICTs Part deletion, so wiping
    // parts before designs threw and aborted the whole reset.
    await assert.doesNotReject(
      () => wipeDomainData(workspaceId),
      "wipe must not throw when a design exists"
    );

    assert.equal(await prisma.design.count({ where: { workspaceId } }), 0, "designs should be gone");
    assert.equal(
      await prisma.designRevision.count({ where: { workspaceId } }),
      0,
      "design revisions should be gone"
    );
    assert.equal(await prisma.part.count({ where: { workspaceId } }), 0, "output part should be gone");
    assert.equal(await prisma.organization.count({ where: { workspaceId } }), 0, "internal org should be gone");
  });

  test("removes builds and their allocations/assignments (Build RESTRICTs DesignRevision/Part/StorageLocation)", async () => {
    const suffix = uniqueSuffix();
    const { workspaceId, unitId } = await createTestWorkspaceWithMember(suffix);
    await addBuildData(workspaceId, unitId);

    assert.ok((await prisma.build.count({ where: { workspaceId } })) > 0, "build should exist before wipe");
    assert.ok(
      (await prisma.buildLineAllocation.count({ where: { workspaceId } })) > 0,
      "allocations should exist before wipe"
    );
    assert.ok(
      (await prisma.buildDesignatorAssignment.count({ where: { workspaceId } })) > 0,
      "designator assignments should exist before wipe"
    );

    await assert.doesNotReject(
      () => wipeDomainData(workspaceId),
      "wipe must not throw when a build exists"
    );

    assert.equal(await prisma.build.count({ where: { workspaceId } }), 0, "builds should be gone");
    assert.equal(
      await prisma.buildLineItem.count({ where: { workspaceId } }),
      0,
      "build line items should be gone"
    );
    assert.equal(
      await prisma.buildLineAllocation.count({ where: { workspaceId } }),
      0,
      "build line allocations should be gone"
    );
    assert.equal(
      await prisma.buildDesignatorAssignment.count({ where: { workspaceId } }),
      0,
      "build designator assignments should be gone"
    );
    assert.equal(await prisma.design.count({ where: { workspaceId } }), 0, "designs should be gone");
    assert.equal(await prisma.part.count({ where: { workspaceId } }), 0, "parts should be gone");
    assert.equal(await prisma.storageLocation.count({ where: { workspaceId } }), 0, "locations should be gone");
  });

  test("wipe on empty workspace is a no-op (no throw, workspace intact)", async () => {
    const suffix = uniqueSuffix();
    const { workspaceId } = await createTestWorkspaceWithMember(suffix);

    await assert.doesNotReject(() => wipeDomainData(workspaceId));

    const workspace = await prisma.workspace.findUnique({ where: { id: workspaceId } });
    assert.ok(workspace !== null, "workspace should still exist after wipe of empty workspace");
  });

  test("wipe followed by applyDemoPreset produces expected entity counts (parts-only)", async () => {
    const suffix = uniqueSuffix();
    const { workspaceId, unitId } = await createTestWorkspaceWithMember(suffix);
    await addMinimalDomainData(workspaceId, unitId);

    await wipeDomainData(workspaceId);
    await ensureDefaultUnitsForWorkspace(prisma, workspaceId);
    const newUnitId = await getDefaultPartUnitId(prisma, workspaceId);

    await applyDemoPreset(prisma, workspaceId, newUnitId, "parts-only", DEMO_PRESET_FIXTURE);

    const partCount = await prisma.part.count({ where: { workspaceId } });
    assert.ok(partCount >= 200, `Expected ≥200 parts after reset, got ${partCount}`);

    const categoryCount = await prisma.partCategory.count({ where: { workspaceId } });
    assert.ok(categoryCount >= 5, `Expected ≥5 categories after reset, got ${categoryCount}`);

    const slCount = await prisma.shoppingList.count({ where: { workspaceId } });
    assert.equal(slCount, 0, "Expected no shopping lists for parts-only reset");

    const designCount = await prisma.design.count({ where: { workspaceId } });
    assert.ok(designCount >= 3, `Expected ≥3 designs after reset, got ${designCount}`);
  });

  test("wipe followed by applyDemoPreset produces expected entity counts (parts-and-orders)", async () => {
    const suffix = uniqueSuffix();
    const { workspaceId, unitId } = await createTestWorkspaceWithMember(suffix);
    await addMinimalDomainData(workspaceId, unitId);

    await wipeDomainData(workspaceId);
    await ensureDefaultUnitsForWorkspace(prisma, workspaceId);
    const newUnitId = await getDefaultPartUnitId(prisma, workspaceId);

    await applyDemoPreset(prisma, workspaceId, newUnitId, "parts-and-orders", DEMO_PRESET_FIXTURE);

    const partCount = await prisma.part.count({ where: { workspaceId } });
    assert.ok(partCount >= 200, `Expected ≥200 parts after reset, got ${partCount}`);

    const slCount = await prisma.shoppingList.count({ where: { workspaceId } });
    assert.ok(slCount >= 2, `Expected ≥2 shopping lists after reset, got ${slCount}`);

    const poCount = await prisma.purchaseOrder.count({ where: { workspaceId } });
    assert.ok(poCount >= 3, `Expected ≥3 purchase orders after reset, got ${poCount}`);
  });
});
