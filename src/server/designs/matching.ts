import "server-only";

import { prisma } from "@/server/db/prisma";
import type { AttributeValueType } from "@/server/parts/attributeValues";

import {
  evaluateMatcher,
  type MatcherOperator,
  type StoredAttributeValue
} from "./bomMatcherEvaluation";

export type MatchSpecMatcher = StoredAttributeValue & {
  attributeId: string;
  type: AttributeValueType;
  operator: MatcherOperator;
};

export type MatchSpec = {
  pinnedPartId?: string | null;
  categoryId?: string | null;
  matchers: MatchSpecMatcher[];
};

export type MatchingPart = {
  id: string;
  catalogNumber: string;
  description: string | null;
  manufacturerName: string;
};

/**
 * Resolve all candidate descendant category ids (including the category itself) using the
 * closure table, mirroring the parts-list category filter behavior.
 */
async function getCategoryAndDescendantIds(
  workspaceId: string,
  categoryId: string
): Promise<string[]> {
  const closures = await prisma.partCategoryClosure.findMany({
    where: { workspaceId, ancestorId: categoryId },
    select: { descendantId: true }
  });
  const ids = new Set<string>([categoryId]);
  for (const closure of closures) {
    ids.add(closure.descendantId);
  }
  return [...ids];
}

function toMatchingPart(part: {
  id: string;
  catalogNumber: string;
  description: string | null;
  manufacturer: { name: string };
}): MatchingPart {
  return {
    id: part.id,
    catalogNumber: part.catalogNumber,
    description: part.description,
    manufacturerName: part.manufacturer.name
  };
}

/**
 * Return the inventory parts in the workspace that satisfy a line item spec.
 *
 * When a part is pinned, that single part (if still in the workspace) is the result and
 * matchers are ignored. Otherwise parts are narrowed by category (including descendants)
 * and every matcher must pass `evaluateMatcher` against the part's attribute values.
 */
export async function findMatchingParts({
  workspaceId,
  spec
}: {
  workspaceId: string;
  spec: MatchSpec;
}): Promise<MatchingPart[]> {
  if (spec.pinnedPartId) {
    const part = await prisma.part.findFirst({
      where: { id: spec.pinnedPartId, workspaceId },
      select: {
        id: true,
        catalogNumber: true,
        description: true,
        manufacturer: { select: { name: true } }
      }
    });
    return part ? [toMatchingPart(part)] : [];
  }

  const categoryIds = spec.categoryId
    ? await getCategoryAndDescendantIds(workspaceId, spec.categoryId)
    : null;

  const matcherAttributeIds = spec.matchers.map((matcher) => matcher.attributeId);

  const parts = await prisma.part.findMany({
    where: {
      workspaceId,
      ...(categoryIds
        ? {
            OR: [
              { primaryCategoryId: { in: categoryIds } },
              { secondaryCategoryId: { in: categoryIds } }
            ]
          }
        : {})
    },
    select: {
      id: true,
      catalogNumber: true,
      description: true,
      manufacturer: { select: { name: true } },
      attributeValues: {
        where:
          matcherAttributeIds.length > 0
            ? { attributeId: { in: matcherAttributeIds } }
            : undefined,
        select: {
          attributeId: true,
          textValue: true,
          numberValue: true,
          quantityBaseValue: true,
          booleanValue: true,
          choiceOptionId: true
        }
      }
    },
    orderBy: [{ catalogNumber: "asc" }, { id: "asc" }]
  });

  const matching = parts.filter((part) => {
    const valuesByAttribute = new Map<string, StoredAttributeValue>();
    for (const value of part.attributeValues) {
      valuesByAttribute.set(value.attributeId, {
        textValue: value.textValue,
        numberValue: value.numberValue?.toString() ?? null,
        quantityBaseValue: value.quantityBaseValue?.toString() ?? null,
        booleanValue: value.booleanValue,
        choiceOptionId: value.choiceOptionId
      });
    }

    return spec.matchers.every((matcher) =>
      evaluateMatcher({
        type: matcher.type,
        operator: matcher.operator,
        matcherValue: {
          textValue: matcher.textValue,
          numberValue: matcher.numberValue,
          quantityBaseValue: matcher.quantityBaseValue,
          booleanValue: matcher.booleanValue,
          choiceOptionId: matcher.choiceOptionId
        },
        partValue: valuesByAttribute.get(matcher.attributeId) ?? null
      })
    );
  });

  return matching.map(toMatchingPart);
}
