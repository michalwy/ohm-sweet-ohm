// Pure helpers for the expansion state of a tree list (`src/app/tree-list.tsx`).

/** Returns a new set with `id` added when absent and removed when present. */
export function toggleExpandedId(expandedIds: ReadonlySet<string>, id: string): Set<string> {
  const nextIds = new Set(expandedIds);

  if (nextIds.has(id)) {
    nextIds.delete(id);
  } else {
    nextIds.add(id);
  }

  return nextIds;
}

/**
 * Parses expanded ids persisted as a JSON array of strings. Anything else — nothing stored,
 * invalid JSON, a non-array — falls back to `fallbackIds`; non-string entries are dropped.
 */
export function parseStoredExpandedIds(
  storedValue: string | null,
  fallbackIds: Set<string>
): Set<string> {
  if (!storedValue) {
    return fallbackIds;
  }

  try {
    const parsedValue: unknown = JSON.parse(storedValue);

    if (!Array.isArray(parsedValue)) {
      return fallbackIds;
    }

    return new Set(parsedValue.filter((id): id is string => typeof id === "string"));
  } catch {
    return fallbackIds;
  }
}

export function serializeExpandedIds(expandedIds: ReadonlySet<string>): string {
  return JSON.stringify(Array.from(expandedIds));
}
