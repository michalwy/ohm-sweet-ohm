import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { randomBytes } from "node:crypto";

import { prisma } from "../../src/server/db/prisma";
import { ensurePermissions } from "../../src/server/workspaces/createWorkspace";
import {
  ensureDefaultUnitsForWorkspace,
  getDefaultPartUnitId
} from "../../src/server/units/defaultUnits";
import { getPartsListPage } from "../../src/server/parts/getParts";

function uniqueSuffix() {
  return randomBytes(4).toString("hex");
}

async function createTestWorkspace(suffix: string) {
  await ensurePermissions();

  const { workspaceId, userId } = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        email: `parts-sort-test-${suffix}@ohmsweetohm.local`,
        emailVerified: true,
        name: "Parts Sort Test User"
      }
    });

    const workspace = await tx.workspace.create({
      data: {
        name: `Parts Sort Test Workspace ${suffix}`,
        slug: `parts-sort-test-${suffix}`
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

  const manufacturer = await prisma.organization.create({
    data: {
      workspaceId,
      name: `Acme ${suffix}`,
      normalizedName: `acme ${suffix}`
    },
    select: { id: true }
  });

  return {
    workspaceId,
    userId,
    unitId: unitId as string,
    manufacturerId: manufacturer.id
  };
}

async function createPart(input: {
  id: string;
  workspaceId: string;
  unitId: string;
  manufacturerId: string;
  catalogNumber: string;
  description: string | null;
}) {
  await prisma.part.create({
    data: {
      id: input.id,
      workspaceId: input.workspaceId,
      unitId: input.unitId,
      manufacturerId: input.manufacturerId,
      catalogNumber: input.catalogNumber,
      description: input.description
    }
  });
}

// Walk every page through the cursor and return the flattened catalogNumbers.
async function collectAllPages(
  context: { user: { id: string }; workspace: { id: string; primaryCurrency: string } },
  sortBy: string,
  sortDirection: "asc" | "desc",
  pageSize: number
) {
  const catalogNumbers: string[] = [];
  let cursor: string | null = null;
  let guard = 0;

  do {
    const page = await getPartsListPage(context, {
      sortBy,
      sortDirection,
      pageSize,
      cursor
    });
    catalogNumbers.push(...page.items.map((item) => item.catalogNumber));
    cursor = page.nextCursor;
    guard += 1;
    assert.ok(guard < 100, "pagination did not terminate");
  } while (cursor);

  return catalogNumbers;
}

describe("parts list DB-level string sorting", () => {
  test("sorts by description with nullable keyset pagination (asc and desc)", async () => {
    const suffix = uniqueSuffix();
    const { workspaceId, userId, unitId, manufacturerId } =
      await createTestWorkspace(suffix);
    const context = {
      user: { id: userId },
      workspace: { id: workspaceId, primaryCurrency: "EUR" }
    };

    // Lowercase, number-free descriptions so the ordering is unambiguous under
    // any DB collation; duplicates ("apple") exercise the id tiebreak and nulls
    // exercise NULLS LAST. Ids are set explicitly so tie ordering is deterministic.
    const parts: Array<{ catalogNumber: string; description: string | null }> = [
      { catalogNumber: "A", description: "banana" },
      { catalogNumber: "B", description: "apple" },
      { catalogNumber: "C", description: null },
      { catalogNumber: "D", description: "apple" },
      { catalogNumber: "E", description: null },
      { catalogNumber: "F", description: "cherry" }
    ];
    for (const part of parts) {
      await createPart({
        id: `${suffix}-${part.catalogNumber}`,
        workspaceId,
        unitId,
        manufacturerId,
        ...part
      });
    }

    // Ascending: apple(B), apple(D), banana(A), cherry(F), then the two nulls.
    const asc = await collectAllPages(context, "description", "asc", 2);
    assert.equal(asc.length, parts.length, "asc returns every part exactly once");
    assert.equal(new Set(asc).size, parts.length, "asc has no duplicates");
    assert.deepEqual(asc.slice(0, 4), ["B", "D", "A", "F"]);
    assert.deepEqual(asc.slice(4).sort(), ["C", "E"], "null descriptions trail");

    // Descending: cherry(F), banana(A), apple, apple, then nulls still last.
    const desc = await collectAllPages(context, "description", "desc", 2);
    assert.equal(desc.length, parts.length, "desc returns every part exactly once");
    assert.equal(new Set(desc).size, parts.length, "desc has no duplicates");
    assert.deepEqual(desc.slice(0, 2), ["F", "A"]);
    assert.deepEqual(desc.slice(2, 4).sort(), ["B", "D"], "apple tie, id asc");
    assert.deepEqual(desc.slice(4).sort(), ["C", "E"], "null descriptions trail");
  });

  test("sorts by catalogNumber at the database level across pages", async () => {
    const suffix = uniqueSuffix();
    const { workspaceId, userId, unitId, manufacturerId } =
      await createTestWorkspace(suffix);
    const context = {
      user: { id: userId },
      workspace: { id: workspaceId, primaryCurrency: "EUR" }
    };

    // Zero-padded so lexical (DB collation) and numeric ordering agree, keeping
    // the assertion independent of the exact collation.
    const catalogNumbers = ["P03", "P01", "P05", "P02", "P04"];
    for (const catalogNumber of catalogNumbers) {
      await createPart({
        id: `${suffix}-${catalogNumber}`,
        workspaceId,
        unitId,
        manufacturerId,
        catalogNumber,
        description: null
      });
    }

    const asc = await collectAllPages(context, "catalogNumber", "asc", 2);
    assert.deepEqual(asc, ["P01", "P02", "P03", "P04", "P05"]);

    const desc = await collectAllPages(context, "catalogNumber", "desc", 2);
    assert.deepEqual(desc, ["P05", "P04", "P03", "P02", "P01"]);
  });
});
