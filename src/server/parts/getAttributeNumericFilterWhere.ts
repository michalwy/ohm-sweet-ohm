import "server-only";

import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/server/db/prisma";
import { deserializeNumericFilter } from "@/app/numeric-filter-value";
import { parseQuantityValue, parseNumberValue } from "@/lib/quantityParsing";

/**
 * Build a Prisma WHERE condition that filters parts by a QUANTITY or NUMBER
 * attribute value using a serialized NumericFilter string (e.g. "gt:1mV",
 * "between:100:1000").
 *
 * Semantics for NEQ / NOT-BETWEEN: consistent with BOM matcher behaviour —
 * parts that have no value for this attribute are treated as "not equal", so
 * they satisfy NEQ and NOT-BETWEEN conditions (i.e. they appear in results).
 *
 * Returns null when:
 * - the attribute does not exist or is not a numeric type
 * - the filter string is absent / empty / unparseable
 * - the value(s) cannot be parsed for the attribute's unit
 */
export async function getAttributeNumericFilterWhere({
  attributeId,
  workspaceId,
  serializedFilter
}: {
  attributeId: string;
  workspaceId: string;
  serializedFilter: string;
}): Promise<Prisma.PartWhereInput | null> {
  if (!serializedFilter?.trim()) return null;

  const parsed = deserializeNumericFilter(serializedFilter);
  if (!parsed) return null;

  const attribute = await prisma.attribute.findFirst({
    where: { id: attributeId, workspaceId },
    select: { type: true, baseUnitSymbol: true }
  });

  if (!attribute) return null;
  if (attribute.type !== "QUANTITY" && attribute.type !== "NUMBER") return null;

  const col =
    attribute.type === "QUANTITY" ? "quantityBaseValue" : "numberValue";

  function parseDecimal(raw: string): Prisma.Decimal | null {
    const result =
      attribute!.type === "QUANTITY" && attribute!.baseUnitSymbol
        ? parseQuantityValue({ rawValue: raw, baseUnitSymbol: attribute!.baseUnitSymbol })
        : parseNumberValue({ rawValue: raw });

    if (!result.ok) return null;
    const value = "baseValue" in result ? result.baseValue : result.value;
    return new Prisma.Decimal(value);
  }

  if ("rawMin" in parsed) {
    const min = parseDecimal(parsed.rawMin);
    const max = parseDecimal(parsed.rawMax);
    if (!min || !max) return null;

    if (parsed.op === "between") {
      return {
        attributeValues: {
          some: { attributeId, [col]: { gte: min, lte: max } }
        }
      };
    }
    // not-between: include parts with no attribute value (they don't have the value in range)
    return {
      NOT: {
        attributeValues: {
          some: { attributeId, [col]: { gte: min, lte: max } }
        }
      }
    };
  }

  const val = parseDecimal(parsed.rawValue);
  if (!val) return null;

  const { op } = parsed;

  if (op === "eq") {
    return { attributeValues: { some: { attributeId, [col]: val } } };
  }
  if (op === "neq") {
    // Include parts with no attribute value — they are also "not equal".
    return { NOT: { attributeValues: { some: { attributeId, [col]: val } } } };
  }
  if (op === "gt") {
    return { attributeValues: { some: { attributeId, [col]: { gt: val } } } };
  }
  if (op === "gte") {
    return { attributeValues: { some: { attributeId, [col]: { gte: val } } } };
  }
  if (op === "lt") {
    return { attributeValues: { some: { attributeId, [col]: { lt: val } } } };
  }
  if (op === "lte") {
    return { attributeValues: { some: { attributeId, [col]: { lte: val } } } };
  }

  return null;
}
