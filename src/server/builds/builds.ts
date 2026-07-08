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
  getPartLocationAvailableBalances,
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

export type BuildState = "ALLOCATING" | "STARTED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";

export type BuildSummary = {
  id: string;
  designName: string;
  revisionNumber: number;
  outputPartCatalogNumber: string;
  targetQuantity: number;
  state: BuildState;
  unitsTotal: number;
  unitsAllocated: number;
  unitsAssembled: number;
  createdAt: Date;
  updatedAt: Date;
};

export type BuildMatchCandidate = {
  id: string;
  catalogNumber: string;
  description: string | null;
  manufacturerName: string;
  /** Physically on hand and unreserved (`currentStock − reservedQty`). */
  onHandAvailableQuantity: string;
  /** Incoming (`onOrderQty + inProductionQty`) — can be planned against, but not started against. */
  incomingAvailableQuantity: string;
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
  part: {
    id: string;
    catalogNumber: string;
    onHandAvailableQuantity: string;
    incomingAvailableQuantity: string;
  };
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

/**
 * One allocation entry that no longer clears the stock guards `startBuild` will enforce, because
 * stock moved after the build was allocated (e.g. another build reserved the same part/location).
 */
export type BuildAllocationWarning = {
  lineItemId: string;
  partId: string;
  partCatalogNumber: string;
  sourceLocation: BuildLocationRef | null;
  requiredQuantity: number;
  reason: "insufficient-available-stock" | "insufficient-location-stock";
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
  /** Only populated while `state === "ALLOCATING"`; see {@link getAllocationWarnings}. */
  allocationWarnings: BuildAllocationWarning[];
};

/** One part entry to pick from a single source location, aggregated across the build's lines. */
export type BuildPickListEntry = {
  partId: string;
  catalogNumber: string;
  manufacturerName: string;
  /** The BOM line's frozen full category path (e.g. "Passives » Resistors"), from the first line contributing this entry. */
  categoryName: string | null;
  totalQuantity: number;
  /** Units already assembled from this (part, location) pair; always 0 while `state === "ALLOCATING"`. */
  assembledQuantity: number;
};

export type BuildPickListGroup = {
  locationId: string | null;
  locationPath: string;
  entries: BuildPickListEntry[];
};

export type BuildPickList = {
  id: string;
  designName: string;
  revisionNumber: number;
  targetQuantity: number;
  state: BuildState;
  groups: BuildPickListGroup[];
};

/** One designator's assignment within a printable assembly list unit. */
export type BuildAssemblyListEntry = {
  assignmentId: string;
  designator: string;
  categoryName: string | null;
  part: { id: string; catalogNumber: string; manufacturerName: string } | null;
  sourceLocation: BuildLocationRef | null;
  assembled: boolean;
};

export type BuildAssemblyListUnit = {
  unitIndex: number;
  status: BuildUnitStatus;
  entries: BuildAssemblyListEntry[];
};

export type BuildAssemblyList = {
  id: string;
  designName: string;
  revisionNumber: number;
  targetQuantity: number;
  state: BuildState;
  units: BuildAssemblyListUnit[];
};

type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string };

type BuildCursor = { key: string; id: string };

// --- List query ---

const buildSummarySelect = {
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
      assignments: { select: { assembled: true } },
      allocations: { select: { quantity: true } }
    }
  }
} satisfies Prisma.BuildSelect;

function mapBuildSummary(row: Prisma.BuildGetPayload<{ select: typeof buildSummarySelect }>): BuildSummary {
  let unitsTotal = 0;
  let unitsAllocated = 0;
  let unitsAssembled = 0;
  for (const line of row.lineItems) {
    // Total is derived from the frozen BOM (designators × target qty) so it is known before the
    // build is started and the per-designator assignment rows exist.
    unitsTotal += line.designatorCount * row.targetQuantity;
    for (const allocation of line.allocations) {
      unitsAllocated += allocation.quantity;
    }
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
    unitsAllocated,
    unitsAssembled,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  };
}

export async function getBuildsForWorkspace({
  userId,
  workspaceId,
  cursor,
  pageSize,
  pinnedId
}: {
  userId: string;
  workspaceId: string;
  cursor?: string | null;
  pageSize?: number | null;
  /** When set, ignore cursor/pagination and return only this build (navigated here via an entity link). */
  pinnedId?: string | null;
}): Promise<ListPage<BuildSummary>> {
  await authorizeWorkspacePermission({ userId, workspaceId, permission: "builds:read" });

  const totalCount = await prisma.build.count({ where: { workspaceId } });

  if (pinnedId) {
    const row = await prisma.build.findFirst({
      where: { id: pinnedId, workspaceId },
      select: buildSummarySelect
    });
    if (!row) {
      return { items: [], nextCursor: null, totalCount, filteredCount: 0 };
    }
    return { items: [mapBuildSummary(row)], nextCursor: null, totalCount, filteredCount: 1 };
  }

  const limit = getListPageSize(pageSize);

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
    select: buildSummarySelect
  });

  const hasMore = rows.length > limit;
  const items: BuildSummary[] = rows.slice(0, limit).map(mapBuildSummary);

  const last = items[items.length - 1];
  const nextCursor =
    hasMore && last
      ? encodeListCursor<BuildCursor>({ key: last.createdAt.toISOString(), id: last.id })
      : null;

  return { items, nextCursor, totalCount, filteredCount: totalCount };
}

