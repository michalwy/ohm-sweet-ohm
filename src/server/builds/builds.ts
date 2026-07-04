import "server-only";

import { Prisma } from "@/generated/prisma/client";
import { authorizeWorkspacePermission } from "@/server/access-control/authorize";
import { prisma } from "@/server/db/prisma";
import { parseDesignatorRange } from "@/lib/designators";
import {
  distributeAllocations,
  requiredUnits,
  suggestAllocation,
  sumEntries,
  type AllocationCandidate,
  type AllocationEntry
} from "@/lib/buildAllocation";
import {
  decodeListCursor,
  encodeListCursor,
  getListPageSize,
  type ListPage
} from "@/server/pagination";
import { findMatchingParts, type MatchSpec } from "@/server/designs/matching";
import {
  createInventoryEntryWithinTx,
  getPartLocationBalances,
  getPartLocationBalancesWithDb
} from "@/server/inventory/entryMutations";
import {
  buildStorageLocationPaths,
  getStorageLocations,
  type StorageLocationListItem
} from "@/server/inventory/locationMutations";
import { getPartCategories } from "@/server/parts/categories";
import { aggregateRequirementsByPart, isCancellable } from "@/server/builds/buildTransitions";

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

/** Non-zero source-location balances for one part, so the entry's location picker can be narrowed. */
export type BuildPartBalances = {
  partId: string;
  balances: BuildSourceLocationBalance[];
};

/** A storage location reference with its full ancestor path (e.g. "Warehouse / Shelf A / Drawer 5"). */
export type BuildLocationRef = { id: string; name: string; path: string };

export type BuildAllocationDetail = {
  id: string;
  part: { id: string; catalogNumber: string; availableQuantity: string };
  sourceLocation: BuildLocationRef | null;
  quantity: number;
};

export type BuildAssignmentDetail = {
  id: string;
  designator: string;
  unitIndex: number;
  part: { id: string; catalogNumber: string } | null;
  sourceLocation: BuildLocationRef | null;
  assembled: boolean;
};

export type BuildLineDetail = {
  id: string;
  sourceBomLineItemId: string | null;
  designators: string;
  designatorCount: number;
  categoryName: string | null;
  requiredUnits: number;
  allocations: BuildAllocationDetail[];
  assignments: BuildAssignmentDetail[];
  matchCandidates: BuildMatchCandidate[];
  partBalances: BuildPartBalances[];
};

/** One designator's row within a single physical unit — the per-unit assembly grain. */
export type BuildUnitDesignatorDetail = {
  assignmentId: string;
  lineItemId: string;
  designator: string;
  categoryName: string | null;
  part: { id: string; catalogNumber: string } | null;
  sourceLocation: BuildLocationRef | null;
  assembled: boolean;
};

export type BuildUnitStatus = "not_started" | "in_progress" | "complete";

