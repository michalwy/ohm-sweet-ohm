import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { randomBytes } from "node:crypto";

import { prisma } from "../../src/server/db/prisma";
import { ensurePermissions } from "../../src/server/workspaces/createWorkspace";
import { ensureDefaultUnitsForWorkspace, getDefaultPartUnitId } from "../../src/server/units/defaultUnits";
import {
  createDesign,
  getDesignsForWorkspace,
  getNextDesignCatalogNumber,
  addRevisionToDesign,
  updateDesignRevision,
  deleteDesign
} from "../../src/server/designs/designs";

function uniqueSuffix() {
  return randomBytes(4).toString("hex");
}

async function createTestWorkspace(suffix: string) {
  await ensurePermissions();

  const { workspaceId, userId } = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        email: `designs-test-${suffix}@ohmsweetohm.local`,
        emailVerified: true,
        name: "Designs Test User"
      }
    });

    const workspace = await tx.workspace.create({
      data: {
        name: `Designs Test Workspace ${suffix}`,
        slug: `designs-test-${suffix}`
      }
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

  return { workspaceId, userId, unitId, workspaceName: `Designs Test Workspace ${suffix}` };
}

describe("designs", () => {
  test("getNextDesignCatalogNumber returns DESIGN-0001 for first design", async () => {
    const suffix = uniqueSuffix();
    const { workspaceId } = await createTestWorkspace(suffix);

    const catalogNumber = await getNextDesignCatalogNumber(workspaceId);
    assert.equal(catalogNumber, "DESIGN-0001");
  });

  test("getNextDesignCatalogNumber increments per workspace", async () => {
    const suffix = uniqueSuffix();
    const { workspaceId, userId, unitId, workspaceName } = await createTestWorkspace(suffix);

    await createDesign({
      userId,
      workspaceId,
      workspaceName,
      name: "Design A",
      catalogNumber: "DESIGN-0001",
      unitId
    });

    const next = await getNextDesignCatalogNumber(workspaceId);
    assert.equal(next, "DESIGN-0002");
  });

  test("createDesign creates output part, design, and revision v1", async () => {
    const suffix = uniqueSuffix();
    const { workspaceId, userId, unitId, workspaceName } = await createTestWorkspace(suffix);

    const result = await createDesign({
      userId,
      workspaceId,
      workspaceName,
      name: "My PCB",
      description: "A custom board",
      catalogNumber: "PCB-001",
      unitId
    });

    assert.ok(result.ok);
    assert.ok(result.id);

    const design = await prisma.design.findUnique({
      where: { id: result.id },
      include: {
        outputPart: true,
        revisions: true
      }
    });

    assert.ok(design);
    assert.equal(design.name, "My PCB");
    assert.equal(design.description, "A custom board");
    assert.equal(design.outputPart.catalogNumber, "PCB-001");
    assert.equal(design.revisions.length, 1);
    assert.equal(design.revisions[0]?.revisionNumber, 1);
  });

  test("createDesign auto-creates internal organization", async () => {
    const suffix = uniqueSuffix();
    const { workspaceId, userId, unitId, workspaceName } = await createTestWorkspace(suffix);

    await createDesign({
      userId,
      workspaceId,
      workspaceName,
      name: "Board",
      catalogNumber: "BRD-001",
      unitId
    });

    const internalOrg = await prisma.organization.findFirst({
      where: { workspaceId, isInternal: true },
      select: { id: true, isInternal: true }
    });

    assert.ok(internalOrg);
    assert.equal(internalOrg.isInternal, true);
  });

  test("createDesign reuses internal organization on second design", async () => {
    const suffix = uniqueSuffix();
    const { workspaceId, userId, unitId, workspaceName } = await createTestWorkspace(suffix);

    await createDesign({ userId, workspaceId, workspaceName, name: "A", catalogNumber: "A-001", unitId });
    await createDesign({ userId, workspaceId, workspaceName, name: "B", catalogNumber: "B-001", unitId });

    const internalOrgs = await prisma.organization.findMany({
      where: { workspaceId, isInternal: true }
    });

    assert.equal(internalOrgs.length, 1, "only one internal org per workspace");
  });

  test("createDesign rejects duplicate catalog number", async () => {
    const suffix = uniqueSuffix();
    const { workspaceId, userId, unitId, workspaceName } = await createTestWorkspace(suffix);

    await createDesign({ userId, workspaceId, workspaceName, name: "A", catalogNumber: "PCB-001", unitId });
    const dup = await createDesign({ userId, workspaceId, workspaceName, name: "B", catalogNumber: "PCB-001", unitId });

    assert.ok(!dup.ok);
    assert.equal(dup.error, "catalog_number_taken");
  });

  test("addRevisionToDesign increments revision number", async () => {
    const suffix = uniqueSuffix();
    const { workspaceId, userId, unitId, workspaceName } = await createTestWorkspace(suffix);

    const created = await createDesign({
      userId,
      workspaceId,
      workspaceName,
      name: "My Board",
      catalogNumber: "MB-001",
      unitId
    });
    assert.ok(created.ok);

    const rev2 = await addRevisionToDesign({
      userId,
      workspaceId,
      designId: created.id,
      notes: "Added USB port"
    });
    assert.ok(rev2.ok);

    const revisions = await prisma.designRevision.findMany({
      where: { designId: created.id },
      orderBy: { revisionNumber: "asc" }
    });

    assert.equal(revisions.length, 2);
    assert.equal(revisions[0]?.revisionNumber, 1);
    assert.equal(revisions[1]?.revisionNumber, 2);
    assert.equal(revisions[1]?.notes, "Added USB port");
  });

  test("updateDesignRevision updates notes", async () => {
    const suffix = uniqueSuffix();
    const { workspaceId, userId, unitId, workspaceName } = await createTestWorkspace(suffix);

    const created = await createDesign({
      userId,
      workspaceId,
      workspaceName,
      name: "Board",
      catalogNumber: "BRD-001",
      unitId
    });
    assert.ok(created.ok);

    const rev = await prisma.designRevision.findFirst({
      where: { designId: created.id },
      select: { id: true }
    });
    assert.ok(rev);

    const updateResult = await updateDesignRevision({
      userId,
      workspaceId,
      revisionId: rev.id,
      notes: "Initial production version"
    });
    assert.ok(updateResult.ok);

    const updated = await prisma.designRevision.findUnique({ where: { id: rev.id } });
    assert.equal(updated?.notes, "Initial production version");
  });

  test("deleteDesign removes design and output part when no inventory", async () => {
    const suffix = uniqueSuffix();
    const { workspaceId, userId, unitId, workspaceName } = await createTestWorkspace(suffix);

    const created = await createDesign({
      userId,
      workspaceId,
      workspaceName,
      name: "Temp Board",
      catalogNumber: "TMP-001",
      unitId
    });
    assert.ok(created.ok);

    const design = await prisma.design.findUnique({ where: { id: created.id }, select: { outputPartId: true } });
    assert.ok(design);

    const result = await deleteDesign({ userId, workspaceId, designId: created.id });
    assert.ok(result.ok);

    const gone = await prisma.design.findUnique({ where: { id: created.id } });
    assert.equal(gone, null);

    const partGone = await prisma.part.findUnique({ where: { id: design.outputPartId } });
    assert.equal(partGone, null);
  });

  test("deleteDesign blocks when output part has stock", async () => {
    const suffix = uniqueSuffix();
    const { workspaceId, userId, unitId, workspaceName } = await createTestWorkspace(suffix);

    const created = await createDesign({
      userId,
      workspaceId,
      workspaceName,
      name: "Stocked Board",
      catalogNumber: "STK-001",
      unitId
    });
    assert.ok(created.ok);

    const design = await prisma.design.findUnique({ where: { id: created.id }, select: { outputPartId: true } });
    assert.ok(design);

    // Add stock directly
    await prisma.part.update({
      where: { id: design.outputPartId },
      data: { currentStock: 5 }
    });

    const result = await deleteDesign({ userId, workspaceId, designId: created.id });
    assert.ok(!result.ok);
    assert.equal(result.error, "output_part_has_stock");
  });

  test("getDesignsForWorkspace sorts by name, catalogNumber, and createdAt", async () => {
    const suffix = uniqueSuffix();
    const { userId, workspaceId, workspaceName, unitId } = await createTestWorkspace(suffix);

    // Created in this order; names and catalog numbers deliberately unsorted
    await createDesign({ userId, workspaceId, workspaceName, name: "Charlie", catalogNumber: "PCB-300", unitId });
    await createDesign({ userId, workspaceId, workspaceName, name: "Alpha", catalogNumber: "PCB-200", unitId });
    await createDesign({ userId, workspaceId, workspaceName, name: "Bravo", catalogNumber: "PCB-100", unitId });

    const byNameAsc = await getDesignsForWorkspace({ userId, workspaceId, sortBy: "name", sortDir: "asc" });
    assert.deepEqual(byNameAsc.items.map((d) => d.name), ["Alpha", "Bravo", "Charlie"]);

    const byNameDesc = await getDesignsForWorkspace({ userId, workspaceId, sortBy: "name", sortDir: "desc" });
    assert.deepEqual(byNameDesc.items.map((d) => d.name), ["Charlie", "Bravo", "Alpha"]);

    const byCatalogAsc = await getDesignsForWorkspace({ userId, workspaceId, sortBy: "catalogNumber", sortDir: "asc" });
    assert.deepEqual(
      byCatalogAsc.items.map((d) => d.outputPart.catalogNumber),
      ["PCB-100", "PCB-200", "PCB-300"]
    );

    const byCreatedDesc = await getDesignsForWorkspace({ userId, workspaceId, sortBy: "createdAt", sortDir: "desc" });
    // Newest first: Bravo was created last, Charlie first
    assert.deepEqual(byCreatedDesc.items.map((d) => d.name), ["Bravo", "Alpha", "Charlie"]);
  });

  test("getDesignsForWorkspace paginates with a stable cursor", async () => {
    const suffix = uniqueSuffix();
    const { userId, workspaceId, workspaceName, unitId } = await createTestWorkspace(suffix);

    for (const name of ["Alpha", "Bravo", "Charlie", "Delta"]) {
      await createDesign({ userId, workspaceId, workspaceName, name, catalogNumber: `${name}-1`, unitId });
    }

    const page1 = await getDesignsForWorkspace({ userId, workspaceId, sortBy: "name", sortDir: "asc", pageSize: 2 });
    assert.deepEqual(page1.items.map((d) => d.name), ["Alpha", "Bravo"]);
    assert.ok(page1.nextCursor, "first page should have a cursor");

    const page2 = await getDesignsForWorkspace({
      userId,
      workspaceId,
      sortBy: "name",
      sortDir: "asc",
      pageSize: 2,
      cursor: page1.nextCursor
    });
    assert.deepEqual(page2.items.map((d) => d.name), ["Charlie", "Delta"]);
    assert.equal(page2.nextCursor, null, "second page should be the last");
  });
});