// --- Part detail: builds allocating/reserving a part ---

export type PartBuildAllocationItem = {
  buildId: string;
  designName: string;
  revisionNumber: number;
  targetQuantity: number;
  state: BuildState;
  allocatedQty: number;
  reservedQty: number;
};

const partBuildAllocationSelect = {
  id: true,
  targetQuantity: true,
  state: true,
  createdAt: true,
  designRevision: {
    select: {
      revisionNumber: true,
      design: { select: { name: true } }
    }
  }
} satisfies Prisma.BuildSelect;

/**
 * Builds currently holding a live allocation or reservation for a part (ADR 0021/0023/0025): a
 * build in ALLOCATING state holds soft `allocatedQty` via BuildLineAllocation rows (live from the
 * moment entries are saved), while STARTED/IN_PROGRESS builds hold hard `reservedQty` via
 * unassembled (not yet assembled) BuildDesignatorAssignment rows. A build is in exactly one state,
 * so it can only ever contribute to one of the two buckets.
 */
export async function getPartBuildAllocations({
  userId,
  workspaceId,
  partId
}: {
  userId: string;
  workspaceId: string;
  partId: string;
}): Promise<PartBuildAllocationItem[]> {
  await authorizeWorkspacePermission({ userId, workspaceId, permission: "builds:read" });

  const [allocatedRows, reservedRows] = await Promise.all([
    prisma.build.findMany({
      where: {
        workspaceId,
        state: "ALLOCATING",
        lineItems: { some: { allocations: { some: { partId } } } }
      },
      select: {
        ...partBuildAllocationSelect,
        lineItems: {
          select: { allocations: { where: { partId }, select: { quantity: true } } }
        }
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }]
    }),
    prisma.build.findMany({
      where: {
        workspaceId,
        state: { in: ["STARTED", "IN_PROGRESS"] },
        lineItems: { some: { assignments: { some: { partId, assembled: false } } } }
      },
      select: {
        ...partBuildAllocationSelect,
        lineItems: {
          select: { assignments: { where: { partId, assembled: false }, select: { id: true } } }
        }
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }]
    })
  ]);

  const allocatedItems = allocatedRows.map((row) => ({
    createdAt: row.createdAt,
    item: {
      buildId: row.id,
      designName: row.designRevision.design.name,
      revisionNumber: row.designRevision.revisionNumber,
      targetQuantity: row.targetQuantity,
      state: row.state as BuildState,
      allocatedQty: row.lineItems.reduce(
        (sum, line) => sum + line.allocations.reduce((s, a) => s + a.quantity, 0),
        0
      ),
      reservedQty: 0
    } satisfies PartBuildAllocationItem
  }));

  const reservedItems = reservedRows.map((row) => ({
    createdAt: row.createdAt,
    item: {
      buildId: row.id,
      designName: row.designRevision.design.name,
      revisionNumber: row.designRevision.revisionNumber,
      targetQuantity: row.targetQuantity,
      state: row.state as BuildState,
      allocatedQty: 0,
      reservedQty: row.lineItems.reduce((sum, line) => sum + line.assignments.length, 0)
    } satisfies PartBuildAllocationItem
  }));

  return [...allocatedItems, ...reservedItems]
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .map((entry) => entry.item);
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
              part: {
                select: {
                  id: true,
                  catalogNumber: true,
                  currentStock: true,
                  reservedQty: true,
                  onOrderQty: true,
                  inProductionQty: true
                }
              },
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

  // Candidate parts + per-location balances are needed both while allocating (ALLOCATING) and
  // while assembling (STARTED/IN_PROGRESS), where a designator may be re-assigned to any matching
  // part.
  const showPickers =
    build.state === "ALLOCATING" || build.state === "STARTED" || build.state === "IN_PROGRESS";
  const candidatesByLine = showPickers
    ? await getMatchCandidatesForLines(
        workspaceId,
        build.lineItems
          .map((line) => line.sourceBomLineItemId)
          .filter((id): id is string => Boolean(id))
      )
    : new Map<string, BuildMatchCandidate[]>();

  // Per-part non-zero location balances, so a source-location picker can be narrowed to locations
  // that actually hold usable stock of the chosen part. Reservation-aware (refs #172): a location
  // another build already holds a hard reservation against at is excluded, since it isn't really
  // available for this build to plan against.
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
      const balances = await getPartLocationAvailableBalances({ workspaceId, partId });
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

  const allocationWarnings =
    build.state === "ALLOCATING"
      ? await getAllocationWarnings(workspaceId, build.lineItems, withPath)
      : [];

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
            onHandAvailableQuantity: a.part.currentStock.minus(a.part.reservedQty).toString(),
            incomingAvailableQuantity: a.part.onOrderQty.plus(a.part.inProductionQty).toString()
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
    }),
    allocationWarnings
  };
}

