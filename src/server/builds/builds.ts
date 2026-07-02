import "server-only";

import { Prisma } from "@/generated/prisma/client";
import { authorizeWorkspacePermission } from "@/server/access-control/authorize";
import { prisma } from "@/server/db/prisma";
import { parseDesignatorRange } from "@/lib/designators";
import {
  decodeListCursor,
  encodeListCursor,
  getListPageSize,
  type ListPage
} from "@/server/pagination";
import { findMatchingParts } from "@/server/designs/matching";
import {
  createInventoryEntryWithinTx,
  getPartLocationBalances,
  getPartLocationBalancesWithDb
} from "@/server/inventory/entryMutations";
import { getStorageLocations, type StorageLocationListItem } from "@/server/inventory/locationMutations";
import {
  aggregateRequirementsByPart,
  isCancellable,
  requiredForLine
} from "@/server/builds/buildTransitions";

export type BuildState =
  | "CREATED"
  | "ALLOCATED"
  | "STARTED"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "CANCELLED";

export type BuildSummary = {
  id: string;
  designName: string;
  revisionNumber: number;
  outputPartCatalogNumber: string;
  targetQuantity: number;
  state: BuildState;
  unitsTotal: number;
  unitsAssembled: number;
  createdAt: Date;
  updatedAt: Date;
};

export type BuildMatchCandidate = {
  id: string;
  catalogNumber: string;
  description: string | null;
  manufacturerName: string;
  availableQuantity: string;
};

export type BuildSourceLocationBalance = {
  locationId: string;
  balance: string;
};

export type BuildLineDetail = {
  id: string;
  sourceBomLineItemId: string | null;
  designators: string;
  designatorCount: number;
  categoryName: string | null;
  part: { id: string; catalogNumber: string; availableQuantity: string } | null;
  sourceLocation: { id: string; name: string } | null;
  assignments: {
    id: string;
    designator: string;
    quantity: number;
    assembledQuantity: number;
  }[];
  matchCandidates: BuildMatchCandidate[];
  sourceLocationBalances: BuildSourceLocationBalance[];
};

export type BuildDetail = {
  id: string;
  designName: string;
  revisionId: string;
  revisionNumber: number;
  targetQuantity: number;
  state: BuildState;
  outputPart: { id: string; catalogNumber: string };
  outputLocation: { id: string; name: string } | null;
  startedAt: Date | null;
  completedAt: Date | null;
  cancelledAt: Date | null;
  createdAt: Date;
  locations: StorageLocationListItem[];
  lines: BuildLineDetail[];
};

type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string };

type BuildCursor = { key: string; id: string };

// --- List query ---

