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
import { analyzeShortage } from "../../src/server/designs/shortageAnalysis";

function uniqueSuffix() {
  return randomBytes(4).toString("hex");
}

type TestWorkspace = {
  workspaceId: string;
  workspaceName: string;
  userId: string;
  unitId: string;
  manufacturerId: string;
};

async function createTestWorkspace(suffix: string): Promise<TestWorkspace> {
  await ensurePermissions();

  const workspaceName = `Shortage Test Workspace ${suffix}`;
  const { workspaceId, userId } = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        email: `shortage-test-${suffix}@ohmsweetohm.local`,
        emailVerified: true,
        name: "Shortage Test User"
      }
    });

    const workspace = await tx.workspace.create({
      data: { name: workspaceName, slug: `shortage-test-${suffix}` }
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
    data: { workspaceId, name: "ACME", normalizedName: "acme" },
    select: { id: true }
  });

  return {
    workspaceId,
    workspaceName,
    userId,
    unitId: unitId as string,
    manufacturerId: manufacturer.id
  };
}

async function createLeafPart(
  ws: TestWorkspace,
  catalogNumber: string,
  currentStock: number,
  reservedQty = 0,
  extra?: { categoryId?: string; attributeId?: string; quantityBaseValue?: string }
) {
  return prisma.part.create({
    data: {
      workspaceId: ws.workspaceId,
      unitId: ws.unitId,
      manufacturerId: ws.manufacturerId,
      catalogNumber,
      currentStock,
      reservedQty,
      primaryCategoryId: extra?.categoryId ?? null,
      attributeValues:
        extra?.attributeId && extra.quantityBaseValue
          ? {
              create: [
                {
                  workspaceId: ws.workspaceId,
                  attributeId: extra.attributeId,
                  quantityBaseValue: extra.quantityBaseValue,
                  displayValue: `${extra.quantityBaseValue}`
                }
              ]
            }
          : undefined
    },
    select: { id: true, catalogNumber: true }
  });
}

/** Create a design via the domain helper and return its output part + latest revision ids. */
async function createDesignWithRevision(ws: TestWorkspace, name: string, catalogNumber: string) {
  const result = await createDesign({
    userId: ws.userId,
    workspaceId: ws.workspaceId,
    workspaceName: ws.workspaceName,
    name,
    catalogNumber,
    unitId: ws.unitId
  });
  assert.ok(result.ok, `design ${name} created`);
  const design = await prisma.design.findUniqueOrThrow({
    where: { id: result.ok ? result.id : "" },
    select: {
      id: true,
      outputPartId: true,
      revisions: { orderBy: { revisionNumber: "desc" }, take: 1, select: { id: true } }
    }
  });
  return {
    designId: design.id,
    outputPartId: design.outputPartId,
    revisionId: design.revisions[0]!.id
  };
}

async function addPinnedLine(
  ws: TestWorkspace,
  revisionId: string,
  designators: string,
  quantity: number,
  pinnedPartId: string
) {
  await prisma.bomLineItem.create({
    data: {
      workspaceId: ws.workspaceId,
      revisionId,
      designators,
      quantity,
      pinnedPartId
    }
  });
}