// --- Pick list ---

/**
 * A printable, location-grouped pick list for a build: how much of each part to physically gather
 * from each source location. Only available once the build is at least `ALLOCATING`; returns
 * `null` if the build doesn't exist / isn't in this workspace.
 *
 * - `ALLOCATING`: aggregates the current (possibly partial, possibly incoming-backed) allocation
 *   plan (`BuildLineAllocation`) — nothing has been assembled yet.
 * - `STARTED` / `IN_PROGRESS`: aggregates *all* per-unit assignment rows (`BuildDesignatorAssignment`),
 *   not just the unassembled ones, so the list keeps showing the full original need while flagging
 *   how much of it has already been picked/assembled (`assembledQuantity`).
 */
export async function getBuildPickList({
  userId,
  workspaceId,
  buildId
}: {
  userId: string;
  workspaceId: string;
  buildId: string;
}): Promise<BuildPickList | null> {
  await authorizeWorkspacePermission({ userId, workspaceId, permission: "builds:read" });

  const build = await prisma.build.findFirst({
    where: { id: buildId, workspaceId },
    select: {
      id: true,
      targetQuantity: true,
      state: true,
      designRevision: {
        select: {
          revisionNumber: true,
          design: { select: { name: true } }
        }
      },
      lineItems: {
        select: {
          categoryName: true,
          allocations: {
            select: {
              quantity: true,
              part: {
                select: {
                  id: true,
                  catalogNumber: true,
                  manufacturer: { select: { name: true } }
                }
              },
              sourceLocation: { select: { id: true, name: true } }
            }
          },
          assignments: {
            select: {
              assembled: true,
              part: {
                select: {
                  id: true,
                  catalogNumber: true,
                  manufacturer: { select: { name: true } }
                }
              },
              sourceLocation: { select: { id: true, name: true } }
            }
          }
        }
      }
    }
  });

  if (!build) return null;
  if (build.state !== "ALLOCATING" && build.state !== "STARTED" && build.state !== "IN_PROGRESS") {
    return null;
  }

  const rawLocations = await getStorageLocations(workspaceId);
  const locationPathsById = buildStorageLocationPaths(rawLocations);
  const pathFor = (location: { id: string; name: string } | null) =>
    location ? (locationPathsById.get(location.id) ?? location.name) : null;

  type Bucket = {
    locationId: string | null;
    locationPath: string;
    entriesByPart: Map<
      string,
      {
        partId: string;
        catalogNumber: string;
        manufacturerName: string;
        categoryName: string | null;
        totalQuantity: number;
        assembledQuantity: number;
      }
    >;
  };

  const buckets = new Map<string, Bucket>();
  const noLocationKey = "__no-location__";

  const addEntry = (
    part: { id: string; catalogNumber: string; manufacturer: { name: string } },
    location: { id: string; name: string } | null,
    quantity: number,
    assembled: boolean,
    categoryName: string | null
  ) => {
    const locationKey = location?.id ?? noLocationKey;
    let bucket = buckets.get(locationKey);
    if (!bucket) {
      bucket = {
        locationId: location?.id ?? null,
        locationPath: location ? (pathFor(location) ?? location.name) : "No location assigned",
        entriesByPart: new Map()
      };
      buckets.set(locationKey, bucket);
    }
    const existing = bucket.entriesByPart.get(part.id);
    if (existing) {
      existing.totalQuantity += quantity;
      if (assembled) existing.assembledQuantity += quantity;
    } else {
      bucket.entriesByPart.set(part.id, {
        partId: part.id,
        catalogNumber: part.catalogNumber,
        manufacturerName: part.manufacturer.name,
        categoryName,
        totalQuantity: quantity,
        assembledQuantity: assembled ? quantity : 0
      });
    }
  };

  if (build.state === "ALLOCATING") {
    for (const line of build.lineItems) {
      for (const allocation of line.allocations) {
        addEntry(allocation.part, allocation.sourceLocation, allocation.quantity, false, line.categoryName);
      }
    }
  } else {
    for (const line of build.lineItems) {
      for (const assignment of line.assignments) {
        if (!assignment.part) continue;
        addEntry(assignment.part, assignment.sourceLocation, 1, assignment.assembled, line.categoryName);
      }
    }
  }

  const groups: BuildPickListGroup[] = [...buckets.values()]
    .sort((a, b) => a.locationPath.localeCompare(b.locationPath))
    .map((bucket) => ({
      locationId: bucket.locationId,
      locationPath: bucket.locationPath,
      entries: [...bucket.entriesByPart.values()].sort((a, b) =>
        a.catalogNumber.localeCompare(b.catalogNumber)
      )
    }));

  return {
    id: build.id,
    designName: build.designRevision.design.name,
    revisionNumber: build.designRevision.revisionNumber,
    targetQuantity: build.targetQuantity,
    state: build.state as BuildState,
    groups
  };
}