export async function getBuildsForWorkspace({
  userId,
  workspaceId,
  cursor,
  pageSize
}: {
  userId: string;
  workspaceId: string;
  cursor?: string | null;
  pageSize?: number | null;
}): Promise<ListPage<BuildSummary>> {
  await authorizeWorkspacePermission({ userId, workspaceId, permission: "builds:read" });

  const limit = getListPageSize(pageSize);
  const totalCount = await prisma.build.count({ where: { workspaceId } });

  const decoded = decodeListCursor<BuildCursor>(cursor);

  const rows = await prisma.build.findMany({
    where: {
      workspaceId,
      ...(decoded
        ? {
            OR: [
              { createdAt: { lt: new Date(decoded.key) } },
              { createdAt: new Date(decoded.key), id: { lt: decoded.id } }
            ]
          }
        : {})
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit + 1,
    select: {
      id: true,
      targetQuantity: true,
      state: true,
      createdAt: true,
      updatedAt: true,
      designRevision: {
        select: {
          revisionNumber: true,
          design: {
            select: {
              name: true,
              outputPart: { select: { catalogNumber: true } }
            }
          }
        }
      },
      lineItems: {
        select: {
          assignments: { select: { quantity: true, assembledQuantity: true } }
        }
      }
    }
  });

  const hasMore = rows.length > limit;
  const items: BuildSummary[] = rows.slice(0, limit).map((row) => {
    let unitsTotal = 0;
    let unitsAssembled = 0;
    for (const line of row.lineItems) {
      for (const assignment of line.assignments) {
        unitsTotal += assignment.quantity;
        unitsAssembled += assignment.assembledQuantity;
      }
    }
    return {
      id: row.id,
      designName: row.designRevision.design.name,
      revisionNumber: row.designRevision.revisionNumber,
      outputPartCatalogNumber: row.designRevision.design.outputPart.catalogNumber,
      targetQuantity: row.targetQuantity,
      state: row.state as BuildState,
      unitsTotal,
      unitsAssembled,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt
    };
  });

  const last = items[items.length - 1];
  const nextCursor =
    hasMore && last
      ? encodeListCursor<BuildCursor>({ key: last.createdAt.toISOString(), id: last.id })
      : null;

  return { items, nextCursor, totalCount, filteredCount: totalCount };
}

// --- Detail query ---

export async function getBuildDetail({
  userId,
  workspaceId,
  buildId
}: {
  userId: string;
  workspaceId: string;
  buildId: string;
}): Promise<BuildDetail | null> {
  await authorizeWorkspacePermission({ userId, workspaceId, permission: "builds:read" });

  const build = await prisma.build.findFirst({
    where: { id: buildId, workspaceId },
    select: {
      id: true,
      targetQuantity: true,
      state: true,
      startedAt: true,
      completedAt: true,
      cancelledAt: true,
      createdAt: true,
      outputLocation: { select: { id: true, name: true } },
      designRevision: {
        select: {
          id: true,
          revisionNumber: true,
          design: {
            select: {
              name: true,
              outputPart: { select: { id: true, catalogNumber: true } }
            }
          }
        }
      },
      lineItems: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          sourceBomLineItemId: true,
          designators: true,
          designatorCount: true,
          categoryName: true,
          part: { select: { id: true, catalogNumber: true, currentStock: true, reservedQty: true } },
          sourceLocation: { select: { id: true, name: true } },
          assignments: {
            orderBy: { createdAt: "asc" },
            select: { id: true, designator: true, quantity: true, assembledQuantity: true }
          }
        }
      }
    }
  });

  if (!build) return null;

  const editable = build.state === "CREATED";
  const candidatesByLine = editable
    ? await getMatchCandidatesForLines(
        workspaceId,
        build.lineItems
          .map((line) => line.sourceBomLineItemId)
          .filter((id): id is string => Boolean(id))
      )
    : new Map<string, BuildMatchCandidate[]>();

  // Per-part non-zero location balances, so the source-location picker can be narrowed to
  // locations that actually hold the chosen part (only needed while still allocating).
  const balancesByPart = new Map<string, BuildSourceLocationBalance[]>();
  if (editable) {
    const partIds = [
      ...new Set(build.lineItems.map((line) => line.part?.id).filter((id): id is string => Boolean(id)))
    ];
    for (const partId of partIds) {
      const balances = await getPartLocationBalances({ workspaceId, partId });
      balancesByPart.set(
        partId,
        [...balances.entries()]
          .filter(([, balance]) => balance.greaterThan(0))
          .map(([locationId, balance]) => ({ locationId, balance: balance.toString() }))
      );
    }
  }

  const locations = editable ? await getStorageLocations(workspaceId) : [];

  return {
    id: build.id,
    designName: build.designRevision.design.name,
    revisionId: build.designRevision.id,
    revisionNumber: build.designRevision.revisionNumber,
    targetQuantity: build.targetQuantity,
    state: build.state as BuildState,
    outputPart: build.designRevision.design.outputPart,
    outputLocation: build.outputLocation,
    startedAt: build.startedAt,
    completedAt: build.completedAt,
    cancelledAt: build.cancelledAt,
    createdAt: build.createdAt,
    locations,
    lines: build.lineItems.map((line) => ({
      id: line.id,
      sourceBomLineItemId: line.sourceBomLineItemId,
      designators: line.designators,
      designatorCount: line.designatorCount,
      categoryName: line.categoryName,
      part: line.part
        ? {
            id: line.part.id,
            catalogNumber: line.part.catalogNumber,
            availableQuantity: line.part.currentStock.minus(line.part.reservedQty).toString()
          }
        : null,
      sourceLocation: line.sourceLocation,
      assignments: line.assignments.map((a) => ({
        id: a.id,
        designator: a.designator,
        quantity: a.quantity,
        assembledQuantity: a.assembledQuantity
      })),
      matchCandidates: line.sourceBomLineItemId
        ? (candidatesByLine.get(line.sourceBomLineItemId) ?? [])
        : [],
      sourceLocationBalances: line.part ? (balancesByPart.get(line.part.id) ?? []) : []
    }))
  };
}

