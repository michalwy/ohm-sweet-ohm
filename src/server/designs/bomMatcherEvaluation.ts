import {
  normalizeDictionaryName,
  type AttributeValueType
} from "@/server/parts/attributeValues";

/**
 * Pure evaluation of BOM attribute matchers against part attribute values.
 *
 * No server or Prisma imports — unit-testable in isolation. The matcher value and the
 * part value are both stored in the same normalized shape as `PartAttributeValue`, so a
 * matcher with `power >= 0.25` is compared as `partValue <operator> matcherValue`.
 */

export type MatcherOperator = "EQ" | "NEQ" | "LT" | "LTE" | "GT" | "GTE";

/** Operators each attribute type accepts. Ordering operators only apply to numbers. */
export const MATCHER_OPERATORS_BY_TYPE: Record<AttributeValueType, MatcherOperator[]> = {
  TEXT: ["EQ", "NEQ"],
  CHOICE: ["EQ", "NEQ"],
  BOOLEAN: ["EQ", "NEQ"],
  NUMBER: ["EQ", "NEQ", "LT", "LTE", "GT", "GTE"],
  QUANTITY: ["EQ", "NEQ", "LT", "LTE", "GT", "GTE"]
};

export function isOperatorAllowedForType(
  type: AttributeValueType,
  operator: MatcherOperator
): boolean {
  return MATCHER_OPERATORS_BY_TYPE[type].includes(operator);
}

/** The normalized value fields shared by `BomMatcher` and `PartAttributeValue`. */
export type StoredAttributeValue = {
  textValue?: string | null;
  numberValue?: string | number | null;
  quantityBaseValue?: string | number | null;
  booleanValue?: boolean | null;
  choiceOptionId?: string | null;
};

function compareNumbers(partValue: number, matcherValue: number, operator: MatcherOperator) {
  switch (operator) {
    case "EQ":
      return partValue === matcherValue;
    case "NEQ":
      return partValue !== matcherValue;
    case "LT":
      return partValue < matcherValue;
    case "LTE":
      return partValue <= matcherValue;
    case "GT":
      return partValue > matcherValue;
    case "GTE":
      return partValue >= matcherValue;
    default:
      return false;
  }
}

function toNumber(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Evaluate a single matcher against a part's value for the same attribute.
 *
 * A part with no value for the attribute satisfies only `NEQ` (it is, trivially, "not
 * equal" to the required value); every other operator fails.
 */
export function evaluateMatcher({
  type,
  operator,
  matcherValue,
  partValue
}: {
  type: AttributeValueType;
  operator: MatcherOperator;
  matcherValue: StoredAttributeValue;
  partValue: StoredAttributeValue | null;
}): boolean {
  if (partValue === null) {
    return operator === "NEQ";
  }

  switch (type) {
    case "QUANTITY": {
      const matcherNumber = toNumber(matcherValue.quantityBaseValue);
      const partNumber = toNumber(partValue.quantityBaseValue);
      if (matcherNumber === null || partNumber === null) return operator === "NEQ";
      return compareNumbers(partNumber, matcherNumber, operator);
    }
    case "NUMBER": {
      const matcherNumber = toNumber(matcherValue.numberValue);
      const partNumber = toNumber(partValue.numberValue);
      if (matcherNumber === null || partNumber === null) return operator === "NEQ";
      return compareNumbers(partNumber, matcherNumber, operator);
    }
    case "TEXT": {
      const matcherText = normalizeDictionaryName(matcherValue.textValue ?? "");
      const partText = normalizeDictionaryName(partValue.textValue ?? "");
      return operator === "NEQ" ? partText !== matcherText : partText === matcherText;
    }
    case "CHOICE": {
      const equal = (partValue.choiceOptionId ?? null) === (matcherValue.choiceOptionId ?? null);
      return operator === "NEQ" ? !equal : equal;
    }
    case "BOOLEAN": {
      const equal = (partValue.booleanValue ?? null) === (matcherValue.booleanValue ?? null);
      return operator === "NEQ" ? !equal : equal;
    }
    default:
      return false;
  }
}