// --- Assembly list ---

/**
 * A printable, unit-grouped assembly list for a build: for each physical unit, every designator's
 * assigned part and source location, in designator order — a print-friendly mirror of the build
 * detail view's unit grid. Only available once assignments exist (`STARTED`/`IN_PROGRESS`/
 * `COMPLETED`); returns `null` otherwise (or if the build doesn't exist / isn't in this workspace).
 * Already-assembled entries are kept (not dropped) and flagged, so the printed list always shows
 * the whole unit while reflecting current progress.
 */
export async function getBuildAssemblyList({
  userId,
  workspaceId,
  buildId
}: {
  userId: string;
  workspaceId: string;
  buildId: string;
}): Promise<BuildAssemblyList | null> {
  await authorizeWorkspacePermission({ userId, workspaceId, permission: "builds:read" });

  const build = await prisma.build.findFirst({
    where: { id: buildId, workspaceId },
    select: {
      id: true,
      targetQuantity: true,
      state: true,
      designRevision: {
        select: {
          revisionNumber: true,
          design: { select: { name: true } }
        }
      },
      lineItems: {
        select: {
          categoryName: true,
          assignments: {
            select: {
              id: true,
              designator: true,
              unitIndex: true,
              assembled: true,
              part: {
                select: {
                  id: true,
                  catalogNumber: true,
                  manufacturer: { select: { name: true } }
                }
              },
              sourceLocation: { select: { id: true, name: true } }
            }
          }
        }
      }
    }
  });

  if (!build) return null;
  if (build.state !== "STARTED" && build.state !== "IN_PROGRESS" && build.state !== "COMPLETED") {
    return null;
  }

  const rawLocations = await getStorageLocations(workspaceId);
  const locationPathsById = buildStorageLocationPaths(rawLocations);
  const withPath = (location: { id: string; name: string } | null): BuildLocationRef | null =>
    location ? { ...location, path: locationPathsById.get(location.id) ?? location.name } : null;

  const entriesByUnit = new Map<number, BuildAssemblyListEntry[]>();
  for (const line of build.lineItems) {
    for (const assignment of line.assignments) {
      const list = entriesByUnit.get(assignment.unitIndex) ?? [];
      list.push({
        assignmentId: assignment.id,
        designator: assignment.designator,
        categoryName: line.categoryName,
        part: assignment.part
          ? {
              id: assignment.part.id,
              catalogNumber: assignment.part.catalogNumber,
              manufacturerName: assignment.part.manufacturer.name
            }
          : null,
        sourceLocation: withPath(assignment.sourceLocation),
        assembled: assignment.assembled
      });
      entriesByUnit.set(assignment.unitIndex, list);
    }
  }

  const units: BuildAssemblyListUnit[] = [...entriesByUnit.entries()]
    .sort(([a], [b]) => a - b)
    .map(([unitIndex, entries]) => {
      const sortedEntries = [...entries].sort((a, b) =>
        a.designator.localeCompare(b.designator, "en", { numeric: true })
      );
      const assembledCount = sortedEntries.filter((e) => e.assembled).length;
      const status: BuildUnitStatus =
        assembledCount === 0
          ? "not_started"
          : assembledCount === sortedEntries.length
            ? "complete"
            : "in_progress";
      return { unitIndex, status, entries: sortedEntries };
    });

  return {
    id: build.id,
    designName: build.designRevision.design.name,
    revisionNumber: build.designRevision.revisionNumber,
    targetQuantity: build.targetQuantity,
    state: build.state as BuildState,
    units
  };
}

