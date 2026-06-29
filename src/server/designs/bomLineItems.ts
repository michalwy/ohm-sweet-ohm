import "server-only";

import { authorizeWorkspacePermission } from "@/server/access-control/authorize";
import { prisma } from "@/server/db/prisma";
import { parseDesignatorRange } from "@/lib/designators";
import {
  parseAttributeValue,
  type AttributeValueType,
  type ParsedAttributeValue
} from "@/server/parts/attributeValues";
import {
  getEffectiveCategoryAttributeConfiguration,
  type AttributeListItem
} from "@/server/parts/attributeMutations";
import { getPartCategories, type PartCategoryListItem } from "@/server/parts/categories";

import {
  isOperatorAllowedForType,
  type MatcherOperator
} from "./bomMatcherEvaluation";
import { findMatchingParts, type MatchSpecMatcher, type MatchingPart } from "./matching";

export type BomMatcherInput = {
  attributeId: string;
  operator: MatcherOperator;
  rawValue: string;
};

export type BomLineItemInput = {
  designators: string;
  categoryId?: string | null;
  pinnedPartId?: string | null;
  matchers: BomMatcherInput[];
  notes?: string | null;
};

export type BomMatcherSummary = {
  id: string;
  attributeId: string;
  attributeName: string;
  attributeType: AttributeValueType;
  operator: MatcherOperator;
  displayValue: string | null;
};

export type BomLineItemSummary = {
  id: string;
  designators: string;
  quantity: number;
  sortOrder: number;
  notes: string | null;
  category: { id: string; name: string } | null;
  pinnedPart: { id: string; catalogNumber: string } | null;
  matchers: BomMatcherSummary[];
  matchCount: number;
};

type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string };

// --- Helpers shared by create/update/preview ---

type MatcherValueFields = {
  textValue: string | null;
  numberValue: string | null;
  quantityBaseValue: string | null;
  booleanValue: boolean | null;
  choiceOptionId: string | null;
  displayValue: string | null;
};

function matcherValueFields(parsed: ParsedAttributeValue): MatcherValueFields {
  const base: MatcherValueFields = {
    textValue: null,
    numberValue: null,
    quantityBaseValue: null,
    booleanValue: null,
    choiceOptionId: null,
    displayValue: parsed.displayValue
  };
  switch (parsed.type) {
    case "TEXT":
      return { ...base, textValue: parsed.textValue };
    case "NUMBER":
      return { ...base, numberValue: parsed.numberValue };
    case "QUANTITY":
      return { ...base, quantityBaseValue: parsed.quantityBaseValue };
    case "BOOLEAN":
      return { ...base, booleanValue: parsed.booleanValue };
    case "CHOICE":
      return { ...base, choiceOptionId: parsed.choiceOptionId };
  }
}

type ResolvedMatcher = MatcherValueFields & {
  attributeId: string;
  operator: MatcherOperator;
  type: AttributeValueType;
};

/**
 * Validate and normalize matcher inputs against their workspace attributes. Throws an
 * Error with an internal code on the first invalid matcher.
 */
async function resolveMatchers(
  workspaceId: string,
  matchers: BomMatcherInput[]
): Promise<ResolvedMatcher[]> {
  const resolved: ResolvedMatcher[] = [];
  const seen = new Set<string>();

  for (const matcher of matchers) {
    if (seen.has(matcher.attributeId)) {
      throw new Error("duplicate-matcher-attribute");
    }
    seen.add(matcher.attributeId);

    const attribute = await prisma.attribute.findFirst({
      where: { id: matcher.attributeId, workspaceId },
      select: {
        id: true,
        type: true,
        baseUnitSymbol: true,
        choiceOptions: { select: { id: true, label: true } }
      }
    });
    if (!attribute) throw new Error("attribute-not-found");

    if (!isOperatorAllowedForType(attribute.type, matcher.operator)) {
      throw new Error("invalid-operator-for-type");
    }

    const parsed = parseAttributeValue({
      type: attribute.type,
      rawValue: matcher.rawValue,
      baseUnitSymbol: attribute.baseUnitSymbol,
      choiceOptions: attribute.choiceOptions
    });
    resolved.push({
      attributeId: attribute.id,
      operator: matcher.operator,
      type: attribute.type,
      ...matcherValueFields(parsed)
    });
  }

  return resolved;
}

function resolvedToSpecMatcher(matcher: ResolvedMatcher): MatchSpecMatcher {
  return {
    attributeId: matcher.attributeId,
    type: matcher.type,
    operator: matcher.operator,
    textValue: matcher.textValue,
    numberValue: matcher.numberValue,
    quantityBaseValue: matcher.quantityBaseValue,
    booleanValue: matcher.booleanValue,
    choiceOptionId: matcher.choiceOptionId
  };
}