export type BuildUnitDetail = {
  unitIndex: number;
  status: BuildUnitStatus;
  designators: BuildUnitDesignatorDetail[];
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
  units: BuildUnitDetail[];
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
          designatorCount: true,
          assignments: { select: { assembled: true } }
        }
      }
    }
  });

  const hasMore = rows.length > limit;
  const items: BuildSummary[] = rows.slice(0, limit).map((row) => {
    let unitsTotal = 0;
    let unitsAssembled = 0;
    for (const line of row.lineItems) {
      // Total is derived from the frozen BOM (designators × target qty) so it is known before the
      // build is started and the per-designator assignment rows exist.
      unitsTotal += line.designatorCount * row.targetQuantity;
      for (const assignment of line.assignments) {
        if (assignment.assembled) unitsAssembled += 1;
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
          allocations: {
            orderBy: { createdAt: "asc" },
            select: {
              id: true,
              quantity: true,
              part: { select: { id: true, catalogNumber: true, currentStock: true, reservedQty: true } },
              sourceLocation: { select: { id: true, name: true } }
            }
          },
          assignments: {
            orderBy: [{ designator: "asc" }, { unitIndex: "asc" }],
            select: {
              id: true,
              designator: true,
              unitIndex: true,
              assembled: true,
              part: { select: { id: true, catalogNumber: true } },
              sourceLocation: { select: { id: true, name: true } }
            }
          }
        }
      }
    }
  });

  if (!build) return null;

  // Candidate parts + per-location balances are needed both while allocating (CREATED) and while
  // assembling (STARTED/IN_PROGRESS), where a designator may be re-assigned to any matching part.
  const showPickers =
    build.state === "CREATED" || build.state === "STARTED" || build.state === "IN_PROGRESS";
  const candidatesByLine = showPickers
    ? await getMatchCandidatesForLines(
        workspaceId,
        build.lineItems
          .map((line) => line.sourceBomLineItemId)
          .filter((id): id is string => Boolean(id))
      )
    : new Map<string, BuildMatchCandidate[]>();

  // Per-part non-zero location balances, so a source-location picker can be narrowed to locations
  // that actually hold the chosen part.
  const balancesByPart = new Map<string, BuildSourceLocationBalance[]>();
  if (showPickers) {
    const partIds = new Set<string>();
    for (const line of build.lineItems) {
      for (const allocation of line.allocations) partIds.add(allocation.part.id);
      for (const candidate of candidatesByLine.get(line.sourceBomLineItemId ?? "") ?? []) {
        partIds.add(candidate.id);
      }
    }
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

  // Always fetched (not just while pickers are shown): needed to render each already-chosen
  // location's full ancestor path in the read-only allocation/assembly views.
  const rawLocations = await getStorageLocations(workspaceId);
  const locations = showPickers ? rawLocations : [];
  const locationPathsById = buildStorageLocationPaths(rawLocations);
  const withPath = (location: { id: string; name: string } | null): BuildLocationRef | null =>
    location ? { ...location, path: locationPathsById.get(location.id) ?? location.name } : null;

  // Group assignment rows by unitIndex across all lines for the per-unit assembly view.
  const unitsByIndex = new Map<number, BuildUnitDesignatorDetail[]>();
  for (const line of build.lineItems) {
    for (const a of line.assignments) {
      const list = unitsByIndex.get(a.unitIndex) ?? [];
      list.push({
        assignmentId: a.id,
        lineItemId: line.id,
        designator: a.designator,
        categoryName: line.categoryName,
        part: a.part,
        sourceLocation: withPath(a.sourceLocation),
        assembled: a.assembled
      });
      unitsByIndex.set(a.unitIndex, list);
    }
  }
  const units: BuildUnitDetail[] = [...unitsByIndex.entries()]
    .sort(([a], [b]) => a - b)
    .map(([unitIndex, designators]) => {
      const assembledCount = designators.filter((d) => d.assembled).length;
      const status: BuildUnitStatus =
        assembledCount === 0
          ? "not_started"
          : assembledCount === designators.length
            ? "complete"
            : "in_progress";
      return { unitIndex, status, designators };
    });

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
    units,
    lines: build.lineItems.map((line) => {
      const candidates = line.sourceBomLineItemId
        ? (candidatesByLine.get(line.sourceBomLineItemId) ?? [])
        : [];
      const partIdsForLine = new Set<string>([
        ...line.allocations.map((a) => a.part.id),
        ...candidates.map((c) => c.id)
      ]);

      return {
        id: line.id,
        sourceBomLineItemId: line.sourceBomLineItemId,
        designators: line.designators,
        designatorCount: line.designatorCount,
        categoryName: line.categoryName,
        requiredUnits: line.designatorCount * build.targetQuantity,
        allocations: line.allocations.map((a) => ({
          id: a.id,
          part: {
            id: a.part.id,
            catalogNumber: a.part.catalogNumber,
            availableQuantity: a.part.currentStock.minus(a.part.reservedQty).toString()
          },
          sourceLocation: withPath(a.sourceLocation),
          quantity: a.quantity
        })),
        assignments: line.assignments.map((a) => ({
          id: a.id,
          designator: a.designator,
          unitIndex: a.unitIndex,
          part: a.part,
          sourceLocation: withPath(a.sourceLocation),
          assembled: a.assembled
        })),
        matchCandidates: candidates,
        partBalances: [...partIdsForLine].map((partId) => ({
          partId,
          balances: balancesByPart.get(partId) ?? []
        }))
      };
    })
  };
}

/**
 * Load each source BOM line's live match spec, so the allocation picker can offer candidate parts
 * and the creation-time suggestion can pre-fill. Returns a spec per BOM line item id.
 */
async function loadLineSpecs(
  workspaceId: string,
  bomLineItemIds: string[]
): Promise<Map<string, MatchSpec>> {
  const result = new Map<string, MatchSpec>();
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
    result.set(line.id, {
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
    });
  }

  return result;
}

/**
 * Resolve the live match candidates for a set of source BOM lines, so the allocation picker can
 * offer parts. Each candidate carries its available quantity (across all locations).
 */
