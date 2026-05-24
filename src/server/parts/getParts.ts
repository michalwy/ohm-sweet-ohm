import "server-only";

import { authorizeWorkspacePermission } from "@/server/access-control/authorize";
import { prisma } from "@/server/db/prisma";
import { getPartCategories } from "@/server/parts/categories";
import { getEffectivePartCategoryAttributes } from "@/server/parts/attributes";

export type PartsListItem = {
  id: string;
  catalogNumber: string;
  description: string | null;
  manufacturerName: string;
  valueDisplayValue: string | null;
  primaryCategoryId: string | null;
  primaryCategoryPath: string | null;
  secondaryCategoryId: string | null;
  secondaryCategoryPath: string | null;
  attributeValues: PartAttributeValueListItem[];
};

export type PartAttributeValueListItem = {
  attributeId: string;
  displayValue: string;
};

export type PartsListResult = {
  parts: PartsListItem[];
  isDatabaseAvailable: boolean;
};

type WorkspaceContext = {
  user: {
    id: string;
  };
  workspace: {
    id: string;
  };
};

export async function getPartsList(
  context: WorkspaceContext
): Promise<PartsListResult> {
  try {
    await authorizeWorkspacePermission({
      userId: context.user.id,
      workspaceId: context.workspace.id,
      permission: "parts:read"
    });

    const [parts, categories] = await Promise.all([
      prisma.part.findMany({
        where: {
          workspaceId: context.workspace.id
        },
        orderBy: [{ manufacturer: { name: "asc" } }, { catalogNumber: "asc" }],
        select: {
          id: true,
          catalogNumber: true,
          description: true,
          manufacturer: {
            select: {
              name: true
            }
          },
          primaryCategoryId: true,
          secondaryCategoryId: true,
          attributeValues: {
            orderBy: [{ attribute: { name: "asc" } }, { id: "asc" }],
            select: {
              attributeId: true,
              displayValue: true
            }
          }
        }
      }),
      getPartCategories(context.workspace.id)
    ]);
    const categoryPathsById = new Map(
      categories.map((category) => [category.id, category.path])
    );
    const valueAttributeIdsByCategoryId =
      await getValueAttributeIdsByCategoryId({
        workspaceId: context.workspace.id,
        categoryIds: parts
          .map((part) => part.primaryCategoryId)
          .filter((categoryId): categoryId is string => Boolean(categoryId))
      });

    return {
      parts: parts.map((part) => {
        const attributeValues = part.attributeValues
          .filter(
            (attributeValue) => attributeValue.displayValue !== null
          )
          .map((attributeValue) => ({
            attributeId: attributeValue.attributeId,
            displayValue: attributeValue.displayValue ?? ""
          }));
        const valueAttributeId = part.primaryCategoryId
          ? valueAttributeIdsByCategoryId.get(part.primaryCategoryId) ?? null
          : null;

        return {
          id: part.id,
          catalogNumber: part.catalogNumber,
          description: part.description,
          manufacturerName: part.manufacturer.name,
          valueDisplayValue: valueAttributeId
            ? attributeValues.find(
                (attributeValue) =>
                  attributeValue.attributeId === valueAttributeId
              )?.displayValue ?? null
            : null,
          primaryCategoryId: part.primaryCategoryId,
          primaryCategoryPath: part.primaryCategoryId
            ? categoryPathsById.get(part.primaryCategoryId) ?? null
            : null,
          secondaryCategoryId: part.secondaryCategoryId,
          secondaryCategoryPath: part.secondaryCategoryId
            ? categoryPathsById.get(part.secondaryCategoryId) ?? null
            : null,
          attributeValues
        };
      }),
      isDatabaseAvailable: true
    };
  } catch {
    return {
      parts: [],
      isDatabaseAvailable: false
    };
  }
}

async function getValueAttributeIdsByCategoryId({
  workspaceId,
  categoryIds
}: {
  workspaceId: string;
  categoryIds: string[];
}) {
  const uniqueCategoryIds = [...new Set(categoryIds)];
  const entries = await Promise.all(
    uniqueCategoryIds.map(async (categoryId) => {
      const effectiveAttributes = await getEffectivePartCategoryAttributes({
        workspaceId,
        categoryId
      });
      const valueAttribute = effectiveAttributes.find(
        (effectiveAttribute) => effectiveAttribute.isValue
      );

      return [categoryId, valueAttribute?.attribute.id ?? null] as const;
    })
  );

  return new Map(entries);
}
