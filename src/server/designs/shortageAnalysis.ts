import "server-only";

import { authorizeWorkspacePermission } from "@/server/access-control/authorize";
import { prisma } from "@/server/db/prisma";

import { findMatchingParts, type MatchSpec } from "./matching";

/**
 * Shortage analysis explodes a Design revision's BOM against current stock for a target
 * build quantity and reports what cannot be fulfilled.
 *
 * Semantics (see docs/decisions ADR on shortage analysis):
 * - Availability of a part = `currentStock - reservedQty` (allocated does not reduce it).
 * - A BOM line's available quantity aggregates the available stock of ALL parts matching
 *   its spec; the line is short only if the combined pool cannot cover the requirement.
 * - Stock is a single shared pool consumed as the tree is walked, so a part used by several
 *   lines (or sub-designs) competes for one pool ("net once").
 * - When a matched part is itself the output part of another Design, its own stock is netted
 *   first and the still-unmet remainder explodes into that Design's LATEST revision.
 * - Cycles (a design that transitively requires itself) are reported, never looped.
 */

export type LineShortageMatcherFilter = {
  attributeId: string;
  type: "TEXT" | "NUMBER" | "QUANTITY" | "BOOLEAN" | "CHOICE";
  operator: "EQ" | "NEQ" | "LT" | "LTE" | "GT" | "GTE";
  /** Formatted display value as stored in BomMatcher.displayValue (e.g. "10kΩ", "SMD"). Used for QUANTITY and TEXT. */
  displayValue: string | null;
  /** Parsed decimal string from BomMatcher.numberValue. Used for NUMBER type to build filter URL params. */
  numberValue: string | null;
  /** Only set for BOOLEAN matchers. */
  booleanValue: boolean | null;
  /** Only set for CHOICE matchers. */
  choiceOptionId: string | null;
};

export type LineShortage = {
  lineItemId: string;
  designators: string;
  categoryName: string | null;
  requiredQty: number;
  availableQty: number;
  gapQty: number;
  matchCount: number;
  /** Design name when the shortage remainder is resolved by building this sub-assembly, else null. */
  sourcingDesignName: string | null;
  /** Design id when the shortage remainder is resolved by building this sub-assembly, else null. */
  sourcingDesignId: string | null;
  /** Latest revision id of the sourcing design, or null if the design has no revision yet. */
  sourcingLatestRevisionId: string | null;
  /** Pinned part id, if this line is pinned to a specific part. Used to navigate to that part's detail directly. */
  pinnedPartId: string | null;
  /** Category id for building a categoryId filter URL param. Null if the line has no category scope. */
  categoryId: string | null;
  /** Serialized matcher data for building attr_<id>=<value> filter URL params. */
  matchers: LineShortageMatcherFilter[];
};

export type ProcurementCandidate = {
  partId: string;
  catalogNumber: string;
  manufacturerName: string;
};

export type ProcurementItem = {
  partId: string;
  catalogNumber: string;
  manufacturerName: string;
  shortageQty: number;
  /**
   * Other leaf (purchasable) parts that also matched the spec(s) sourcing this shortage,
   * unioned across every BOM line/recursion that contributed to it. Sub-assembly output
   * parts are excluded — substitution is offered only among parts that can actually be
   * bought, not built. Always includes `partId` itself. Used only for shopping-list
   * substitution at read time; never affects `partId`/`shortageQty` above.
   */
  candidates: ProcurementCandidate[];
};

export type CycleReport = {
  /** Design names forming the cycle, in traversal order, ending with the repeated design. */
  path: string[];
};

export type ShortageAnalysis = {
  lines: LineShortage[];
  procurement: ProcurementItem[];
  cycles: CycleReport[];
  /** True when all lines are covered but at least one relies on incoming stock (on order or in production, not yet on hand). */
  requiresIncoming: boolean;
};

type OutputDesign = {
  designId: string;
  designName: string;
  latestRevisionId: string | null;
};

type MatcherRow = {
  attributeId: string;
  operator: MatchSpec["matchers"][number]["operator"];
  textValue: string | null;
  numberValue: { toString(): string } | null;
  quantityBaseValue: { toString(): string } | null;
  booleanValue: boolean | null;
  choiceOptionId: string | null;
  displayValue: string | null;
  attribute: { type: MatchSpec["matchers"][number]["type"] };
};