/**
 * Resolve the live match candidates for a set of source BOM lines, so the allocation picker
 * can offer parts. Re-runs `findMatchingParts` against each line's current spec; a line whose
 * BOM source was edited/deleted simply yields no candidates (UI falls back to free search).
 * Each candidate carries its available quantity (across all locations) to aid the choice.
 */
async function getMatchCandidatesForLines(
  workspaceId: string,
  bomLineItemIds: string[]
): Promise<Map<string, BuildMatchCandidate[]>> {
  const result = new Map<string, BuildMatchCandidate[]>();
  if (bomLineItemIds.length === 0) return result;

  const bomLines = await prisma.bomLineItem.findMany({
    where: { id: { in: bomLineItemIds }, workspaceId },
    select: {
      id: true,
      pinnedPartId: true,
      categoryId: true,
      matchers: {
        select: {
          attributeId: true,
          operator: true,
          textValue: true,
          numberValue: true,
          quantityBaseValue: true,
          booleanValue: true,
          choiceOptionId: true,
          attribute: { select: { type: true } }
        }
      }
    }
  });

  for (const line of bomLines) {
    const matches = await findMatchingParts({
      workspaceId,
      spec: {
        pinnedPartId: line.pinnedPartId,
        categoryId: line.categoryId,
        matchers: line.matchers.map((m) => ({
          attributeId: m.attributeId,
          type: m.attribute.type,
          operator: m.operator,
          textValue: m.textValue,
          numberValue: m.numberValue?.toString() ?? null,
          quantityBaseValue: m.quantityBaseValue?.toString() ?? null,
          booleanValue: m.booleanValue,
          choiceOptionId: m.choiceOptionId
        }))
      }
    });

    const availability = await prisma.part.findMany({
      where: { id: { in: matches.map((m) => m.id) }, workspaceId },
      select: { id: true, currentStock: true, reservedQty: true }
    });
    const availableById = new Map(
      availability.map((p) => [p.id, p.currentStock.minus(p.reservedQty).toString()])
    );

    result.set(
      line.id,
      matches.map((m) => ({
        id: m.id,
        catalogNumber: m.catalogNumber,
        description: m.description,
        manufacturerName: m.manufacturerName,
        availableQuantity: availableById.get(m.id) ?? "0"
      }))
    );
  }

  return result;
}

// --- Create-dialog options ---

export type BuildCreateOptions = {
  designs: {
    id: string;
    name: string;
    outputPartCatalogNumber: string;
    defaultLocationId: string | null;
    revisions: { id: string; revisionNumber: number }[];
  }[];
  locations: StorageLocationListItem[];
};

export async function getBuildCreateOptions({
  userId,
  workspaceId
}: {
  userId: string;
  workspaceId: string;
}): Promise<BuildCreateOptions> {
  await authorizeWorkspacePermission({ userId, workspaceId, permission: "builds:write" });

  const [designs, locations] = await Promise.all([
    prisma.design.findMany({
      where: { workspaceId },
      orderBy: [{ name: "asc" }, { id: "asc" }],
      select: {
        id: true,
        name: true,
        outputPart: { select: { catalogNumber: true, defaultLocationId: true } },
        revisions: {
          orderBy: { revisionNumber: "desc" },
          select: { id: true, revisionNumber: true }
        }
      }
    }),
    getStorageLocations(workspaceId)
  ]);

  return {
    designs: designs.map((design) => ({
      id: design.id,
      name: design.name,
      outputPartCatalogNumber: design.outputPart.catalogNumber,
      defaultLocationId: design.outputPart.defaultLocationId,
      revisions: design.revisions
    })),
    locations
  };
}

// --- Mutations: creation ---

