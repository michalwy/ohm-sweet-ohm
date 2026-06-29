/**
 * Reference designator range parsing for BOM line items.
 *
 * A designator string is a comma-separated list of tokens. Each token is either a
 * single designator (`R1`) or an inclusive same-prefix range (`R5-R10`). Ranges expand
 * to individual designators and the quantity is the count of unique expanded designators.
 *
 * Pure logic only — no server or i18n imports, so it is unit-testable in isolation.
 * Error messages are internal codes (hyphenated) surfaced through action error handling.
 */

const SINGLE_TOKEN = /^([A-Za-z]+)(\d+)$/;
const RANGE_TOKEN = /^([A-Za-z]+)(\d+)-([A-Za-z]+)(\d+)$/;

export type ParsedDesignatorRange = {
  designators: string[];
  quantity: number;
};

/**
 * Parse a designator range string into an ordered, de-duplicated list of designators.
 *
 * @throws Error with code `invalid-designator` for malformed tokens, `invalid-range`
 * for ranges with mismatched prefixes or a start greater than the end, and
 * `duplicate-designator` when the same designator appears more than once.
 */
export function parseDesignatorRange(input: string): ParsedDesignatorRange {
  const designators: string[] = [];
  const seen = new Set<string>();

  function push(designator: string) {
    if (seen.has(designator)) {
      throw new Error("duplicate-designator");
    }
    seen.add(designator);
    designators.push(designator);
  }

  for (const rawToken of input.split(",")) {
    const token = rawToken.trim();
    if (token === "") continue;

    const rangeMatch = RANGE_TOKEN.exec(token);
    if (rangeMatch) {
      const [, startPrefix, startNumber, endPrefix, endNumber] = rangeMatch;
      if (startPrefix !== endPrefix) {
        throw new Error("invalid-range");
      }
      const start = Number.parseInt(startNumber, 10);
      const end = Number.parseInt(endNumber, 10);
      if (start > end) {
        throw new Error("invalid-range");
      }
      for (let value = start; value <= end; value += 1) {
        push(`${startPrefix}${value}`);
      }
      continue;
    }

    const singleMatch = SINGLE_TOKEN.exec(token);
    if (singleMatch) {
      const [, prefix, number] = singleMatch;
      push(`${prefix}${Number.parseInt(number, 10)}`);
      continue;
    }

    throw new Error("invalid-designator");
  }

  return { designators, quantity: designators.length };
}