async function getMatchCandidatesForLines(
  workspaceId: string,
  bomLineItemIds: string[]
): Promise<Map<string, BuildMatchCandidate[]>> {
  const result = new Map<string, BuildMatchCandidate[]>();
  const specs = await loadLineSpecs(workspaceId, bomLineItemIds);

  for (const [lineId, spec] of specs) {
    const matches = await findMatchingParts({ workspaceId, spec });

    const availability = await prisma.part.findMany({
      where: { id: { in: matches.map((m) => m.id) }, workspaceId },
      select: { id: true, currentStock: true, reservedQty: true }
    });
    const availableById = new Map(
      availability.map((p) => [p.id, p.currentStock.minus(p.reservedQty).toString()])
    );

    result.set(
      lineId,
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

/** Running tally of stock a build's pre-fill has already claimed, so later lines don't double-book. */
type SuggestionUsage = { byLocation: Map<string, number> };

/**
 * Greedily pre-fill a line's allocation from stock that is physically available, **net of what the
 * build's earlier lines already claimed** (`used`). A pinned line yields a single entry of the
 * pinned part (best remaining location); an unpinned line draws from its matching parts and their
 * remaining locations until `required` units are covered (or stock runs out, leaving a partial
 * suggestion). The returned entries are folded back into `used` by the caller.
 */
async function suggestLineAllocations(
  workspaceId: string,
  required: number,
  spec: MatchSpec,
  used: SuggestionUsage
): Promise<AllocationEntry[]> {
  if (required <= 0) return [];

  const remainingAt = (partId: string, locationId: string, balance: Prisma.Decimal) =>
    Math.floor(Number(balance)) - (used.byLocation.get(partLocationKey(partId, locationId)) ?? 0);

  if (spec.pinnedPartId) {
    const balances = await getPartLocationBalances({ workspaceId, partId: spec.pinnedPartId });
    const best = [...balances.entries()]
      .map(([locationId, balance]) => ({
        locationId,
        remaining: remainingAt(spec.pinnedPartId as string, locationId, balance)
      }))
      .filter((l) => l.remaining > 0)
      .sort((a, b) => b.remaining - a.remaining)[0];
    return [{ partId: spec.pinnedPartId, sourceLocationId: best?.locationId ?? null, quantity: required }];
  }

  const matches = await findMatchingParts({ workspaceId, spec });
  const candidates: AllocationCandidate[] = [];
  for (const match of matches) {
    const balances = await getPartLocationBalances({ workspaceId, partId: match.id });
    const locations = [...balances.entries()]
      .map(([locationId, balance]) => ({ locationId, remaining: remainingAt(match.id, locationId, balance) }))
      .filter((l) => l.remaining > 0)
      .sort((a, b) => b.remaining - a.remaining);
    for (const location of locations) {
      candidates.push({
        partId: match.id,
        sourceLocationId: location.locationId,
        available: location.remaining
      });
    }
  }
  return suggestAllocation(required, candidates);
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

  if (!outputLocationId) {
    return { ok: false, error: "output-location-required" };
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
          category: { select: { id: true, name: true } }
        }
      }
    }
  });
  if (!revision) return { ok: false, error: "revision-not-found" };

  // Full ancestor path (e.g. "Passives » Resistors"), so the frozen snapshot doesn't lose context
  // if the category is later moved or renamed.
  const categoryPathById = new Map(
    (await getPartCategories(workspaceId)).map((category) => [category.id, category.path])
  );

  if (outputLocationId) {
    const error = await assertUsableLocation(workspaceId, outputLocationId);
    if (error) return { ok: false, error };
  }

  // Pre-compute a greedy allocation suggestion per line before opening the transaction, threading a
  // running usage tally so lines that share a part/location don't each claim the same stock.
  const specs = await loadLineSpecs(
    workspaceId,
    revision.lineItems.map((line) => line.id)
  );
  const usage: SuggestionUsage = { byLocation: new Map() };
  const plan = [] as {
    line: (typeof revision.lineItems)[number];
    designatorCount: number;
    suggestion: AllocationEntry[];
  }[];
  for (const line of revision.lineItems) {
    const parsed = parseDesignatorRange(line.designators);
    const required = requiredUnits(parsed.quantity, targetQuantity);
    const spec = specs.get(line.id);
    const suggestion = spec ? await suggestLineAllocations(workspaceId, required, spec, usage) : [];
    for (const entry of suggestion) {
      if (!entry.sourceLocationId) continue;
      const key = partLocationKey(entry.partId, entry.sourceLocationId);
      usage.byLocation.set(key, (usage.byLocation.get(key) ?? 0) + entry.quantity);
    }
    plan.push({ line, designatorCount: parsed.quantity, suggestion });
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

    for (const { line, designatorCount, suggestion } of plan) {
      const lineItem = await tx.buildLineItem.create({
        data: {
          workspaceId,
          buildId: created.id,
          sourceBomLineItemId: line.id,
          designators: line.designators,
          designatorCount,
          categoryName: line.category ? (categoryPathById.get(line.category.id) ?? line.category.name) : null
        },
        select: { id: true }
      });

      if (suggestion.length > 0) {
        await tx.buildLineAllocation.createMany({
          data: suggestion.map((entry) => ({
            workspaceId,
            buildLineItemId: lineItem.id,
            partId: entry.partId,
            sourceLocationId: entry.sourceLocationId,
            quantity: entry.quantity
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

// --- Mutations: allocation ---

/**
 * Replace the split allocation of one build line: a set of {part, source location, quantity}
 * entries. Only permitted while the build is `CREATED`; an `ALLOCATED` build must be reopened
 * first so the denormalized `allocatedQty` stays consistent. Partial totals are allowed while
 * editing — the "fully allocated" guard is enforced at allocate/start.
 */
export async function setBuildLineAllocations({
  userId,
  workspaceId,
  buildLineItemId,
  entries
}: {
  userId: string;
  workspaceId: string;
  buildLineItemId: string;
  entries: { partId: string; sourceLocationId: string | null; quantity: number }[];
}): Promise<ActionResult<null>> {
  await authorizeWorkspacePermission({ userId, workspaceId, permission: "builds:write" });

  const line = await prisma.buildLineItem.findFirst({
    where: { id: buildLineItemId, workspaceId },
    select: { id: true, buildId: true, build: { select: { state: true } } }
  });
  if (!line) return { ok: false, error: "build-line-not-found" };
  if (line.build.state !== "CREATED") return { ok: false, error: "build-not-editable" };

  for (const entry of entries) {
    if (!Number.isInteger(entry.quantity) || entry.quantity < 1) {
      return { ok: false, error: "invalid-allocation-quantity" };
    }
    const part = await prisma.part.findFirst({
      where: { id: entry.partId, workspaceId },
      select: { id: true }
    });
    if (!part) return { ok: false, error: "part-not-found" };
    if (entry.sourceLocationId) {
      const error = await assertUsableLocation(workspaceId, entry.sourceLocationId);
      if (error) return { ok: false, error };
    }
  }

  // Stock guard: never allocate more of a part than is available (currentStock − reservedQty),
  // nor more at a (part, location) than that location physically holds. The build is still
  // CREATED, so it holds no reservation of its own yet — availability is otherwise-committed stock.
  const perPart = new Map<string, number>();
  const perPartLocation = new Map<string, { partId: string; locationId: string; qty: number }>();
  for (const entry of entries) {
    perPart.set(entry.partId, (perPart.get(entry.partId) ?? 0) + entry.quantity);
    if (entry.sourceLocationId) {
      const key = partLocationKey(entry.partId, entry.sourceLocationId);
      const existing = perPartLocation.get(key);
      perPartLocation.set(key, {
        partId: entry.partId,
        locationId: entry.sourceLocationId,
        qty: (existing?.qty ?? 0) + entry.quantity
      });
    }
  }

  // Stock claimed by the build's other lines must be reserved for them, so it is netted out of
  // what this line may draw (parts are shared workspace stock).
  const otherAllocations = await prisma.buildLineAllocation.findMany({
    where: { workspaceId, buildLineItem: { buildId: line.buildId }, buildLineItemId: { not: buildLineItemId } },
    select: { partId: true, sourceLocationId: true, quantity: true }
  });
  const otherByPart = new Map<string, number>();
  const otherByPartLocation = new Map<string, number>();
  for (const a of otherAllocations) {
    otherByPart.set(a.partId, (otherByPart.get(a.partId) ?? 0) + a.quantity);
    if (a.sourceLocationId) {
      const key = partLocationKey(a.partId, a.sourceLocationId);
      otherByPartLocation.set(key, (otherByPartLocation.get(key) ?? 0) + a.quantity);
    }
  }

  const parts = await prisma.part.findMany({
    where: { id: { in: [...perPart.keys()] }, workspaceId },
    select: { id: true, currentStock: true, reservedQty: true }
  });
  const availableById = new Map(parts.map((p) => [p.id, p.currentStock.minus(p.reservedQty)]));
  for (const [partId, qty] of perPart) {
    const available = (availableById.get(partId) ?? new Prisma.Decimal(0)).minus(
      otherByPart.get(partId) ?? 0
    );
    if (available.lessThan(qty)) return { ok: false, error: "insufficient-available-stock" };
  }

  const balancesByPart = new Map<string, Map<string, Prisma.Decimal>>();
  for (const { partId, locationId, qty } of perPartLocation.values()) {
    let balances = balancesByPart.get(partId);
    if (!balances) {
      balances = await getPartLocationBalances({ workspaceId, partId });
      balancesByPart.set(partId, balances);
    }
    const balance = (balances.get(locationId) ?? new Prisma.Decimal(0)).minus(
      otherByPartLocation.get(partLocationKey(partId, locationId)) ?? 0
    );
    if (balance.lessThan(qty)) return { ok: false, error: "insufficient-location-stock" };
  }

  await prisma.$transaction(async (tx) => {
    await tx.buildLineAllocation.deleteMany({ where: { buildLineItemId } });
    if (entries.length > 0) {
      await tx.buildLineAllocation.createMany({
        data: entries.map((entry) => ({
          workspaceId,
          buildLineItemId,
          partId: entry.partId,
          sourceLocationId: entry.sourceLocationId,
          quantity: entry.quantity
        }))
      });
    }
  });

  return { ok: true, data: null };
}

/**
 * Replace the split allocation of **every** line of a build in one transaction. This is the
 * authoritative save for the allocation editor: the whole draft is validated against stock together
 * and written atomically, so partial per-line saves can never leave the build over-allocated.
 * Partial totals per line are allowed (completeness is enforced later at allocate/start); only the
 * aggregate stock guards apply. Only permitted while the build is `CREATED`.
 */
export async function setBuildAllocations({
  userId,
  workspaceId,
  buildId,
  lines
}: {
  userId: string;
  workspaceId: string;
  buildId: string;
  lines: {
    buildLineItemId: string;
    entries: { partId: string; sourceLocationId: string | null; quantity: number }[];
  }[];
}): Promise<ActionResult<null>> {
  await authorizeWorkspacePermission({ userId, workspaceId, permission: "builds:write" });

  const build = await prisma.build.findFirst({
    where: { id: buildId, workspaceId },
    select: { id: true, state: true, lineItems: { select: { id: true } } }
  });
  if (!build) return { ok: false, error: "build-not-found" };
  if (build.state !== "CREATED") return { ok: false, error: "build-not-editable" };

  const lineIds = new Set(build.lineItems.map((l) => l.id));
  const allEntries: { partId: string; sourceLocationId: string | null; quantity: number }[] = [];
  for (const line of lines) {
    if (!lineIds.has(line.buildLineItemId)) return { ok: false, error: "build-line-not-found" };
    for (const entry of line.entries) {
      if (!Number.isInteger(entry.quantity) || entry.quantity < 1) {
        return { ok: false, error: "invalid-allocation-quantity" };
      }
      const part = await prisma.part.findFirst({
        where: { id: entry.partId, workspaceId },
        select: { id: true }
      });
      if (!part) return { ok: false, error: "part-not-found" };
      if (entry.sourceLocationId) {
        const error = await assertUsableLocation(workspaceId, entry.sourceLocationId);
        if (error) return { ok: false, error };
      }
      allEntries.push(entry);
    }
  }

  // Aggregate stock guard across the whole build at once — this is what makes per-line saves safe.
  const perPart = new Map<string, number>();
  const perPartLocation = new Map<string, { partId: string; locationId: string; qty: number }>();
  for (const entry of allEntries) {
    perPart.set(entry.partId, (perPart.get(entry.partId) ?? 0) + entry.quantity);
    if (entry.sourceLocationId) {
      const key = partLocationKey(entry.partId, entry.sourceLocationId);
      const existing = perPartLocation.get(key);
      perPartLocation.set(key, {
        partId: entry.partId,
        locationId: entry.sourceLocationId,
        qty: (existing?.qty ?? 0) + entry.quantity
      });
    }
  }

  const parts = await prisma.part.findMany({
    where: { id: { in: [...perPart.keys()] }, workspaceId },
    select: { id: true, currentStock: true, reservedQty: true }
  });
  const availableById = new Map(parts.map((p) => [p.id, p.currentStock.minus(p.reservedQty)]));
  for (const [partId, qty] of perPart) {
    const available = availableById.get(partId) ?? new Prisma.Decimal(0);
    if (available.lessThan(qty)) return { ok: false, error: "insufficient-available-stock" };
  }

  const balancesByPart = new Map<string, Map<string, Prisma.Decimal>>();
  for (const { partId, locationId, qty } of perPartLocation.values()) {
    let balances = balancesByPart.get(partId);
    if (!balances) {
      balances = await getPartLocationBalances({ workspaceId, partId });
      balancesByPart.set(partId, balances);
    }
    const balance = balances.get(locationId) ?? new Prisma.Decimal(0);
    if (balance.lessThan(qty)) return { ok: false, error: "insufficient-location-stock" };
  }

  await prisma.$transaction(async (tx) => {
    await tx.buildLineAllocation.deleteMany({ where: { buildLineItem: { buildId } } });
    const data = lines.flatMap((line) =>
      line.entries.map((entry) => ({
        workspaceId,
        buildLineItemId: line.buildLineItemId,
        partId: entry.partId,
        sourceLocationId: entry.sourceLocationId,
        quantity: entry.quantity
      }))
    );
    if (data.length > 0) await tx.buildLineAllocation.createMany({ data });
  });

  return { ok: true, data: null };
}

// --- Mutations: state transitions ---

/** `CREATED → ALLOCATED`: require every line fully allocated, then apply soft `allocatedQty`. */
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
  if (!isFullyAllocated(build)) return { ok: false, error: "build-not-fully-allocated" };

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
 * `ALLOCATED → STARTED`: hard-reserve stock and distribute the allocation down to per-designator,
 * per-part assignment rows. Guards part-level availability (`currentStock − reservedQty`) and each
 * (part, source-location) balance, then moves the soft allocation into a hard reservation.
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
  if (!isFullyAllocated(build)) return { ok: false, error: "build-not-fully-allocated" };

  const requiredByPart = buildRequirements(build);
  const requiredByPartLocation = requirementsByPartLocation(build);

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

      // Each (part, source location) balance must physically cover its aggregated requirement.
      const balancesByPart = new Map<string, Awaited<ReturnType<typeof getPartLocationBalancesWithDb>>>();
      for (const [key, required] of requiredByPartLocation) {
        const { partId, locationId } = splitPartLocationKey(key);
        let balances = balancesByPart.get(partId);
        if (!balances) {
          balances = await getPartLocationBalancesWithDb(tx, { workspaceId, partId });
          balancesByPart.set(partId, balances);
        }
        const balance = balances.get(locationId) ?? new Prisma.Decimal(0);
        if (balance.lessThan(required)) {
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

      // Distribute each line's allocation into per-designator, per-part assignment rows.
      for (const line of build.lines) {
        const parsed = parseDesignatorRange(line.designators);
        const rows = distributeAllocations(
          parsed.designators,
          build.targetQuantity,
          line.allocations.map((a) => ({
            partId: a.partId,
            sourceLocationId: a.sourceLocationId,
            quantity: a.quantity
          }))
        );
        if (rows.length > 0) {
          await tx.buildDesignatorAssignment.createMany({
            data: rows.map((row) => ({
              workspaceId,
              buildLineItemId: line.id,
              designator: row.designator,
              unitIndex: row.unitIndex,
              partId: row.partId,
              sourceLocationId: row.sourceLocationId
            }))
          });
        }
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

type AssignmentForAssembly = {
  id: string;
  designator: string;
  unitIndex: number;
  assembled: boolean;
  partId: string | null;
  sourceLocationId: string | null;
};

type BuildForAssembly = {
  id: string;
  state: BuildState;
  targetQuantity: number;
  outputLocationId: string | null;
  designRevision: { design: { outputPartId: string } };
};

/**
 * Issue one assignment row's single unit from its source location, release its reservation, and
 * mark it assembled. Shared by {@link assembleDesignator} and {@link assembleBuildUnit}; does not
 * check build completion — callers run that once after all of their rows are issued.
 */
async function issueAssignmentWithinTx(
  tx: Prisma.TransactionClient,
  {
    workspaceId,
    userId,
    build,
    assignment
  }: {
    workspaceId: string;
    userId: string;
    build: Pick<BuildForAssembly, "id">;
    assignment: AssignmentForAssembly;
  }
): Promise<void> {
  await createInventoryEntryWithinTx(tx, {
    workspaceId,
    partId: assignment.partId as string,
    entryType: "ISSUE",
    quantity: "1",
    fromLocationId: assignment.sourceLocationId,
    note: `Build ${build.id} — designator ${assignment.designator} (unit ${assignment.unitIndex})`,
    createdByUserId: userId
  });

  await tx.part.update({
    where: { id: assignment.partId as string },
    data: { reservedQty: { decrement: 1 } }
  });

  await tx.buildDesignatorAssignment.update({
    where: { id: assignment.id },
    data: { assembled: true, assembledAt: new Date() }
  });
}

/**
 * Check whether every assignment row of a build is assembled and, if so, produce the output part
 * and complete the build; otherwise move `STARTED` to `IN_PROGRESS`. Returns whether the build
 * completed as a result of this call.
 */
async function checkBuildCompletionWithinTx(
  tx: Prisma.TransactionClient,
  { userId, workspaceId, build }: { userId: string; workspaceId: string; build: BuildForAssembly }
): Promise<boolean> {
  const totalRows = await tx.buildDesignatorAssignment.count({
    where: { buildLineItem: { buildId: build.id } }
  });
  const assembledRows = await tx.buildDesignatorAssignment.count({
    where: { buildLineItem: { buildId: build.id }, assembled: true }
  });

  if (assembledRows < totalRows) {
    if (build.state === "STARTED") {
      await tx.build.update({ where: { id: build.id }, data: { state: "IN_PROGRESS" } });
    }
    return false;
  }

  // Last unit assembled: produce the output part and complete the build.
  await createInventoryEntryWithinTx(tx, {
    workspaceId,
    partId: build.designRevision.design.outputPartId,
    entryType: "RECEIPT",
    quantity: String(build.targetQuantity),
    toLocationId: build.outputLocationId as string,
    note: `Build ${build.id} — output`,
    createdByUserId: userId
  });
  await tx.build.update({
    where: { id: build.id },
    data: { state: "COMPLETED", completedAt: new Date() }
  });
  return true;
}

/**
 * Assemble a single (designator × unit) row: issue that one unit from the row's source location,
 * release its reservation, mark it assembled, and — when the whole build is fully assembled —
 * auto-complete it by receiving the output part. `STARTED → IN_PROGRESS → COMPLETED`.
 */
export async function assembleDesignator({
  userId,
  workspaceId,
  assignmentId
}: {
  userId: string;
  workspaceId: string;
  assignmentId: string;
}): Promise<ActionResult<{ completed: boolean }>> {
  await authorizeWorkspacePermission({ userId, workspaceId, permission: "builds:write" });

  const assignment = await prisma.buildDesignatorAssignment.findFirst({
    where: { id: assignmentId, workspaceId },
    select: {
      id: true,
      designator: true,
      unitIndex: true,
      assembled: true,
      partId: true,
      sourceLocationId: true,
      buildLineItem: {
        select: {
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
  if (assignment.assembled) return { ok: false, error: "designator-already-assembled" };

  const build = assignment.buildLineItem.build;
  if (build.state !== "STARTED" && build.state !== "IN_PROGRESS") {
    return { ok: false, error: "invalid-build-transition" };
  }
  if (!assignment.partId || !assignment.sourceLocationId) {
    return { ok: false, error: "build-not-fully-allocated" };
  }
  if (!build.outputLocationId) {
    return { ok: false, error: "output-location-required" };
  }

  try {
    const completed = await prisma.$transaction(async (tx) => {
      await issueAssignmentWithinTx(tx, { workspaceId, userId, build, assignment });
      return checkBuildCompletionWithinTx(tx, {
        userId,
        workspaceId,
        build: build as BuildForAssembly
      });
    });

    return { ok: true, data: { completed } };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "assemble-failed" };
  }
}

/**
 * Assemble every not-yet-assembled row for one physical unit (across all of the build's lines) in
 * a single transaction — the "assemble this whole board" convenience. Rows already assembled are
 * skipped rather than erroring; auto-completes the build the same way as {@link assembleDesignator}.
 */
export async function assembleBuildUnit({
  userId,
  workspaceId,
  buildId,
  unitIndex
}: {
  userId: string;
  workspaceId: string;
  buildId: string;
  unitIndex: number;
}): Promise<ActionResult<{ completed: boolean }>> {
  await authorizeWorkspacePermission({ userId, workspaceId, permission: "builds:write" });

  const build = await prisma.build.findFirst({
    where: { id: buildId, workspaceId },
    select: {
      id: true,
      state: true,
      targetQuantity: true,
      outputLocationId: true,
      designRevision: { select: { design: { select: { outputPartId: true } } } }
    }
  });
  if (!build) return { ok: false, error: "build-not-found" };
  if (build.state !== "STARTED" && build.state !== "IN_PROGRESS") {
    return { ok: false, error: "invalid-build-transition" };
  }
  if (!build.outputLocationId) {
    return { ok: false, error: "output-location-required" };
  }

  const assignments = await prisma.buildDesignatorAssignment.findMany({
    where: { workspaceId, unitIndex, assembled: false, buildLineItem: { buildId } },
    select: {
      id: true,
      designator: true,
      unitIndex: true,
      assembled: true,
      partId: true,
      sourceLocationId: true
    }
  });
  if (assignments.length === 0) return { ok: false, error: "unit-already-assembled" };
  if (assignments.some((a) => !a.partId || !a.sourceLocationId)) {
    return { ok: false, error: "build-not-fully-allocated" };
  }

  try {
    const completed = await prisma.$transaction(async (tx) => {
      for (const assignment of assignments) {
        await issueAssignmentWithinTx(tx, { workspaceId, userId, build, assignment });
      }
      return checkBuildCompletionWithinTx(tx, { userId, workspaceId, build });
    });

    return { ok: true, data: { completed } };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "assemble-failed" };
  }
}

/**
 * Assembly-time override: switch a designator's not-yet-assembled part row to any inventory part
 * that satisfies the line's BOM spec (e.g. the wrong part was grabbed from the bench). Moves the
 * hard reservation from the old part to the new one. `STARTED`/`IN_PROGRESS` only.
 */
export async function reassignDesignatorAssignment({
  userId,
  workspaceId,
  assignmentId,
  partId,
  sourceLocationId
}: {
  userId: string;
  workspaceId: string;
  assignmentId: string;
  partId: string;
  sourceLocationId: string | null;
}): Promise<ActionResult<null>> {
  await authorizeWorkspacePermission({ userId, workspaceId, permission: "builds:write" });

  const assignment = await prisma.buildDesignatorAssignment.findFirst({
    where: { id: assignmentId, workspaceId },
    select: {
      id: true,
      assembled: true,
      partId: true,
      buildLineItem: {
        select: {
          sourceBomLineItemId: true,
          build: { select: { state: true } }
        }
      }
    }
  });
  if (!assignment) return { ok: false, error: "assignment-not-found" };

  const state = assignment.buildLineItem.build.state;
  if (state !== "STARTED" && state !== "IN_PROGRESS") {
    return { ok: false, error: "invalid-build-transition" };
  }
  if (assignment.assembled) {
    return { ok: false, error: "designator-already-assembled" };
  }

  const newPart = await prisma.part.findFirst({
    where: { id: partId, workspaceId },
    select: { id: true }
  });
  if (!newPart) return { ok: false, error: "part-not-found" };

  // The replacement must satisfy the line's BOM spec (when its source line still exists).
  const bomLineItemId = assignment.buildLineItem.sourceBomLineItemId;
  if (bomLineItemId) {
    const specs = await loadLineSpecs(workspaceId, [bomLineItemId]);
    const spec = specs.get(bomLineItemId);
    if (spec) {
      const matches = await findMatchingParts({ workspaceId, spec });
      if (!matches.some((m) => m.id === partId)) {
        return { ok: false, error: "part-does-not-match-spec" };
      }
    }
  }

  if (sourceLocationId) {
    const error = await assertUsableLocation(workspaceId, sourceLocationId);
    if (error) return { ok: false, error };
  }

  const oldPartId = assignment.partId;
  const amount = 1; // each row is exactly one physical unit's designator.

  try {
    await prisma.$transaction(async (tx) => {
      const lockIds = [...new Set([partId, ...(oldPartId ? [oldPartId] : [])])];
      await lockParts(tx, workspaceId, lockIds);

      // New part must have enough available (excluding what this row already reserves on the old part).
      const newPartRow = await tx.part.findFirstOrThrow({
        where: { id: partId, workspaceId },
        select: { currentStock: true, reservedQty: true }
      });
      const available = new Prisma.Decimal(newPartRow.currentStock).minus(newPartRow.reservedQty);
      const alreadyReservedHere = oldPartId === partId ? amount : 0;
      if (available.plus(alreadyReservedHere).lessThan(amount)) {
        throw new Error("insufficient-available-stock");
      }

      if (sourceLocationId) {
        const balances = await getPartLocationBalancesWithDb(tx, { workspaceId, partId });
        const balance = balances.get(sourceLocationId) ?? new Prisma.Decimal(0);
        if (balance.lessThan(amount)) {
          throw new Error("insufficient-location-stock");
        }
      }

      if (oldPartId && oldPartId !== partId) {
        await tx.part.update({
          where: { id: oldPartId },
          data: { reservedQty: { decrement: amount } }
        });
        await tx.part.update({
          where: { id: partId },
          data: { reservedQty: { increment: amount } }
        });
      }

      await tx.buildDesignatorAssignment.update({
        where: { id: assignmentId },
        data: { partId, sourceLocationId }
      });
    });
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "reassign-failed" };
  }

  return { ok: true, data: null };
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
      lineItems: {
        select: {
          allocations: { select: { partId: true, quantity: true } },
          assignments: { select: { partId: true, assembled: true } }
        }
      }
    }
  });
  if (!build) return { ok: false, error: "build-not-found" };
  if (!isCancellable(build.state as BuildState)) {
    return { ok: false, error: "invalid-build-transition" };
  }

  // What remains reserved/allocated depends on the phase: before start the hold lives on the
  // allocation entries (`allocatedQty`); once started it lives on the un-assembled portion of the
  // per-designator rows (`reservedQty`).
  const releaseField =
    build.state === "ALLOCATED" ? "allocatedQty" : build.state === "CREATED" ? null : "reservedQty";

  const remainingByPart =
    build.state === "ALLOCATED"
      ? aggregateRequirementsByPart(
          build.lineItems.flatMap((line) =>
            line.allocations.map((a) => ({ partId: a.partId, required: a.quantity }))
          )
        )
      : aggregateRequirementsByPart(
          build.lineItems.flatMap((line) =>
            line.assignments.map((a) => ({
              partId: a.partId,
              required: a.assembled ? 0 : 1
            }))
          )
        );

  await prisma.$transaction(async (tx) => {
    if (releaseField) {
      await lockParts(tx, workspaceId, [...remainingByPart.keys()]);
      for (const [partId, amount] of remainingByPart) {
        if (amount === 0) continue;
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

type TransitionAllocation = { partId: string; sourceLocationId: string | null; quantity: number };

type BuildForTransition = {
  state: BuildState;
  targetQuantity: number;
  lines: { id: string; designators: string; designatorCount: number; allocations: TransitionAllocation[] }[];
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
        select: {
          id: true,
          designators: true,
          designatorCount: true,
          allocations: { select: { partId: true, sourceLocationId: true, quantity: true } }
        }
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

/** A line is fully allocated when its entries cover the requirement and each has a source location. */
function isFullyAllocated(build: BuildForTransition): boolean {
  return build.lines.every((line) => {
    const required = requiredUnits(line.designatorCount, build.targetQuantity);
    if (required === 0) return true;
    if (line.allocations.length === 0) return false;
    if (line.allocations.some((a) => !a.sourceLocationId)) return false;
    return sumEntries(line.allocations) === required;
  });
}

/** Per-part required quantity across all allocation entries. */
function buildRequirements(build: BuildForTransition): Map<string, number> {
  return aggregateRequirementsByPart(
    build.lines.flatMap((line) =>
      line.allocations.map((a) => ({ partId: a.partId, required: a.quantity }))
    )
  );
}

/** Per-(part, location) required quantity across all allocation entries with a source location. */
function requirementsByPartLocation(build: BuildForTransition): Map<string, number> {
  const byKey = new Map<string, number>();
  for (const line of build.lines) {
    for (const allocation of line.allocations) {
      if (!allocation.sourceLocationId) continue;
      const key = partLocationKey(allocation.partId, allocation.sourceLocationId);
      byKey.set(key, (byKey.get(key) ?? 0) + allocation.quantity);
    }
  }
  return byKey;
}

function partLocationKey(partId: string, locationId: string): string {
  return `${partId}::${locationId}`;
}

function splitPartLocationKey(key: string): { partId: string; locationId: string } {
  const index = key.indexOf("::");
  return { partId: key.slice(0, index), locationId: key.slice(index + 2) };
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
