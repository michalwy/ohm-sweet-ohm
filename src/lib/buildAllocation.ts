/**
 * Split-allocation logic for builds: distributing a BOM line's required units across multiple
 * parts (each with its own source location and quantity) and suggesting an initial split.
 *
 * A line's requirement is `designatorCount × targetQuantity` units. Those units may be split
 * across several parts (e.g. 20 Yageo + 30 Royal Ohm). The split is expressed as a list of
 * {@link AllocationEntry}. For the assembly list the entries are distributed down to individual
 * designators — and because the split is per-unit, a single designator may draw from more than
 * one part when `targetQuantity > 1`.
 *
 * Pure logic only — no server, prisma, or i18n imports, so it is unit-testable in isolation.
 * Error messages are internal codes (hyphenated) surfaced through action error handling, matching
 * the convention in `src/lib/designators.ts`.
 */

/** One part entry in a line's split allocation. */
export type AllocationEntry = {
  partId: string;
  sourceLocationId: string | null;
  quantity: number;
};

/** A distributed unit of one part at one designator for one physical unit (the assembly grain). */
export type DesignatorPartRow = {
  designator: string;
  unitIndex: number;
  partId: string;
  sourceLocationId: string | null;
};

/** A candidate part+location the greedy suggestion can draw from, best-first. */
export type AllocationCandidate = {
  partId: string;
  sourceLocationId: string | null;
  available: number;
};

/** Total units across all entries. */
export function sumEntries(entries: AllocationEntry[]): number {
  return entries.reduce((total, entry) => total + entry.quantity, 0);
}

/** Units required for a line = (count of its designators) × build target quantity. */
export function requiredUnits(designatorCount: number, targetQuantity: number): number {
  return designatorCount * targetQuantity;
}

/**
 * Validate a line's split allocation.
 *
 * @throws Error with code `invalid-allocation-quantity` when any entry quantity is not a positive
 * integer, and `allocation-total-mismatch` when the entries' total does not equal
 * `designators.length × targetQuantity`.
 */
export function validateAllocation(
  entries: AllocationEntry[],
  designators: string[],
  targetQuantity: number
): void {
  for (const entry of entries) {
    if (!Number.isInteger(entry.quantity) || entry.quantity < 1) {
      throw new Error("invalid-allocation-quantity");
    }
  }
  if (sumEntries(entries) !== requiredUnits(designators.length, targetQuantity)) {
    throw new Error("allocation-total-mismatch");
  }
}

/**
 * Distribute a validated split allocation down to per-designator, per-unit rows. Designators are
 * filled in order; for each designator, units 1..targetQuantity are drawn one at a time from the
 * entries in order (so a per-unit split may assign different parts to different unit indices of
 * the same designator).
 *
 * @throws the same codes as {@link validateAllocation}.
 */
export function distributeAllocations(
  designators: string[],
  targetQuantity: number,
  entries: AllocationEntry[]
): DesignatorPartRow[] {
  validateAllocation(entries, designators, targetQuantity);

  const rows: DesignatorPartRow[] = [];
  let entryIndex = 0;
  let remainingInEntry = entries.length > 0 ? entries[0].quantity : 0;

  for (const designator of designators) {
    for (let unitIndex = 1; unitIndex <= targetQuantity; unitIndex += 1) {
      // Skip over any exhausted entries.
      while (entryIndex < entries.length && remainingInEntry === 0) {
        entryIndex += 1;
        remainingInEntry = entryIndex < entries.length ? entries[entryIndex].quantity : 0;
      }
      const entry = entries[entryIndex];
      rows.push({
        designator,
        unitIndex,
        partId: entry.partId,
        sourceLocationId: entry.sourceLocationId
      });
      remainingInEntry -= 1;
    }
  }

  return rows;
}

/**
 * Greedily suggest an initial split covering `required` units from the given candidates, taking
 * from each best-first candidate until the requirement is met. Candidates with no available stock
 * are skipped. If total availability is short, the returned entries cover fewer than `required`
 * units (the UI surfaces the gap); if `required` is 0 or there are no candidates, returns `[]`.
 */
export function suggestAllocation(
  required: number,
  candidates: AllocationCandidate[]
): AllocationEntry[] {
  const entries: AllocationEntry[] = [];
  let remaining = required;

  for (const candidate of candidates) {
    if (remaining <= 0) break;
    if (candidate.available <= 0) continue;
    const take = Math.min(remaining, candidate.available);
    entries.push({
      partId: candidate.partId,
      sourceLocationId: candidate.sourceLocationId,
      quantity: take
    });
    remaining -= take;
  }

  return entries;
}
