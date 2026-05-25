import "server-only";

import { Prisma } from "@/generated/prisma/client";
import { authorizeWorkspacePermission } from "@/server/access-control/authorize";
import { prisma } from "@/server/db/prisma";
import { getPartCategories } from "@/server/parts/categories";
import { getEffectivePartCategoryAttributes } from "@/server/parts/attributes";
import {
  decodeListCursor,
  encodeListCursor,
  getListPageSize,
  type ListPage
} from "@/server/pagination";

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
  page: ListPage<PartsListItem>;
  isDatabaseAvailable: boolean;
};

export type PartsListFilters = {
  searchQuery?: string | null;
  categoryFilterId?: string | null;
  manufacturerFilter?: string | null;
};

export type PartsListPageInput = PartsListFilters & {
  cursor?: string | null;
  pageSize?: number | null;
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
    return {
      page: await getPartsListPage(context, {}),
      isDatabaseAvailable: true
    };
  } catch {
    return {
      page: {
        items: [],
        nextCursor: null,
        totalCount: 0,
        filteredCount: 0
      },
      isDatabaseAvailable: false
    };
  }
}

type PartListCursor = {
  manufacturerName: string;
  catalogNumber: string;
  id: string;
};

export async function getPartsListPage(
  context: WorkspaceContext,
  input: PartsListPageInput
): Promise<ListPage<PartsListItem>> {
  await authorizeWorkspacePermission({
    userId: context.user.id,
    workspaceId: context.workspace.id,
    permission: "parts:read"
  });

  const pageSize = getListPageSize(input.pageSize);
  const [categories, totalCount] = await Promise.all([
    getPartCategories(context.workspace.id),
    prisma.part.count({
      where: {
        workspaceId: context.workspace.id
      }
    })
  ]);
  const categoryPathsById = new Map(
    categories.map((category) => [category.id, category.path])
  );
  const filterCategoryIds = getCategoryFilterIds({
    categories,
    categoryId: input.categoryFilterId
  });
  const searchCategoryIds = getSearchCategoryIds({
    categories,
    searchQuery: input.searchQuery
  });
  const baseWhere = getPartsListWhere({
    workspaceId: context.workspace.id,
    filters: input,
    filterCategoryIds,
    searchCategoryIds
  });
  const cursor = decodeListCursor<PartListCursor>(input.cursor);
  const where = cursor
    ? {
        AND: [baseWhere, getPartsCursorWhere(cursor)]
      }
    : baseWhere;
  const [parts, filteredCount] = await Promise.all([
    prisma.part.findMany({
      where,
      orderBy: [
        { manufacturer: { name: "asc" } },
        { catalogNumber: "asc" },
        { id: "asc" }
      ],
      take: pageSize + 1,
      select: partListSelect
    }),
    prisma.part.count({
      where: baseWhere
    })
  ]);
  const pageParts = parts.slice(0, pageSize);
  const valueAttributeIdsByCategoryId = await getValueAttributeIdsByCategoryId({
    workspaceId: context.workspace.id,
    categoryIds: pageParts
      .map((part) => part.primaryCategoryId)
      .filter((categoryId): categoryId is string => Boolean(categoryId))
  });
  const lastPart = pageParts.at(-1);

  return {
    items: pageParts.map((part) =>
      mapPartListItem({
        part,
        categoryPathsById,
        valueAttributeIdsByCategoryId
      })
    ),
    nextCursor:
      parts.length > pageSize && lastPart
        ? encodeListCursor<PartListCursor>({
            manufacturerName: lastPart.manufacturer.name,
            catalogNumber: lastPart.catalogNumber,
            id: lastPart.id
          })
        : null,
    totalCount,
    filteredCount
  };
}

const partListSelect = {
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
} satisfies Prisma.PartSelect;

type SelectedPartListItem = Prisma.PartGetPayload<{
  select: typeof partListSelect;
}>;