async function validateLineItemReferences(
  workspaceId: string,
  input: BomLineItemInput
): Promise<{ designators: string[]; quantity: number } | { error: string }> {
  let parsed: { designators: string[]; quantity: number };
  try {
    parsed = parseDesignatorRange(input.designators);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "invalid-designators" };
  }
  if (parsed.quantity === 0) return { error: "designators-required" };

  if (input.categoryId) {
    const category = await prisma.partCategory.findFirst({
      where: { id: input.categoryId, workspaceId },
      select: { id: true }
    });
    if (!category) return { error: "category-not-found" };
  }

  if (input.pinnedPartId) {
    const part = await prisma.part.findFirst({
      where: { id: input.pinnedPartId, workspaceId },
      select: { id: true }
    });
    if (!part) return { error: "part-not-found" };
  }

  return parsed;
}

// --- Queries ---

export type BomDialogData = {
  categories: PartCategoryListItem[];
};

/**
 * Categories needed to author a BOM line item. Authorized by `designs:read` so designers
 * can build specs without separate categories read permission.
 */
export async function getBomDialogData({
  userId,
  workspaceId
}: {
  userId: string;
  workspaceId: string;
}): Promise<BomDialogData> {
  await authorizeWorkspacePermission({ userId, workspaceId, permission: "designs:read" });

  const categories = await getPartCategories(workspaceId);
  return { categories };
}

/**
 * Effective attributes for a category (inherited + local), used to populate the matcher
 * attribute picker. Authorized by `designs:read`.
 */
export async function getBomCategoryAttributes({
  userId,
  workspaceId,
  categoryId
}: {
  userId: string;
  workspaceId: string;
  categoryId: string;
}): Promise<AttributeListItem[]> {
  await authorizeWorkspacePermission({ userId, workspaceId, permission: "designs:read" });

  const effective = await getEffectiveCategoryAttributeConfiguration({ workspaceId, categoryId });
  return effective.map((entry) => ({
    id: entry.attribute.id,
    name: entry.attribute.name,
    description: entry.attribute.description,
    type: entry.attribute.type,
    baseUnitSymbol: entry.attribute.baseUnitSymbol,
    choiceOptions: entry.attribute.choiceOptions
  }));
}

export async function getBomLineItems({
  userId,
  workspaceId,
  revisionId
}: {
  userId: string;
  workspaceId: string;
  revisionId: string;
}): Promise<BomLineItemSummary[]> {
  await authorizeWorkspacePermission({ userId, workspaceId, permission: "designs:read" });

  const revision = await prisma.designRevision.findFirst({
    where: { id: revisionId, workspaceId },
    select: { id: true }
  });
  if (!revision) return [];

  const rows = await prisma.bomLineItem.findMany({
    where: { revisionId, workspaceId },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      designators: true,
      quantity: true,
      sortOrder: true,
      notes: true,
      pinnedPartId: true,
      category: { select: { id: true, name: true } },
      pinnedPart: { select: { id: true, catalogNumber: true } },
      matchers: {
        select: {
          id: true,
          attributeId: true,
          operator: true,
          displayValue: true,
          textValue: true,
          numberValue: true,
          quantityBaseValue: true,
          booleanValue: true,
          choiceOptionId: true,
          attribute: { select: { name: true, type: true } }
        }
      }
    }
  });

  const summaries: BomLineItemSummary[] = [];
  for (const row of rows) {
    const matches = await findMatchingParts({
      workspaceId,
      spec: {
        pinnedPartId: row.pinnedPartId,
        categoryId: row.category?.id ?? null,
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
      }
    });

    summaries.push({
      id: row.id,
      designators: row.designators,
      quantity: row.quantity,
      sortOrder: row.sortOrder,
      notes: row.notes,
      category: row.category,
      pinnedPart: row.pinnedPart,
      matchers: row.matchers.map((matcher) => ({
        id: matcher.id,
        attributeId: matcher.attributeId,
        attributeName: matcher.attribute.name,
        attributeType: matcher.attribute.type,
        operator: matcher.operator,
        displayValue: matcher.displayValue
      })),
      matchCount: matches.length
    });
  }

  return summaries;
}

export async function previewLineItemMatches({
  userId,
  workspaceId,
  input,
  limit = 20
}: {
  userId: string;
  workspaceId: string;
  input: { categoryId?: string | null; pinnedPartId?: string | null; matchers: BomMatcherInput[] };
  limit?: number;
}): Promise<ActionResult<{ count: number; parts: MatchingPart[] }>> {
  await authorizeWorkspacePermission({ userId, workspaceId, permission: "designs:read" });

  let resolved: ResolvedMatcher[];
  try {
    resolved = await resolveMatchers(workspaceId, input.matchers);
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "invalid-matcher" };
  }

  const matches = await findMatchingParts({
    workspaceId,
    spec: {
      pinnedPartId: input.pinnedPartId,
      categoryId: input.categoryId,
      matchers: resolved.map(resolvedToSpecMatcher)
    }
  });

  return { ok: true, data: { count: matches.length, parts: matches.slice(0, limit) } };
}