function toMatchSpec(row: {
  pinnedPartId: string | null;
  categoryId: string | null;
  matchers: MatcherRow[];
}): MatchSpec {
  return {
    pinnedPartId: row.pinnedPartId,
    categoryId: row.categoryId,
    matchers: row.matchers.map((matcher) => ({
      attributeId: matcher.attributeId,
      type: matcher.attribute.type,
      operator: matcher.operator,
      textValue: matcher.textValue,
      numberValue: matcher.numberValue?.toString() ?? null,
      quantityBaseValue: matcher.quantityBaseValue?.toString() ?? null,
      booleanValue: matcher.booleanValue,
      choiceOptionId: matcher.choiceOptionId
    }))
  };
}

export async function analyzeShortage({
  userId,
  workspaceId,
  revisionId,
  targetQuantity
}: {
  userId: string;
  workspaceId: string;
  revisionId: string;
  targetQuantity: number;
}): Promise<ShortageAnalysis> {
  await authorizeWorkspacePermission({ userId, workspaceId, permission: "designs:read" });

  if (!Number.isInteger(targetQuantity) || targetQuantity < 1) {
    throw new Error("invalid-target-quantity");
  }

  const revision = await prisma.designRevision.findFirst({
    where: { id: revisionId, workspaceId },
    select: { id: true, design: { select: { id: true, name: true } } }
  });
  if (!revision) throw new Error("revision-not-found");

  // Map each Design output part to its design + latest revision so matched parts that are
  // themselves assembled products can be exploded recursively.
  const designs = await prisma.design.findMany({
    where: { workspaceId },
    select: {
      id: true,
      name: true,
      outputPartId: true,
      revisions: {
        orderBy: { revisionNumber: "desc" },
        take: 1,
        select: { id: true }
      }
    }
  });
  const outputDesignByPartId = new Map<string, OutputDesign>();
  for (const design of designs) {
    outputDesignByPartId.set(design.outputPartId, {
      designId: design.id,
      designName: design.name,
      latestRevisionId: design.revisions[0]?.id ?? null
    });
  }

  // Shared availability pools, lazily seeded per part.
  // `pool` includes in-production stock; `onHandPool` is on-hand only (currentStock - reservedQty).
  const pool = new Map<string, number>();
  const onHandPool = new Map<string, number>();
  async function ensurePool(partIds: string[]): Promise<void> {
    const missing = partIds.filter((id) => !pool.has(id));
    if (missing.length === 0) return;
    const parts = await prisma.part.findMany({
      where: { workspaceId, id: { in: missing } },
      select: { id: true, currentStock: true, reservedQty: true, inProductionQty: true, onOrderQty: true }
    });
    const found = new Set<string>();
    for (const part of parts) {
      const onHand = Number(part.currentStock) - Number(part.reservedQty);
      onHandPool.set(part.id, onHand);
      pool.set(part.id, onHand + Number(part.inProductionQty) + Number(part.onOrderQty));
      found.add(part.id);
    }
    // A pinned part that no longer exists still counts as zero available.
    for (const id of missing) {
      if (!found.has(id)) {
        pool.set(id, 0);
        onHandPool.set(id, 0);
      }
    }
  }

  let incomingConsumed = 0;

  const lines: LineShortage[] = [];
  const procurement = new Map<string, ProcurementItem>();
  const cycles: CycleReport[] = [];

  async function explode(
    currentRevisionId: string,
    multiplier: number,
    isRoot: boolean,
    visited: Set<string>,
    visitedPath: string[]
  ): Promise<void> {
    const rows = await prisma.bomLineItem.findMany({
      where: { revisionId: currentRevisionId, workspaceId },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      select: {
        id: true,
        designators: true,
        quantity: true,
        pinnedPartId: true,
        category: { select: { id: true, name: true } },
        matchers: {
          select: {
            attributeId: true,
            operator: true,
            textValue: true,
            numberValue: true,
            quantityBaseValue: true,
            booleanValue: true,
            choiceOptionId: true,
            displayValue: true,
            attribute: { select: { type: true } }
          }
        }
      }
    });

    for (const row of rows) {
      const required = row.quantity * multiplier;
      const candidates = await findMatchingParts({
        workspaceId,
        spec: toMatchSpec({
          pinnedPartId: row.pinnedPartId,
          categoryId: row.category?.id ?? null,
          matchers: row.matchers
        })
      });

      await ensurePool(candidates.map((candidate) => candidate.id));

      // Consume shared available stock across all matching parts in a deterministic order
      // (findMatchingParts returns candidates by catalogNumber asc), netting each part's
      // own stock — including a sub-design output part's stock — before any sourcing.
      // Also drain the on-hand-only pool in parallel to detect reliance on in-production stock.
      let remaining = required;
      for (const candidate of candidates) {
        if (remaining <= 0) break;
        const available = pool.get(candidate.id) ?? 0;
        const take = Math.min(available, remaining);
        if (take > 0) {
          const onHandAvailable = onHandPool.get(candidate.id) ?? 0;
          const fromOnHand = Math.min(take, onHandAvailable);
          incomingConsumed += take - fromOnHand;
          pool.set(candidate.id, available - take);
          onHandPool.set(candidate.id, onHandAvailable - fromOnHand);
          remaining -= take;
        }
      }

      if (isRoot) {
        // Determine sourcing design for the badge before pushing line data.
        const firstCandidate = candidates[0];
        const sourcingDesign =
          remaining > 0 && firstCandidate
            ? (outputDesignByPartId.get(firstCandidate.id) ?? null)
            : null;
        lines.push({
          lineItemId: row.id,
          designators: row.designators,
          categoryName: row.category?.name ?? null,
          requiredQty: required,
          availableQty: required - remaining,
          gapQty: Math.max(remaining, 0),
          matchCount: candidates.length,
          sourcingDesignName: sourcingDesign?.designName ?? null,
          sourcingDesignId: sourcingDesign?.designId ?? null,
          sourcingLatestRevisionId: sourcingDesign?.latestRevisionId ?? null,
          pinnedPartId: row.pinnedPartId,
          categoryId: row.category?.id ?? null,
          matchers: row.matchers.map((m) => ({
            attributeId: m.attributeId,
            type: m.attribute.type as LineShortageMatcherFilter["type"],
            operator: m.operator as LineShortageMatcherFilter["operator"],
            displayValue: m.displayValue ?? null,
            numberValue: m.numberValue?.toString() ?? null,
            booleanValue: m.booleanValue ?? null,
            choiceOptionId: m.choiceOptionId ?? null
          }))
        });
      }

      if (remaining <= 0 || candidates.length === 0) continue;

      // Source the still-unmet remainder from the first candidate deterministically: build it
      // when it is a sub-design output part, otherwise treat it as a leaf part to purchase.
      const sourcing = candidates[0];
      const sourcingDesign = outputDesignByPartId.get(sourcing.id);

      if (sourcingDesign) {
        if (visited.has(sourcingDesign.designId)) {
          cycles.push({ path: [...visitedPath, sourcingDesign.designName] });
          continue;
        }
        if (!sourcingDesign.latestRevisionId) {
          // Design has no revision yet: nothing to explode, cannot resolve further.
          continue;
        }
        await explode(
          sourcingDesign.latestRevisionId,
          remaining,
          false,
          new Set(visited).add(sourcingDesign.designId),
          [...visitedPath, sourcingDesign.designName]
        );
        continue;
      }

      const leafCandidates: ProcurementCandidate[] = candidates
        .filter((candidate) => !outputDesignByPartId.has(candidate.id))
        .map((candidate) => ({
          partId: candidate.id,
          catalogNumber: candidate.catalogNumber,
          manufacturerName: candidate.manufacturerName
        }));

      const existing = procurement.get(sourcing.id);
      if (existing) {
        existing.shortageQty += remaining;
        for (const candidate of leafCandidates) {
          if (!existing.candidates.some((c) => c.partId === candidate.partId)) {
            existing.candidates.push(candidate);
          }
        }
      } else {
        procurement.set(sourcing.id, {
          partId: sourcing.id,
          catalogNumber: sourcing.catalogNumber,
          manufacturerName: sourcing.manufacturerName,
          shortageQty: remaining,
          candidates: leafCandidates
        });
      }
    }
  }

  await explode(
    revision.id,
    targetQuantity,
    true,
    new Set<string>([revision.design.id]),
    [revision.design.name]
  );

  return {
    lines,
    procurement: [...procurement.values()]
      .map((item) => ({
        ...item,
        candidates: [...item.candidates].sort((a, b) =>
          a.catalogNumber.localeCompare(b.catalogNumber)
        )
      }))
      .sort((a, b) => a.catalogNumber.localeCompare(b.catalogNumber)),
    cycles,
    requiresIncoming: incomingConsumed > 0
  };
}