function mapPartListItem({
  part,
  categoryPathsById,
  valueAttributeIdsByCategoryId
}: {
  part: SelectedPartListItem;
  categoryPathsById: Map<string, string>;
  valueAttributeIdsByCategoryId: Map<string, string | null>;
}): PartsListItem {
  const attributeValues = part.attributeValues
    .filter((attributeValue) => attributeValue.displayValue !== null)
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
          (attributeValue) => attributeValue.attributeId === valueAttributeId
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
}

function getPartsListWhere({
  workspaceId,
  filters,
  filterCategoryIds,
  searchCategoryIds
}: {
  workspaceId: string;
  filters: PartsListFilters;
  filterCategoryIds: string[];
  searchCategoryIds: string[];
}): Prisma.PartWhereInput {
  const conditions: Prisma.PartWhereInput[] = [{ workspaceId }];
  const manufacturerFilter = normalizeSearchText(filters.manufacturerFilter);
  const searchQuery = normalizeSearchText(filters.searchQuery);

  if (filterCategoryIds.length > 0) {
    conditions.push({
      OR: [
        { primaryCategoryId: { in: filterCategoryIds } },
        { secondaryCategoryId: { in: filterCategoryIds } }
      ]
    });
  }

  if (manufacturerFilter) {
    conditions.push({
      manufacturer: {
        name: {
          contains: manufacturerFilter,
          mode: "insensitive"
        }
      }
    });
  }

  if (searchQuery) {
    conditions.push({
      OR: [
        {
          catalogNumber: {
            contains: searchQuery,
            mode: "insensitive"
          }
        },
        {
          description: {
            contains: searchQuery,
            mode: "insensitive"
          }
        },
        {
          manufacturer: {
            name: {
              contains: searchQuery,
              mode: "insensitive"
            }
          }
        },
        {
          attributeValues: {
            some: {
              displayValue: {
                contains: searchQuery,
                mode: "insensitive"
              }
            }
          }
        },
        ...(searchCategoryIds.length > 0
          ? [
              {
                OR: [
                  { primaryCategoryId: { in: searchCategoryIds } },
                  { secondaryCategoryId: { in: searchCategoryIds } }
                ]
              }
            ]
          : [])
      ]
    });
  }

  return {
    AND: conditions
  };
}

function getPartsCursorWhere(cursor: PartListCursor): Prisma.PartWhereInput {
  return {
    OR: [
      {
        manufacturer: {
          name: {
            gt: cursor.manufacturerName
          }
        }
      },
      {
        manufacturer: {
          name: cursor.manufacturerName
        },
        catalogNumber: {
          gt: cursor.catalogNumber
        }
      },
      {
        manufacturer: {
          name: cursor.manufacturerName
        },
        catalogNumber: cursor.catalogNumber,
        id: {
          gt: cursor.id
        }
      }
    ]
  };
}

function getCategoryFilterIds({
  categories,
  categoryId
}: {
  categories: Array<{ id: string; parentId: string | null }>;
  categoryId?: string | null;
}) {
  if (!categoryId) {
    return [];
  }

  const filterIds = new Set([categoryId]);
  let changed = true;

  while (changed) {
    changed = false;

    for (const category of categories) {
      if (
        category.parentId &&
        filterIds.has(category.parentId) &&
        !filterIds.has(category.id)
      ) {
        filterIds.add(category.id);
        changed = true;
      }
    }
  }

  return [...filterIds];
}

function getSearchCategoryIds({
  categories,
  searchQuery
}: {
  categories: Array<{ id: string; path: string }>;
  searchQuery?: string | null;
}) {
  const normalizedQuery = normalizeSearchText(searchQuery);

  if (!normalizedQuery) {
    return [];
  }

  return categories
    .filter((category) => normalizeSearchText(category.path).includes(normalizedQuery))
    .map((category) => category.id);
}

function normalizeSearchText(value?: string | null) {
  return value?.trim().replace(/\s+/g, " ").toLocaleLowerCase("en") ?? "";
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