// --- Mutations ---

export async function createBomLineItem({
  userId,
  workspaceId,
  revisionId,
  input
}: {
  userId: string;
  workspaceId: string;
  revisionId: string;
  input: BomLineItemInput;
}): Promise<ActionResult<{ id: string }>> {
  await authorizeWorkspacePermission({ userId, workspaceId, permission: "designs:write" });

  const revision = await prisma.designRevision.findFirst({
    where: { id: revisionId, workspaceId },
    select: { id: true }
  });
  if (!revision) return { ok: false, error: "revision-not-found" };

  const references = await validateLineItemReferences(workspaceId, input);
  if ("error" in references) return { ok: false, error: references.error };

  let resolved: ResolvedMatcher[];
  try {
    resolved = await resolveMatchers(workspaceId, input.matchers);
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "invalid-matcher" };
  }

  const last = await prisma.bomLineItem.findFirst({
    where: { revisionId, workspaceId },
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true }
  });
  const sortOrder = (last?.sortOrder ?? -1) + 1;

  const created = await prisma.bomLineItem.create({
    data: {
      workspaceId,
      revisionId,
      categoryId: input.categoryId ?? null,
      pinnedPartId: input.pinnedPartId ?? null,
      designators: input.designators.trim(),
      quantity: references.quantity,
      sortOrder,
      notes: input.notes?.trim() || null,
      matchers: {
        create: resolved.map((matcher) => ({
          workspaceId,
          attributeId: matcher.attributeId,
          operator: matcher.operator,
          textValue: matcher.textValue,
          numberValue: matcher.numberValue,
          quantityBaseValue: matcher.quantityBaseValue,
          booleanValue: matcher.booleanValue,
          choiceOptionId: matcher.choiceOptionId,
          displayValue: matcher.displayValue
        }))
      }
    },
    select: { id: true }
  });

  return { ok: true, data: { id: created.id } };
}

export async function updateBomLineItem({
  userId,
  workspaceId,
  lineItemId,
  input
}: {
  userId: string;
  workspaceId: string;
  lineItemId: string;
  input: BomLineItemInput;
}): Promise<ActionResult<null>> {
  await authorizeWorkspacePermission({ userId, workspaceId, permission: "designs:write" });

  const existing = await prisma.bomLineItem.findFirst({
    where: { id: lineItemId, workspaceId },
    select: { id: true }
  });
  if (!existing) return { ok: false, error: "line-item-not-found" };

  const references = await validateLineItemReferences(workspaceId, input);
  if ("error" in references) return { ok: false, error: references.error };

  let resolved: ResolvedMatcher[];
  try {
    resolved = await resolveMatchers(workspaceId, input.matchers);
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "invalid-matcher" };
  }

  await prisma.$transaction(async (tx) => {
    await tx.bomMatcher.deleteMany({ where: { lineItemId } });
    await tx.bomLineItem.update({
      where: { id: lineItemId },
      data: {
        categoryId: input.categoryId ?? null,
        pinnedPartId: input.pinnedPartId ?? null,
        designators: input.designators.trim(),
        quantity: references.quantity,
        notes: input.notes?.trim() || null,
        matchers: {
          create: resolved.map((matcher) => ({
            workspaceId,
            attributeId: matcher.attributeId,
            operator: matcher.operator,
            textValue: matcher.textValue,
            numberValue: matcher.numberValue,
            quantityBaseValue: matcher.quantityBaseValue,
            booleanValue: matcher.booleanValue,
            choiceOptionId: matcher.choiceOptionId,
            displayValue: matcher.displayValue
          }))
        }
      }
    });
  });

  return { ok: true, data: null };
}

export async function deleteBomLineItem({
  userId,
  workspaceId,
  lineItemId
}: {
  userId: string;
  workspaceId: string;
  lineItemId: string;
}): Promise<ActionResult<null>> {
  await authorizeWorkspacePermission({ userId, workspaceId, permission: "designs:write" });

  const existing = await prisma.bomLineItem.findFirst({
    where: { id: lineItemId, workspaceId },
    select: { id: true }
  });
  if (!existing) return { ok: false, error: "line-item-not-found" };

  await prisma.bomLineItem.delete({ where: { id: lineItemId } });

  return { ok: true, data: null };
}