export async function createBuild({
  userId,
  workspaceId,
  designRevisionId,
  targetQuantity,
  outputLocationId,
  createdByUserId
}: {
  userId: string;
  workspaceId: string;
  designRevisionId: string;
  targetQuantity: number;
  outputLocationId?: string | null;
  createdByUserId?: string | null;
}): Promise<ActionResult<{ id: string }>> {
  await authorizeWorkspacePermission({ userId, workspaceId, permission: "builds:write" });

  if (!Number.isInteger(targetQuantity) || targetQuantity < 1) {
    return { ok: false, error: "invalid-target-quantity" };
  }

  const revision = await prisma.designRevision.findFirst({
    where: { id: designRevisionId, workspaceId },
    select: {
      id: true,
      lineItems: {
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        select: {
          id: true,
          designators: true,
          quantity: true,
          pinnedPartId: true,
          category: { select: { name: true } }
        }
      }
    }
  });
  if (!revision) return { ok: false, error: "revision-not-found" };

  if (outputLocationId) {
    const error = await assertUsableLocation(workspaceId, outputLocationId);
    if (error) return { ok: false, error };
  }

  const build = await prisma.$transaction(async (tx) => {
    const created = await tx.build.create({
      data: {
        workspaceId,
        designRevisionId,
        targetQuantity,
        outputLocationId: outputLocationId ?? null,
        createdByUserId: createdByUserId ?? null,
        state: "CREATED"
      },
      select: { id: true }
    });

    for (const line of revision.lineItems) {
      const parsed = parseDesignatorRange(line.designators);
      const lineItem = await tx.buildLineItem.create({
        data: {
          workspaceId,
          buildId: created.id,
          sourceBomLineItemId: line.id,
          designators: line.designators,
          designatorCount: parsed.quantity,
          categoryName: line.category?.name ?? null,
          partId: line.pinnedPartId ?? null
        },
        select: { id: true }
      });

      if (parsed.designators.length > 0) {
        await tx.buildDesignatorAssignment.createMany({
          data: parsed.designators.map((designator) => ({
            workspaceId,
            buildLineItemId: lineItem.id,
            designator,
            quantity: targetQuantity
          }))
        });
      }
    }

    return created;
  });

  return { ok: true, data: { id: build.id } };
}

export async function deleteBuild({
  userId,
  workspaceId,
  buildId
}: {
  userId: string;
  workspaceId: string;
  buildId: string;
}): Promise<ActionResult<null>> {
  await authorizeWorkspacePermission({ userId, workspaceId, permission: "builds:write" });

  const build = await prisma.build.findFirst({
    where: { id: buildId, workspaceId },
    select: { id: true, state: true }
  });
  if (!build) return { ok: false, error: "build-not-found" };

  if (build.state !== "CREATED" && build.state !== "CANCELLED") {
    return { ok: false, error: "build-not-deletable" };
  }

  await prisma.build.delete({ where: { id: buildId } });
  return { ok: true, data: null };
}

// --- Mutations: state transitions ---

/**
 * Assign (or clear) the part + source location for one build line. Only permitted while the
 * build is in `CREATED`; an `ALLOCATED` build must be reopened first so the denormalized
 * `allocatedQty` stays consistent.
 */
export async function allocateBuildLine({
  userId,
  workspaceId,
  buildLineItemId,
  partId,
  sourceLocationId
}: {
  userId: string;
  workspaceId: string;
  buildLineItemId: string;
  partId: string | null;
  sourceLocationId: string | null;
}): Promise<ActionResult<null>> {
  await authorizeWorkspacePermission({ userId, workspaceId, permission: "builds:write" });

  const line = await prisma.buildLineItem.findFirst({
    where: { id: buildLineItemId, workspaceId },
    select: { id: true, build: { select: { state: true } } }
  });
  if (!line) return { ok: false, error: "build-line-not-found" };
  if (line.build.state !== "CREATED") return { ok: false, error: "build-not-editable" };

  if (partId) {
    const part = await prisma.part.findFirst({
      where: { id: partId, workspaceId },
      select: { id: true }
    });
    if (!part) return { ok: false, error: "part-not-found" };
  }
  if (sourceLocationId) {
    const error = await assertUsableLocation(workspaceId, sourceLocationId);
    if (error) return { ok: false, error };
  }

  await prisma.buildLineItem.update({
    where: { id: buildLineItemId },
    data: { partId, sourceLocationId }
  });
  return { ok: true, data: null };
}

