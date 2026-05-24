import "server-only";

import { authorizeWorkspacePermission } from "@/server/access-control/authorize";
import { prisma } from "@/server/db/prisma";
import { getPartCategories } from "@/server/parts/categories";
import { getEffectivePartCategoryParameters } from "@/server/parts/parameters";

export type PartsListItem = {
  id: string;
  catalogNumber: string;
  manufacturerName: string;
  valueDisplayValue: string | null;
  primaryCategoryId: string | null;
  primaryCategoryPath: string | null;
  secondaryCategoryId: string | null;
  secondaryCategoryPath: string | null;
  parameterValues: PartParameterValueListItem[];
};

export type PartParameterValueListItem = {
  parameterId: string;
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
          manufacturer: {
            select: {
              name: true
            }
          },
          primaryCategoryId: true,
          secondaryCategoryId: true,
          parameterValues: {
            orderBy: [{ parameter: { name: "asc" } }, { id: "asc" }],
            select: {
              parameterId: true,
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
    const valueParameterIdsByCategoryId =
      await getValueParameterIdsByCategoryId({
        workspaceId: context.workspace.id,
        categoryIds: parts
          .map((part) => part.primaryCategoryId)
          .filter((categoryId): categoryId is string => Boolean(categoryId))
      });

    return {
      parts: parts.map((part) => {
        const parameterValues = part.parameterValues
          .filter(
            (parameterValue) => parameterValue.displayValue !== null
          )
          .map((parameterValue) => ({
            parameterId: parameterValue.parameterId,
            displayValue: parameterValue.displayValue ?? ""
          }));
        const valueParameterId = part.primaryCategoryId
          ? valueParameterIdsByCategoryId.get(part.primaryCategoryId) ?? null
          : null;

        return {
          id: part.id,
          catalogNumber: part.catalogNumber,
          manufacturerName: part.manufacturer.name,
          valueDisplayValue: valueParameterId
            ? parameterValues.find(
                (parameterValue) =>
                  parameterValue.parameterId === valueParameterId
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
          parameterValues
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

async function getValueParameterIdsByCategoryId({
  workspaceId,
  categoryIds
}: {
  workspaceId: string;
  categoryIds: string[];
}) {
  const uniqueCategoryIds = [...new Set(categoryIds)];
  const entries = await Promise.all(
    uniqueCategoryIds.map(async (categoryId) => {
      const effectiveParameters = await getEffectivePartCategoryParameters({
        workspaceId,
        categoryId
      });
      const valueParameter = effectiveParameters.find(
        (effectiveParameter) => effectiveParameter.isValue
      );

      return [categoryId, valueParameter?.parameter.id ?? null] as const;
    })
  );

  return new Map(entries);
}