describe("shortage analysis", () => {
  test("sufficient stock yields no shortage and empty procurement", async () => {
    const ws = await createTestWorkspace(uniqueSuffix());
    const design = await createDesignWithRevision(ws, "Widget", "WIDGET-1");
    const partA = await createLeafPart(ws, "PART-A", 10);
    await addPinnedLine(ws, design.revisionId, "R1-R5", 5, partA.id);

    const result = await analyzeShortage({
      userId: ws.userId,
      workspaceId: ws.workspaceId,
      revisionId: design.revisionId,
      targetQuantity: 1
    });

    assert.equal(result.lines.length, 1);
    assert.equal(result.lines[0]!.requiredQty, 5);
    assert.equal(result.lines[0]!.availableQty, 5);
    assert.equal(result.lines[0]!.gapQty, 0);
    assert.equal(result.procurement.length, 0);
    assert.equal(result.cycles.length, 0);
  });

  test("simple shortage reports required/available/gap and procurement", async () => {
    const ws = await createTestWorkspace(uniqueSuffix());
    const design = await createDesignWithRevision(ws, "Widget", "WIDGET-1");
    const partA = await createLeafPart(ws, "PART-A", 2);
    await addPinnedLine(ws, design.revisionId, "R1-R5", 5, partA.id);

    // target 1 → required 5, available 2, gap 3
    const result = await analyzeShortage({
      userId: ws.userId,
      workspaceId: ws.workspaceId,
      revisionId: design.revisionId,
      targetQuantity: 1
    });

    assert.equal(result.lines[0]!.requiredQty, 5);
    assert.equal(result.lines[0]!.availableQty, 2);
    assert.equal(result.lines[0]!.gapQty, 3);
    assert.equal(result.procurement.length, 1);
    assert.equal(result.procurement[0]!.partId, partA.id);
    assert.equal(result.procurement[0]!.shortageQty, 3);
  });

  test("reserved stock reduces availability", async () => {
    const ws = await createTestWorkspace(uniqueSuffix());
    const design = await createDesignWithRevision(ws, "Widget", "WIDGET-1");
    const partA = await createLeafPart(ws, "PART-A", 10, 8); // available = 2
    await addPinnedLine(ws, design.revisionId, "R1-R5", 5, partA.id);

    const result = await analyzeShortage({
      userId: ws.userId,
      workspaceId: ws.workspaceId,
      revisionId: design.revisionId,
      targetQuantity: 1
    });

    assert.equal(result.lines[0]!.availableQty, 2);
    assert.equal(result.lines[0]!.gapQty, 3);
  });

  test("target quantity multiplies the requirement", async () => {
    const ws = await createTestWorkspace(uniqueSuffix());
    const design = await createDesignWithRevision(ws, "Widget", "WIDGET-1");
    const partA = await createLeafPart(ws, "PART-A", 6);
    await addPinnedLine(ws, design.revisionId, "R1-R2", 2, partA.id);

    // target 5 → required 10, available 6, gap 4
    const result = await analyzeShortage({
      userId: ws.userId,
      workspaceId: ws.workspaceId,
      revisionId: design.revisionId,
      targetQuantity: 5
    });

    assert.equal(result.lines[0]!.requiredQty, 10);
    assert.equal(result.lines[0]!.gapQty, 4);
    assert.equal(result.procurement[0]!.shortageQty, 4);
  });

  test("availability aggregates across all matching parts", async () => {
    const ws = await createTestWorkspace(uniqueSuffix());
    const design = await createDesignWithRevision(ws, "Widget", "WIDGET-1");

    const resistance = await prisma.attribute.create({
      data: {
        workspaceId: ws.workspaceId,
        name: "Resistance",
        normalizedName: "resistance",
        type: "QUANTITY",
        baseUnitSymbol: "Ω"
      },
      select: { id: true }
    });
    const category = await prisma.partCategory.create({
      data: { workspaceId: ws.workspaceId, name: "Resistors" },
      select: { id: true }
    });
    await prisma.partCategoryClosure.create({
      data: {
        workspaceId: ws.workspaceId,
        ancestorId: category.id,
        descendantId: category.id,
        depth: 0
      }
    });

    // Two matching parts, 3 in stock each = 6 available combined.
    await createLeafPart(ws, "R-1k-A", 3, 0, {
      categoryId: category.id,
      attributeId: resistance.id,
      quantityBaseValue: "1000"
    });
    await createLeafPart(ws, "R-1k-B", 3, 0, {
      categoryId: category.id,
      attributeId: resistance.id,
      quantityBaseValue: "1000"
    });

    const line = await prisma.bomLineItem.create({
      data: {
        workspaceId: ws.workspaceId,
        revisionId: design.revisionId,
        designators: "R1-R5",
        quantity: 5,
        categoryId: category.id,
        matchers: {
          create: [
            {
              workspaceId: ws.workspaceId,
              attributeId: resistance.id,
              operator: "GTE",
              quantityBaseValue: "1000",
              displayValue: "1000 Ω"
            }
          ]
        }
      },
      select: { id: true }
    });

    const result = await analyzeShortage({
      userId: ws.userId,
      workspaceId: ws.workspaceId,
      revisionId: design.revisionId,
      targetQuantity: 1
    });

    const lineResult = result.lines.find((l) => l.lineItemId === line.id)!;
    assert.equal(lineResult.matchCount, 2);
    assert.equal(lineResult.requiredQty, 5);
    assert.equal(lineResult.availableQty, 5); // covered by the 6-unit combined pool
    assert.equal(lineResult.gapQty, 0);
    assert.equal(result.procurement.length, 0);
  });

  test("shared stock pool is netted once across multiple lines", async () => {
    const ws = await createTestWorkspace(uniqueSuffix());
    const design = await createDesignWithRevision(ws, "Widget", "WIDGET-1");
    const partA = await createLeafPart(ws, "PART-A", 5);
    // Both lines require the same part; combined demand 8 vs 5 available.
    await addPinnedLine(ws, design.revisionId, "R1-R4", 4, partA.id);
    await addPinnedLine(ws, design.revisionId, "C1-C4", 4, partA.id);

    const result = await analyzeShortage({
      userId: ws.userId,
      workspaceId: ws.workspaceId,
      revisionId: design.revisionId,
      targetQuantity: 1
    });

    const [first, second] = result.lines;
    assert.equal(first!.availableQty, 4);
    assert.equal(first!.gapQty, 0);
    assert.equal(second!.availableQty, 1); // only 1 unit left in the shared pool
    assert.equal(second!.gapQty, 3);
    assert.equal(result.procurement.length, 1);
    assert.equal(result.procurement[0]!.shortageQty, 3);
  });

  test("recurses into sub-design output parts, netting sub-assembly stock", async () => {
    const ws = await createTestWorkspace(uniqueSuffix());
    const sub = await createDesignWithRevision(ws, "Sub", "SUB-1");
    const main = await createDesignWithRevision(ws, "Main", "MAIN-1");

    const leafX = await createLeafPart(ws, "LEAF-X", 0);
    // Sub build consumes 2 leafX per unit.
    await addPinnedLine(ws, sub.revisionId, "U1-U2", 2, leafX.id);

    // Give the sub-assembly output part 1 unit of stock (to be netted first).
    await prisma.part.update({
      where: { id: sub.outputPartId },
      data: { currentStock: 1 }
    });

    // Main needs 3 of the sub-assembly.
    await addPinnedLine(ws, main.revisionId, "A1-A3", 3, sub.outputPartId);

    const result = await analyzeShortage({
      userId: ws.userId,
      workspaceId: ws.workspaceId,
      revisionId: main.revisionId,
      targetQuantity: 1
    });

    // Main line: required 3 sub-assemblies, 1 available, gap 2.
    assert.equal(result.lines[0]!.requiredQty, 3);
    assert.equal(result.lines[0]!.availableQty, 1);
    assert.equal(result.lines[0]!.gapQty, 2);

    // Building 2 sub-assemblies needs 2 × 2 = 4 leafX; none in stock → procurement 4.
    assert.equal(result.procurement.length, 1);
    assert.equal(result.procurement[0]!.partId, leafX.id);
    assert.equal(result.procurement[0]!.shortageQty, 4);

    // The sub-assembly output part must NOT appear in the leaf procurement list.
    assert.ok(!result.procurement.some((p) => p.partId === sub.outputPartId));
  });

  test("detects and reports design cycles without looping", async () => {
    const ws = await createTestWorkspace(uniqueSuffix());
    const a = await createDesignWithRevision(ws, "A", "A-1");
    const b = await createDesignWithRevision(ws, "B", "B-1");

    // A requires B's output, B requires A's output → cycle.
    await addPinnedLine(ws, a.revisionId, "X1", 1, b.outputPartId);
    await addPinnedLine(ws, b.revisionId, "Y1", 1, a.outputPartId);

    const result = await analyzeShortage({
      userId: ws.userId,
      workspaceId: ws.workspaceId,
      revisionId: a.revisionId,
      targetQuantity: 1
    });

    assert.equal(result.cycles.length, 1);
    assert.deepEqual(result.cycles[0]!.path, ["A", "B", "A"]);
  });
});