/** `CREATED → ALLOCATED`: require every line allocated, then apply soft `allocatedQty`. */
export async function markBuildAllocated({
  userId,
  workspaceId,
  buildId
}: {
  userId: string;
  workspaceId: string;
  buildId: string;
}): Promise<ActionResult<null>> {
  await authorizeWorkspacePermission({ userId, workspaceId, permission: "builds:write" });

  const build = await loadBuildForTransition(workspaceId, buildId);
  if (!build) return { ok: false, error: "build-not-found" };
  if (build.state !== "CREATED") return { ok: false, error: "invalid-build-transition" };
  if (!build.lines.every((line) => line.partId && line.sourceLocationId)) {
    return { ok: false, error: "build-not-fully-allocated" };
  }

  const requiredByPart = buildRequirements(build);

  await prisma.$transaction(async (tx) => {
    await lockParts(tx, workspaceId, [...requiredByPart.keys()]);
    for (const [partId, required] of requiredByPart) {
      await tx.part.update({
        where: { id: partId },
        data: { allocatedQty: { increment: required } }
      });
    }
    await tx.build.update({ where: { id: buildId }, data: { state: "ALLOCATED" } });
  });

  return { ok: true, data: null };
}

/** `ALLOCATED → CREATED`: release the soft `allocatedQty` so allocation can be edited again. */
export async function reopenBuild({
  userId,
  workspaceId,
  buildId
}: {
  userId: string;
  workspaceId: string;
  buildId: string;
}): Promise<ActionResult<null>> {
  await authorizeWorkspacePermission({ userId, workspaceId, permission: "builds:write" });

  const build = await loadBuildForTransition(workspaceId, buildId);
  if (!build) return { ok: false, error: "build-not-found" };
  if (build.state !== "ALLOCATED") return { ok: false, error: "invalid-build-transition" };

  const requiredByPart = buildRequirements(build);

  await prisma.$transaction(async (tx) => {
    await lockParts(tx, workspaceId, [...requiredByPart.keys()]);
    for (const [partId, required] of requiredByPart) {
      await tx.part.update({
        where: { id: partId },
        data: { allocatedQty: { decrement: required } }
      });
    }
    await tx.build.update({ where: { id: buildId }, data: { state: "CREATED" } });
  });

  return { ok: true, data: null };
}

/**
 * `ALLOCATED → STARTED`: hard-reserve stock. Guards part-level availability
 * (`currentStock − reservedQty`) and per-line source-location balance, then moves the soft
 * allocation into a hard reservation.
 */
export async function startBuild({
  userId,
  workspaceId,
  buildId
}: {
  userId: string;
  workspaceId: string;
  buildId: string;
}): Promise<ActionResult<null>> {
  await authorizeWorkspacePermission({ userId, workspaceId, permission: "builds:write" });

  const build = await loadBuildForTransition(workspaceId, buildId);
  if (!build) return { ok: false, error: "build-not-found" };
  if (build.state !== "ALLOCATED") return { ok: false, error: "invalid-build-transition" };
  if (!build.lines.every((line) => line.partId && line.sourceLocationId)) {
    return { ok: false, error: "build-not-fully-allocated" };
  }

  const requiredByPart = buildRequirements(build);

  try {
    await prisma.$transaction(async (tx) => {
      await lockParts(tx, workspaceId, [...requiredByPart.keys()]);

      // Part-level availability: currentStock − reservedQty must cover the new reservation.
      const parts = await tx.part.findMany({
        where: { id: { in: [...requiredByPart.keys()] }, workspaceId },
        select: { id: true, currentStock: true, reservedQty: true }
      });
      for (const part of parts) {
        const required = requiredByPart.get(part.id) ?? 0;
        const available = new Prisma.Decimal(part.currentStock).minus(part.reservedQty);
        if (available.lessThan(required)) {
          throw new Error("insufficient-available-stock");
        }
      }

      // Per-line source-location balance must physically cover the line's requirement.
      for (const line of build.lines) {
        if (!line.partId || !line.sourceLocationId) continue;
        const balances = await getPartLocationBalancesWithDb(tx, {
          workspaceId,
          partId: line.partId
        });
        const balance = balances.get(line.sourceLocationId) ?? new Prisma.Decimal(0);
        if (balance.lessThan(requiredForLine(line.designatorCount, build.targetQuantity))) {
          throw new Error("insufficient-location-stock");
        }
      }

      for (const [partId, required] of requiredByPart) {
        await tx.part.update({
          where: { id: partId },
          data: {
            allocatedQty: { decrement: required },
            reservedQty: { increment: required }
          }
        });
      }
      await tx.build.update({
        where: { id: buildId },
        data: { state: "STARTED", startedAt: new Date() }
      });
    });
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "start-failed" };
  }

  return { ok: true, data: null };
}