/**
 * Re-check an `ALLOCATING` build's on-hand-backed allocation entries against *current* stock,
 * mirroring `startBuild`'s hard guards (ADR 0021/0023) but read-only: part-level availability
 * (`currentStock − reservedQty`, aggregated across the build's own on-hand entries for that part)
 * and per-(part, source location) physical balance. Stock can move between allocation and start
 * (e.g. another build reserves the same part), so this surfaces the mismatch on the detail view
 * instead of only failing at `startBuild`. Incoming-backed entries (`sourceLocationId: null`,
 * ADR 0025/#185) are excluded from this check entirely: they were never expected to be covered by
 * `currentStock` in the first place, so falling short of it is normal, not drift.
 */
async function getAllocationWarnings(
  workspaceId: string,
  lineItems: {
    id: string;
    allocations: {
      quantity: number;
      part: { id: string; catalogNumber: string; currentStock: Prisma.Decimal; reservedQty: Prisma.Decimal };
      sourceLocation: { id: string; name: string } | null;
    }[];
  }[],
  withPath: (location: { id: string; name: string } | null) => BuildLocationRef | null
): Promise<BuildAllocationWarning[]> {
  // Only on-hand-backed entries (a real sourceLocation) are checked against currentStock/location
  // balances here: an incoming-backed entry (#185) never drew from currentStock in the first place,
  // so it never "drifts" the way an on-hand entry can — it's expected to fall short of currentStock
  // until the incoming stock actually lands, and that is not itself a warning-worthy condition.
  const transitionLines = lineItems.map((line) => ({
    id: line.id,
    designators: "",
    designatorCount: 0,
    allocations: line.allocations
      .filter((a) => a.sourceLocation)
      .map((a) => ({
        partId: a.part.id,
        sourceLocationId: a.sourceLocation?.id ?? null,
        quantity: a.quantity
      }))
  }));
  const requiredByPart = buildRequirements({ lines: transitionLines });
  const requiredByPartLocation = requirementsByPartLocation({ lines: transitionLines });

  const partById = new Map(lineItems.flatMap((line) => line.allocations.map((a) => [a.part.id, a.part])));

  const shortPartIds = new Set<string>();
  for (const [partId, required] of requiredByPart) {
    const part = partById.get(partId);
    if (!part) continue;
    const available = new Prisma.Decimal(part.currentStock).minus(part.reservedQty);
    if (available.lessThan(required)) shortPartIds.add(partId);
  }

  const shortLocationKeys = new Set<string>();
  const balancesByPart = new Map<string, Awaited<ReturnType<typeof getPartLocationBalances>>>();
  for (const [key, required] of requiredByPartLocation) {
    const { partId, locationId } = splitPartLocationKey(key);
    let balances = balancesByPart.get(partId);
    if (!balances) {
      balances = await getPartLocationBalances({ workspaceId, partId });
      balancesByPart.set(partId, balances);
    }
    const balance = balances.get(locationId) ?? new Prisma.Decimal(0);
    if (balance.lessThan(required)) shortLocationKeys.add(key);
  }

  const warnings: BuildAllocationWarning[] = [];
  for (const line of lineItems) {
    for (const allocation of line.allocations) {
      const insufficientPart = shortPartIds.has(allocation.part.id);
      const insufficientLocation = allocation.sourceLocation
        ? shortLocationKeys.has(partLocationKey(allocation.part.id, allocation.sourceLocation.id))
        : false;
      if (!insufficientPart && !insufficientLocation) continue;
      warnings.push({
        lineItemId: line.id,
        partId: allocation.part.id,
        partCatalogNumber: allocation.part.catalogNumber,
        sourceLocation: withPath(allocation.sourceLocation),
        requiredQuantity: allocation.quantity,
        reason: insufficientPart ? "insufficient-available-stock" : "insufficient-location-stock"
      });
    }
  }
  return warnings;
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
      select: {
        id: true,
        currentStock: true,
        reservedQty: true,
        onOrderQty: true,
        inProductionQty: true
      }
    });
    const onHandById = new Map(
      availability.map((p) => [p.id, p.currentStock.minus(p.reservedQty).toString()])
    );
    const incomingById = new Map(
      availability.map((p) => [p.id, p.onOrderQty.plus(p.inProductionQty).toString()])
    );

    result.set(
      lineId,
      matches.map((m) => ({
        id: m.id,
        catalogNumber: m.catalogNumber,
        description: m.description,
        manufacturerName: m.manufacturerName,
        onHandAvailableQuantity: onHandById.get(m.id) ?? "0",
        incomingAvailableQuantity: incomingById.get(m.id) ?? "0"
      }))
    );
  }

  return result;
}

/** Running tally of stock a build's pre-fill has already claimed, so later lines don't double-book. */
type SuggestionUsage = { byLocation: Map<string, number> };

/** Sentinel "location" key for incoming stock (onOrderQty/inProductionQty, #185) in `SuggestionUsage`. */
const INCOMING_USAGE_KEY = "__incoming__";

