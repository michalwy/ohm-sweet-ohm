// Serialization and type definitions for numeric filter values.
// The serialized format is URL-safe and stored as a single string in filter state.
//
// Format:
//   single-value: "<op>:<rawValue>"          e.g. "gt:1mV", "eq:100", "lte:10k"
//   range:        "<op>:<rawMin>:<rawMax>"   e.g. "between:1mV:1V", "not-between:100:1000"

export type NumericFilterOp =
  | "eq"
  | "neq"
  | "gt"
  | "gte"
  | "lt"
  | "lte"
  | "between"
  | "not-between";

export type ParsedNumericFilter =
  | { op: "eq" | "neq" | "gt" | "gte" | "lt" | "lte"; rawValue: string }
  | { op: "between" | "not-between"; rawMin: string; rawMax: string };

export const RANGE_OPS = new Set<NumericFilterOp>(["between", "not-between"]);

export const NUMERIC_OP_LABELS: Record<NumericFilterOp, string> = {
  eq: "=",
  neq: "≠",
  gt: ">",
  gte: "≥",
  lt: "<",
  lte: "≤",
  between: "∈",
  "not-between": "∉"
};

export const NUMERIC_OPS_IN_ORDER: NumericFilterOp[] = [
  "gte",
  "lte",
  "gt",
  "lt",
  "eq",
  "neq",
  "between",
  "not-between"
];

export function serializeNumericFilter(filter: ParsedNumericFilter): string {
  if ("rawMin" in filter) {
    return `${filter.op}:${filter.rawMin}:${filter.rawMax}`;
  }
  return `${filter.op}:${filter.rawValue}`;
}

export function deserializeNumericFilter(s: string): ParsedNumericFilter | null {
  if (!s) return null;

  const colonIndex = s.indexOf(":");
  if (colonIndex < 0) return null;

  const op = s.slice(0, colonIndex) as NumericFilterOp;
  const rest = s.slice(colonIndex + 1);

  if (!rest) return null;

  if (op === "between" || op === "not-between") {
    // Find the second colon (the one separating min and max).
    const secondColon = rest.indexOf(":");
    if (secondColon < 0) return null;
    const rawMin = rest.slice(0, secondColon);
    const rawMax = rest.slice(secondColon + 1);
    if (!rawMin || !rawMax) return null;
    return { op, rawMin, rawMax };
  }

  const validOps: NumericFilterOp[] = ["eq", "neq", "gt", "gte", "lt", "lte"];
  if (!validOps.includes(op)) return null;

  return { op, rawValue: rest };
}