/**
 * Assemble part of a designator: issue `quantity` units (default 1, capped at the un-assembled
 * remainder) from the line's source location, release that much reservation, and — when the
 * whole build is fully assembled — auto-complete it by receiving the output part.
 * `STARTED → IN_PROGRESS → COMPLETED`.
 */
export async function assembleDesignator({
  userId,
  workspaceId,
  assignmentId,
  quantity = 1
}: {
  userId: string;
  workspaceId: string;
  assignmentId: string;
  quantity?: number;
}): Promise<ActionResult<{ completed: boolean }>> {
  await authorizeWorkspacePermission({ userId, workspaceId, permission: "builds:write" });

  const assignment = await prisma.buildDesignatorAssignment.findFirst({
    where: { id: assignmentId, workspaceId },
    select: {
      id: true,
      designator: true,
      quantity: true,
      assembledQuantity: true,
      buildLineItem: {
        select: {
          partId: true,
          sourceLocationId: true,
          build: {
            select: {
              id: true,
              state: true,
              targetQuantity: true,
              outputLocationId: true,
              designRevision: {
                select: { design: { select: { outputPartId: true } } }
              }
            }
          }
        }
      }
    }
  });
  if (!assignment) return { ok: false, error: "assignment-not-found" };

  const remainingForDesignator = assignment.quantity - assignment.assembledQuantity;
  if (remainingForDesignator <= 0) return { ok: false, error: "designator-already-assembled" };
  if (!Number.isInteger(quantity) || quantity < 1) {
    return { ok: false, error: "invalid-assemble-quantity" };
  }
  const assembleQuantity = Math.min(quantity, remainingForDesignator);

  const line = assignment.buildLineItem;
  const build = line.build;
  if (build.state !== "STARTED" && build.state !== "IN_PROGRESS") {
    return { ok: false, error: "invalid-build-transition" };
  }
  if (!line.partId || !line.sourceLocationId) {
    return { ok: false, error: "build-not-fully-allocated" };
  }
  if (!build.outputLocationId) {
    return { ok: false, error: "output-location-required" };
  }

  try {
    const completed = await prisma.$transaction(async (tx) => {
      await createInventoryEntryWithinTx(tx, {
        workspaceId,
        partId: line.partId as string,
        entryType: "ISSUE",
        quantity: String(assembleQuantity),
        fromLocationId: line.sourceLocationId,
        note: `Build ${build.id} — designator ${assignment.designator}`,
        createdByUserId: userId
      });

      await tx.part.update({
        where: { id: line.partId as string },
        data: { reservedQty: { decrement: assembleQuantity } }
      });

      await tx.buildDesignatorAssignment.update({
        where: { id: assignmentId },
        data: { assembledQuantity: { increment: assembleQuantity } }
      });

      const remainingUnits = await tx.buildDesignatorAssignment.aggregate({
        where: { buildLineItem: { buildId: build.id } },
        _sum: { quantity: true, assembledQuantity: true }
      });
      const totalUnits = remainingUnits._sum.quantity ?? 0;
      const assembledUnits = remainingUnits._sum.assembledQuantity ?? 0;

      if (assembledUnits < totalUnits) {
        if (build.state === "STARTED") {
          await tx.build.update({ where: { id: build.id }, data: { state: "IN_PROGRESS" } });
        }
        return false;
      }

      // Last designator assembled: produce the output part and complete the build.
      await createInventoryEntryWithinTx(tx, {
        workspaceId,
        partId: build.designRevision.design.outputPartId,
        entryType: "RECEIPT",
        quantity: String(build.targetQuantity),
        toLocationId: build.outputLocationId,
        note: `Build ${build.id} — output`,
        createdByUserId: userId
      });
      await tx.build.update({
        where: { id: build.id },
        data: { state: "COMPLETED", completedAt: new Date() }
      });
      return true;
    });

    return { ok: true, data: { completed } };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "assemble-failed" };
  }
}

