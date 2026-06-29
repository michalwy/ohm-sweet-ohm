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
import {
  createBomLineItem,
  deleteBomLineItem,
  getBomLineItems,
  updateBomLineItem
} from "../../src/server/designs/bomLineItems";

function uniqueSuffix() {
  return randomBytes(4).toString("hex");
}

async function createTestWorkspace(suffix: string) {
  await ensurePermissions();

  const { workspaceId, userId } = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        email: `bom-crud-${suffix}@ohmsweetohm.local`,
        emailVerified: true,
        name: "BOM CRUD User"
      }
    });
    const workspace = await tx.workspace.create({
      data: { name: `BOM CRUD Workspace ${suffix}`, slug: `bom-crud-${suffix}` }
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

  const design = await createDesign({
    userId,
    workspaceId,
    workspaceName: `BOM CRUD Workspace ${suffix}`,
    name: "Board",
    catalogNumber: "BOARD-001",
    unitId: unitId as string
  });
  assert.ok(design.ok);

  const revision = await prisma.designRevision.findFirst({
    where: { workspaceId },
    select: { id: true }
  });
  assert.ok(revision);

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

  return { workspaceId, userId, revisionId: revision.id, resistanceId: resistance.id };
}

describe("BOM line item CRUD", () => {
  test("creates a line item with derived quantity and matchers", async () => {
    const suffix = uniqueSuffix();
    const { workspaceId, userId, revisionId, resistanceId } = await createTestWorkspace(suffix);

    const result = await createBomLineItem({
      userId,
      workspaceId,
      revisionId,
      input: {
        designators: "R1, R3, R5-R8",
        matchers: [{ attributeId: resistanceId, operator: "EQ", rawValue: "1k" }]
      }
    });
    assert.ok(result.ok, JSON.stringify(result));

    const items = await getBomLineItems({ userId, workspaceId, revisionId });
    assert.equal(items.length, 1);
    assert.equal(items[0]?.quantity, 6);
    assert.equal(items[0]?.matchers.length, 1);
    assert.equal(items[0]?.matchers[0]?.displayValue, "1 kΩ");
  });

  test("updates a line item, replacing matchers and recomputing quantity", async () => {
    const suffix = uniqueSuffix();
    const { workspaceId, userId, revisionId, resistanceId } = await createTestWorkspace(suffix);

    const created = await createBomLineItem({
      userId,
      workspaceId,
      revisionId,
      input: {
        designators: "R1",
        matchers: [{ attributeId: resistanceId, operator: "EQ", rawValue: "1k" }]
      }
    });
    assert.ok(created.ok);

    const updated = await updateBomLineItem({
      userId,
      workspaceId,
      lineItemId: created.data.id,
      input: {
        designators: "R1-R10",
        matchers: [{ attributeId: resistanceId, operator: "GTE", rawValue: "100" }]
      }
    });
    assert.ok(updated.ok, JSON.stringify(updated));

    const items = await getBomLineItems({ userId, workspaceId, revisionId });
    assert.equal(items[0]?.quantity, 10);
    assert.equal(items[0]?.matchers[0]?.operator, "GTE");

    const matcherCount = await prisma.bomMatcher.count({
      where: { lineItemId: created.data.id }
    });
    assert.equal(matcherCount, 1, "old matchers must be replaced, not accumulated");
  });

  test("deletes a line item and cascades its matchers", async () => {
    const suffix = uniqueSuffix();
    const { workspaceId, userId, revisionId, resistanceId } = await createTestWorkspace(suffix);

    const created = await createBomLineItem({
      userId,
      workspaceId,
      revisionId,
      input: {
        designators: "R1",
        matchers: [{ attributeId: resistanceId, operator: "EQ", rawValue: "1k" }]
      }
    });
    assert.ok(created.ok);

    const deleted = await deleteBomLineItem({ userId, workspaceId, lineItemId: created.data.id });
    assert.ok(deleted.ok);

    const remaining = await getBomLineItems({ userId, workspaceId, revisionId });
    assert.equal(remaining.length, 0);
    const matcherCount = await prisma.bomMatcher.count({
      where: { lineItemId: created.data.id }
    });
    assert.equal(matcherCount, 0);
  });

  test("rejects an ordering operator on a non-numeric attribute", async () => {
    const suffix = uniqueSuffix();
    const { workspaceId, userId, revisionId } = await createTestWorkspace(suffix);

    const packageAttr = await prisma.attribute.create({
      data: {
        workspaceId,
        name: "Package",
        normalizedName: "package",
        type: "TEXT"
      },
      select: { id: true }
    });

    const result = await createBomLineItem({
      userId,
      workspaceId,
      revisionId,
      input: {
        designators: "R1",
        matchers: [{ attributeId: packageAttr.id, operator: "GT", rawValue: "0207" }]
      }
    });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.error, "invalid-operator-for-type");
    }
  });

  test("rejects invalid designators", async () => {
    const suffix = uniqueSuffix();
    const { workspaceId, userId, revisionId } = await createTestWorkspace(suffix);

    const result = await createBomLineItem({
      userId,
      workspaceId,
      revisionId,
      input: { designators: "R1, R1", matchers: [] }
    });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.error, "duplicate-designator");
    }
  });
});