/**
 * Greedily pre-fill a line's allocation from stock, **net of what the build's earlier lines already
 * claimed** (`used`). A pinned line draws only from its pinned part; an unpinned line draws from its
 * matching parts, in order. Either way, physically on-hand locations are tried first (best-stocked
 * first, split across several locations/parts as needed via {@link suggestAllocation}, which caps
 * each entry to that location's actual remaining balance); if the requirement is still short after
 * on-hand stock runs out, the remainder falls back to a location-less entry against incoming stock
 * (onOrderQty + inProductionQty, #185) for the pinned part (or the first match), leaving a partial
 * suggestion only if even that isn't enough. The returned entries are folded back into `used` by the
 * caller.
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

  const matchIds = spec.pinnedPartId
    ? [spec.pinnedPartId]
    : (await findMatchingParts({ workspaceId, spec })).map((m) => m.id);

  const candidates: AllocationCandidate[] = [];
  for (const partId of matchIds) {
    const balances = await getPartLocationAvailableBalances({ workspaceId, partId });
    const locations = [...balances.entries()]
      .map(([locationId, balance]) => ({ locationId, remaining: remainingAt(partId, locationId, balance) }))
      .filter((l) => l.remaining > 0)
      .sort((a, b) => b.remaining - a.remaining);
    for (const location of locations) {
      candidates.push({ partId, sourceLocationId: location.locationId, available: location.remaining });
    }
  }

  const suggestion = suggestAllocation(required, candidates);

  const stillNeeded = required - sumEntries(suggestion);
  const incomingPartId = matchIds[0];
  if (stillNeeded > 0 && incomingPartId) {
    const part = await prisma.part.findFirst({
      where: { id: incomingPartId, workspaceId },
      select: { onOrderQty: true, inProductionQty: true }
    });
    const incomingKey = partLocationKey(incomingPartId, INCOMING_USAGE_KEY);
    const incomingAvailable = part
      ? Math.floor(Number(part.onOrderQty.plus(part.inProductionQty))) - (used.byLocation.get(incomingKey) ?? 0)
      : 0;
    if (incomingAvailable > 0) {
      suggestion.push({
        partId: incomingPartId,
        sourceLocationId: null,
        quantity: Math.min(stillNeeded, incomingAvailable)
      });
    }
  }

  return suggestion;
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
      const key = entry.sourceLocationId
        ? partLocationKey(entry.partId, entry.sourceLocationId)
        : partLocationKey(entry.partId, INCOMING_USAGE_KEY);
      usage.byLocation.set(key, (usage.byLocation.get(key) ?? 0) + entry.quantity);
    }
    plan.push({ line, designatorCount: parsed.quantity, suggestion });
  }

  // The build is live from creation: the design's output part immediately counts the run toward
  // `plannedQty`, and any greedily pre-filled entries immediately count toward `Part.allocatedQty`
  // (ADR 0025) — there is no separate "allocate" step to defer this to anymore.
  const allocatedByPart = new Map<string, number>();
  for (const { suggestion } of plan) {
    for (const entry of suggestion) {
      allocatedByPart.set(entry.partId, (allocatedByPart.get(entry.partId) ?? 0) + entry.quantity);
    }
  }

  const build = await prisma.$transaction(async (tx) => {
    const created = await tx.build.create({
      data: {
        workspaceId,
        designRevisionId,
        targetQuantity,
        outputLocationId: outputLocationId ?? null,
        createdByUserId: createdByUserId ?? null,
        state: "ALLOCATING"
      },
      select: { id: true, designRevision: { select: { design: { select: { outputPartId: true } } } } }
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

    if (allocatedByPart.size > 0) {
      await lockParts(tx, workspaceId, [...allocatedByPart.keys()]);
      for (const [partId, quantity] of allocatedByPart) {
        await tx.part.update({ where: { id: partId }, data: { allocatedQty: { increment: quantity } } });
      }
    }
    await lockParts(tx, workspaceId, [created.designRevision.design.outputPartId]);
    await tx.part.update({
      where: { id: created.designRevision.design.outputPartId },
      data: { plannedQty: { increment: targetQuantity } }
    });

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
    select: {
      id: true,
      state: true,
      targetQuantity: true,
      designRevision: { select: { design: { select: { outputPartId: true } } } },
      lineItems: { select: { allocations: { select: { partId: true, quantity: true } } } }
    }
  });
  if (!build) return { ok: false, error: "build-not-found" };

  if (build.state !== "ALLOCATING" && build.state !== "CANCELLED") {
    return { ok: false, error: "build-not-deletable" };
  }

  // An ALLOCATING build holds live allocatedQty/plannedQty (ADR 0025) from the moment it's created,
  // so deleting it must release those the same way cancelling would. A CANCELLED build already
  // released its holds when it was cancelled.
  if (build.state === "ALLOCATING") {
    const requiredByPart = aggregateRequirementsByPart(
      build.lineItems.flatMap((line) =>
        line.allocations.map((a) => ({ partId: a.partId, required: a.quantity }))
      )
    );
    await prisma.$transaction(async (tx) => {
      if (requiredByPart.size > 0) {
        await lockParts(tx, workspaceId, [...requiredByPart.keys()]);
        for (const [partId, amount] of requiredByPart) {
          await tx.part.update({ where: { id: partId }, data: { allocatedQty: { decrement: amount } } });
        }
      }
      await lockParts(tx, workspaceId, [build.designRevision.design.outputPartId]);
      await tx.part.update({
        where: { id: build.designRevision.design.outputPartId },
        data: { plannedQty: { decrement: build.targetQuantity } }
      });
      await tx.build.delete({ where: { id: buildId } });
    });
    return { ok: true, data: null };
  }

  await prisma.build.delete({ where: { id: buildId } });
  return { ok: true, data: null };
}

// --- Mutations: allocation ---

/**
 * Replace the split allocation of one build line: a set of {part, source location, quantity}
 * entries. Only permitted while the build is `ALLOCATING`; edits apply immediately (ADR 0025) —
 * there is no separate "allocate"/"reopen" step. Partial totals are allowed while editing — the
 * "fully allocated" guard is enforced at `startBuild`. An entry with no `sourceLocationId` is a
 * plan against incoming stock (`onOrderQty`/`inProductionQty`), which has no location yet; such an
 * entry always keeps the line (and therefore the build) from being start-ready.
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
  if (line.build.state !== "ALLOCATING") return { ok: false, error: "build-not-editable" };

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

  // Stock guard: never allocate more of a part than is available — on hand (currentStock −
  // reservedQty) plus incoming (onOrderQty + inProductionQty, #185) — nor more at a (part,
  // location) than that location physically holds (incoming stock has no location, so it never
  // enters the per-location check below). The build holds no hard reservation of its own yet —
  // availability is otherwise-committed/incoming stock.
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
    select: {
      id: true,
      currentStock: true,
      reservedQty: true,
      onOrderQty: true,
      inProductionQty: true
    }
  });
  const availableById = new Map(
    parts.map((p) => [
      p.id,
      p.currentStock.minus(p.reservedQty).plus(p.onOrderQty).plus(p.inProductionQty)
    ])
  );
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

  // Live allocatedQty maintenance (ADR 0025): diff this line's previously-persisted entries
  // against the new ones and apply the per-part delta, instead of deferring to a bulk "allocate".
  const oldEntries = await prisma.buildLineAllocation.findMany({
    where: { buildLineItemId },
    select: { partId: true, quantity: true }
  });
  const oldPerPart = new Map<string, number>();
  for (const e of oldEntries) oldPerPart.set(e.partId, (oldPerPart.get(e.partId) ?? 0) + e.quantity);
  const deltaByPart = new Map<string, number>();
  for (const partId of new Set([...perPart.keys(), ...oldPerPart.keys()])) {
    const delta = (perPart.get(partId) ?? 0) - (oldPerPart.get(partId) ?? 0);
    if (delta !== 0) deltaByPart.set(partId, delta);
  }

  await prisma.$transaction(async (tx) => {
    if (deltaByPart.size > 0) {
      await lockParts(tx, workspaceId, [...deltaByPart.keys()]);
      for (const [partId, delta] of deltaByPart) {
        await tx.part.update({ where: { id: partId }, data: { allocatedQty: { increment: delta } } });
      }
    }
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
 * Partial totals per line are allowed (completeness is enforced later at `startBuild`); only the
 * aggregate stock guards apply. Only permitted while the build is `ALLOCATING`; edits apply
 * immediately (ADR 0025) — there is no separate "allocate"/"reopen" step.
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
    select: {
      id: true,
      state: true,
      lineItems: { select: { id: true, allocations: { select: { partId: true, quantity: true } } } }
    }
  });
  if (!build) return { ok: false, error: "build-not-found" };
  if (build.state !== "ALLOCATING") return { ok: false, error: "build-not-editable" };

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
    select: {
      id: true,
      currentStock: true,
      reservedQty: true,
      onOrderQty: true,
      inProductionQty: true
    }
  });
  const availableById = new Map(
    parts.map((p) => [
      p.id,
      p.currentStock.minus(p.reservedQty).plus(p.onOrderQty).plus(p.inProductionQty)
    ])
  );
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

  // Live allocatedQty maintenance (ADR 0025): diff the build's previously-persisted entries
  // (across all lines) against the new aggregate and apply the per-part delta.
  const oldPerPart = new Map<string, number>();
  for (const l of build.lineItems) {
    for (const a of l.allocations) oldPerPart.set(a.partId, (oldPerPart.get(a.partId) ?? 0) + a.quantity);
  }
  const deltaByPart = new Map<string, number>();
  for (const partId of new Set([...perPart.keys(), ...oldPerPart.keys()])) {
    const delta = (perPart.get(partId) ?? 0) - (oldPerPart.get(partId) ?? 0);
    if (delta !== 0) deltaByPart.set(partId, delta);
  }

  await prisma.$transaction(async (tx) => {
    if (deltaByPart.size > 0) {
      await lockParts(tx, workspaceId, [...deltaByPart.keys()]);
      for (const [partId, delta] of deltaByPart) {
        await tx.part.update({ where: { id: partId }, data: { allocatedQty: { increment: delta } } });
      }
    }
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

/**
 * `ALLOCATING → STARTED`: hard-reserve stock and distribute the allocation down to per-designator,
 * per-part assignment rows. Guards part-level availability (`currentStock − reservedQty` — real
 * on-hand stock only, incoming stock does not count here) and each (part, source-location)
 * balance, then moves the soft allocation into a hard reservation.
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
  if (build.state !== "ALLOCATING") return { ok: false, error: "invalid-build-transition" };
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

      // The output part isn't necessarily among the consumed parts above, so lock/update it
      // separately: its targetQuantity moves from planned (soft, since ALLOCATED) to in-production.
      await lockParts(tx, workspaceId, [build.outputPartId]);
      await tx.part.update({
        where: { id: build.outputPartId },
        data: {
          plannedQty: { decrement: build.targetQuantity },
          inProductionQty: { increment: build.targetQuantity }
        }
      });

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
  // Output part row is already locked by createInventoryEntryWithinTx above; this build no longer
  // counts toward "in production" now that its full targetQuantity has been received.
  await tx.part.update({
    where: { id: build.designRevision.design.outputPartId },
    data: { inProductionQty: { decrement: build.targetQuantity } }
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
      targetQuantity: true,
      designRevision: { select: { design: { select: { outputPartId: true } } } },
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

  const releasesInProduction = build.state === "STARTED" || build.state === "IN_PROGRESS";
  const releasesPlanned = build.state === "ALLOCATING";

  // What remains reserved/allocated depends on the phase: before start the hold lives on the
  // allocation entries (`allocatedQty`, live since creation per ADR 0025); once started it lives
  // on the un-assembled portion of the per-designator rows (`reservedQty`).
  const releaseField = releasesPlanned ? "allocatedQty" : "reservedQty";

  const remainingByPart = releasesPlanned
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
    await lockParts(tx, workspaceId, [...remainingByPart.keys()]);
    for (const [partId, amount] of remainingByPart) {
      if (amount === 0) continue;
      await tx.part.update({
        where: { id: partId },
        data: { [releaseField]: { decrement: amount } }
      });
    }
    if (releasesInProduction || releasesPlanned) {
      // The output part may not be among the consumed parts above, so lock/update it separately.
      await lockParts(tx, workspaceId, [build.designRevision.design.outputPartId]);
      await tx.part.update({
        where: { id: build.designRevision.design.outputPartId },
        data: releasesInProduction
          ? { inProductionQty: { decrement: build.targetQuantity } }
          : { plannedQty: { decrement: build.targetQuantity } }
      });
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
  outputPartId: string;
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
      designRevision: { select: { design: { select: { outputPartId: true } } } },
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
    outputPartId: build.designRevision.design.outputPartId,
    lines: build.lineItems
  };
}

/** A line is fully allocated when its entries cover the requirement and each has a source location. */
function isFullyAllocated(build: Pick<BuildForTransition, "targetQuantity" | "lines">): boolean {
  return build.lines.every((line) => {
    const required = requiredUnits(line.designatorCount, build.targetQuantity);
    if (required === 0) return true;
    if (line.allocations.length === 0) return false;
    if (line.allocations.some((a) => !a.sourceLocationId)) return false;
    return sumEntries(line.allocations) === required;
  });
}

/** Per-part required quantity across all allocation entries. */
function buildRequirements(build: Pick<BuildForTransition, "lines">): Map<string, number> {
  return aggregateRequirementsByPart(
    build.lines.flatMap((line) =>
      line.allocations.map((a) => ({ partId: a.partId, required: a.quantity }))
    )
  );
}

/** Per-(part, location) required quantity across all allocation entries with a source location. */
function requirementsByPartLocation(build: Pick<BuildForTransition, "lines">): Map<string, number> {
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