/**
 * Cancel a build, releasing the un-consumed soft/hard reservation. Assembled designators are
 * intentionally **not** reversed — those parts are physically used.
 */
export async function cancelBuild({
  userId,
  workspaceId,
  buildId
}: {
  userId: string;
  workspaceId: string;
  buildId: string;
}): Promise<ActionResult<null>> {
  await authorizeWorkspacePermission({ userId, workspaceId, permission: "builds:write" });

  const build = await prisma.build.findFirst({
    where: { id: buildId, workspaceId },
    select: {
      id: true,
      state: true,
      targetQuantity: true,
      lineItems: {
        select: {
          partId: true,
          assignments: { select: { quantity: true, assembledQuantity: true } }
        }
      }
    }
  });
  if (!build) return { ok: false, error: "build-not-found" };
  if (!isCancellable(build.state as BuildState)) {
    return { ok: false, error: "invalid-build-transition" };
  }

  // Remaining (un-assembled) units per part — equals the still-held soft/hard reservation.
  const remainingByPart = aggregateRequirementsByPart(
    build.lineItems.map((line) => ({
      partId: line.partId,
      required: line.assignments.reduce(
        (sum, assignment) => sum + (assignment.quantity - assignment.assembledQuantity),
        0
      )
    }))
  );

  const releaseField =
    build.state === "ALLOCATED" ? "allocatedQty" : build.state === "CREATED" ? null : "reservedQty";

  await prisma.$transaction(async (tx) => {
    if (releaseField) {
      await lockParts(tx, workspaceId, [...remainingByPart.keys()]);
      for (const [partId, amount] of remainingByPart) {
        await tx.part.update({
          where: { id: partId },
          data: { [releaseField]: { decrement: amount } }
        });
      }
    }
    await tx.build.update({
      where: { id: buildId },
      data: { state: "CANCELLED", cancelledAt: new Date() }
    });
  });

  return { ok: true, data: null };
}

// --- Shared helpers ---

type BuildForTransition = {
  state: BuildState;
  targetQuantity: number;
  lines: { partId: string | null; sourceLocationId: string | null; designatorCount: number }[];
};

async function loadBuildForTransition(
  workspaceId: string,
  buildId: string
): Promise<BuildForTransition | null> {
  const build = await prisma.build.findFirst({
    where: { id: buildId, workspaceId },
    select: {
      state: true,
      targetQuantity: true,
      lineItems: {
        select: { partId: true, sourceLocationId: true, designatorCount: true }
      }
    }
  });
  if (!build) return null;
  return {
    state: build.state as BuildState,
    targetQuantity: build.targetQuantity,
    lines: build.lineItems
  };
}

/** Per-part required quantity across all allocated lines = Σ (designatorCount × targetQuantity). */
function buildRequirements(build: BuildForTransition): Map<string, number> {
  return aggregateRequirementsByPart(
    build.lines.map((line) => ({
      partId: line.partId,
      required: requiredForLine(line.designatorCount, build.targetQuantity)
    }))
  );
}

async function lockParts(
  tx: Prisma.TransactionClient,
  workspaceId: string,
  partIds: string[]
): Promise<void> {
  if (partIds.length === 0) return;
  await tx.$queryRaw`
    SELECT id FROM "Part"
    WHERE "workspaceId" = ${workspaceId} AND id IN (${Prisma.join(partIds)})
    FOR UPDATE
  `;
}



/**
 * Validate that a storage location exists in the workspace and can receive/issue stock.
 * Returns an internal error code string when unusable, otherwise null.
 */
export async function assertUsableLocation(
  workspaceId: string,
  locationId: string,
  db: Prisma.TransactionClient | typeof prisma = prisma
): Promise<string | null> {
  const location = await db.storageLocation.findFirst({
    where: { id: locationId, workspaceId },
    select: { id: true, isAssignable: true, isArchived: true }
  });
  if (!location) return "location-not-found";
  if (location.isArchived) return "location-archived";
  if (!location.isAssignable) return "location-not-assignable";
  return null;
}
