// Serialization and type definitions for date range filter values.
// The serialized format is URL-safe and stored as a single string in filter state.
//
// Format:
//   from only:  "after:<YYYY-MM-DD>"              e.g. "after:2025-01-15"
//   to only:    "before:<YYYY-MM-DD>"             e.g. "before:2025-03-31"
//   both:       "between:<YYYY-MM-DD>:<YYYY-MM-DD>" e.g. "between:2025-01-15:2025-03-31"

export type DateRangeOp = "after" | "before" | "between";

export type ParsedDateRangeFilter =
  | { op: "after"; from: string }
  | { op: "before"; to: string }
  | { op: "between"; from: string; to: string };

/** Validates that a string is a YYYY-MM-DD calendar date. */
export function isValidIsoDate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !isNaN(d.getTime());
}

export function serializeDateRangeFilter(f: ParsedDateRangeFilter): string {
  if (f.op === "after") return `after:${f.from}`;
  if (f.op === "before") return `before:${f.to}`;
  return `between:${f.from}:${f.to}`;
}

export function deserializeDateRangeFilter(s: string): ParsedDateRangeFilter | null {
  if (!s) return null;

  if (s.startsWith("after:")) {
    const from = s.slice(6);
    if (!isValidIsoDate(from)) return null;
    return { op: "after", from };
  }

  if (s.startsWith("before:")) {
    const to = s.slice(7);
    if (!isValidIsoDate(to)) return null;
    return { op: "before", to };
  }

  if (s.startsWith("between:")) {
    const rest = s.slice(8);
    const colon = rest.indexOf(":");
    if (colon < 0) return null;
    const from = rest.slice(0, colon);
    const to = rest.slice(colon + 1);
    if (!isValidIsoDate(from) || !isValidIsoDate(to)) return null;
    return { op: "between", from, to };
  }

  return null;
}

/**
 * Returns a human-readable chip label for an active date range filter.
 * `fmt` is a caller-supplied date formatter (e.g. from `useDateFormat()`).
 */
export function formatDateRangeChip(
  f: ParsedDateRangeFilter,
  fmt: (d: Date) => string
): string {
  const fmtDate = (iso: string) => fmt(new Date(`${iso}T00:00:00Z`));
  if (f.op === "after") return `from ${fmtDate(f.from)}`;
  if (f.op === "before") return `until ${fmtDate(f.to)}`;
  return `${fmtDate(f.from)} – ${fmtDate(f.to)}`;
}

/**
 * Converts a parsed date range filter to UTC Date bounds for server-side
 * Prisma `where` clauses. "after:X" → gte = start of day X UTC;
 * "before:X" → lte = end of day X UTC; "between:X:Y" → both.
 */
export function dateRangeToUtcBounds(
  f: ParsedDateRangeFilter
): { gte?: Date; lte?: Date } {
  const startOfDay = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
  const endOfDay = (iso: string) => new Date(`${iso}T23:59:59.999Z`);

  if (f.op === "after") return { gte: startOfDay(f.from) };
  if (f.op === "before") return { lte: endOfDay(f.to) };
  return { gte: startOfDay(f.from), lte: endOfDay(f.to) };
}
