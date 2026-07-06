/**
 * Pure build state-machine helpers. No database or server-only imports, so these can be unit
 * tested in isolation (`tests/unit`). The mutating transitions in `builds.ts` use these guards
 * and own the stock side-effects.
 */

export type BuildState = "ALLOCATING" | "STARTED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";

/** States from which a build may be cancelled (released). */
export function isCancellable(state: BuildState): boolean {
  return state === "ALLOCATING" || state === "STARTED" || state === "IN_PROGRESS";
}

export function isTerminal(state: BuildState): boolean {
  return state === "COMPLETED" || state === "CANCELLED";
}

/** Parts required at a single BOM line = (count of its designators) × build target quantity. */
export function requiredForLine(designatorCount: number, targetQuantity: number): number {
  return designatorCount * targetQuantity;
}

/**
 * Sum per-line requirements into per-part totals. Lines without an assigned part are ignored
 * (they are caught earlier by the "fully allocated" guard).
 */
export function aggregateRequirementsByPart(
  lines: { partId: string | null; required: number }[]
): Map<string, number> {
  const byPart = new Map<string, number>();
  for (const line of lines) {
    if (!line.partId) continue;
    byPart.set(line.partId, (byPart.get(line.partId) ?? 0) + line.required);
  }
  return byPart;
}
