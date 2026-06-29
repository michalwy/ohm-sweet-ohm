import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { randomBytes } from "node:crypto";

import { prisma } from "../../src/server/db/prisma";
import { ensurePermissions } from "../../src/server/workspaces/createWorkspace";
import {
  ensureDefaultUnitsForWorkspace,
  getDefaultPartUnitId
} from "../../src/server/units/defaultUnits";
import { findMatchingParts } from "../../src/server/designs/matching";

function uniqueSuffix() {
  return randomBytes(4).toString("hex");
}

async function createTestWorkspace(suffix: string) {
  await ensurePermissions();

  const { workspaceId } = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        email: `bom-test-${suffix}@ohmsweetohm.local`,
        emailVerified: true,
        name: "BOM Test User"
      }
    });

    const workspace = await tx.workspace.create({
      data: { name: `BOM Test Workspace ${suffix}`, slug: `bom-test-${suffix}` }
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

  return { workspaceId, unitId: unitId as string, manufacturerId: manufacturer.id };
}

async function createPartWithResistance({
  workspaceId,
  unitId,
  manufacturerId,
  categoryId,
  attributeId,
  catalogNumber,
  quantityBaseValue
}: {
  workspaceId: string;
  unitId: string;
  manufacturerId: string;
  categoryId: string | null;
  attributeId: string;
  catalogNumber: string;
  quantityBaseValue: string;
}) {
  return prisma.part.create({
    data: {
      workspaceId,
      unitId,
      manufacturerId,
      catalogNumber,
      primaryCategoryId: categoryId,
      attributeValues: {
        create: [
          {
            workspaceId,
            attributeId,
            quantityBaseValue,
            displayValue: `${quantityBaseValue} Ω`
          }
        ]
      }
    },
    select: { id: true }
  });
}

describe("BOM matching", () => {
  test("finds parts satisfying a >= QUANTITY matcher within a category", async () => {
    const suffix = uniqueSuffix();
    const { workspaceId, unitId, manufacturerId } = await createTestWorkspace(suffix);

    const resistance = await prisma.attribute.create({
      data: {
        workspaceId,
        name: "Resistance",
        normalizedName: "resistance",
        type: "QUANTITY",
        baseUnitSymbol: "Ω"
      },
      select: { id: true }
    });

    const resistors = await prisma.partCategory.create({
      data: { workspaceId, name: "Resistors" },
      select: { id: true }
    });
    await prisma.partCategoryClosure.create({
      data: { workspaceId, ancestorId: resistors.id, descendantId: resistors.id, depth: 0 }
    });

    const capacitors = await prisma.partCategory.create({
      data: { workspaceId, name: "Capacitors" },
      select: { id: true }
    });
    await prisma.partCategoryClosure.create({
      data: { workspaceId, ancestorId: capacitors.id, descendantId: capacitors.id, depth: 0 }
    });

    const lowResistor = await createPartWithResistance({
      workspaceId,
      unitId,
      manufacturerId,
      categoryId: resistors.id,
      attributeId: resistance.id,
      catalogNumber: "R-100",
      quantityBaseValue: "100"
    });
    const highResistor = await createPartWithResistance({
      workspaceId,
      unitId,
      manufacturerId,
      categoryId: resistors.id,
      attributeId: resistance.id,
      catalogNumber: "R-10000",
      quantityBaseValue: "10000"
    });
    // A capacitor with the same attribute value must be excluded by the category filter.
    await createPartWithResistance({
      workspaceId,
      unitId,
      manufacturerId,
      categoryId: capacitors.id,
      attributeId: resistance.id,
      catalogNumber: "C-10000",
      quantityBaseValue: "10000"
    });

    const matches = await findMatchingParts({
      workspaceId,
      spec: {
        categoryId: resistors.id,
        matchers: [
          {
            attributeId: resistance.id,
            type: "QUANTITY",
            operator: "GTE",
            quantityBaseValue: "1000"
          }
        ]
      }
    });

    const matchedIds = matches.map((part) => part.id).sort();
    assert.deepEqual(matchedIds, [highResistor.id].sort());
    assert.ok(!matchedIds.includes(lowResistor.id));
  });

  test("a pinned part resolves to exactly that part and ignores matchers", async () => {
    const suffix = uniqueSuffix();
    const { workspaceId, unitId, manufacturerId } = await createTestWorkspace(suffix);

    const pinned = await prisma.part.create({
      data: { workspaceId, unitId, manufacturerId, catalogNumber: "IC-555" },
      select: { id: true, catalogNumber: true }
    });

    const matches = await findMatchingParts({
      workspaceId,
      spec: { pinnedPartId: pinned.id, matchers: [] }
    });

    assert.equal(matches.length, 1);
    assert.equal(matches[0]?.id, pinned.id);
    assert.equal(matches[0]?.catalogNumber, "IC-555");
  });
});
