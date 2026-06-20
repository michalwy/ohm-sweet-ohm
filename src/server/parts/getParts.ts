import "server-only";

import { Prisma } from "@/generated/prisma/client";
import {
  authorizeWorkspacePermission,
  hasWorkspacePermission
} from "@/server/access-control/authorize";
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
  unitId: string;
  catalogNumber: string;
  description: string | null;
  manufacturerName: string;
  valueDisplayValue: string | null;
  primaryCategoryId: string | null;
  primaryCategoryPath: string | null;
  secondaryCategoryId: string | null;
  secondaryCategoryPath: string | null;
  currentStock: string | null;
  plannedQuantity: string | null;
  onOrderQuantity: string | null;
  avgNetCost: string | null;
  avgGrossCost: string | null;
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

export type PartsListSortDirection = "asc" | "desc";

export type PartsListPageInput = PartsListFilters & {
  cursor?: string | null;
  pageSize?: number | null;
  sortBy?: string | null;
  sortDirection?: PartsListSortDirection | null;
};

type WorkspaceContext = {
  user: {
    id: string;
  };
  workspace: {
    id: string;
    primaryCurrency: string;
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

type DecimalFieldCursor = {
  value: string;
  id: string;
};

type SortedPartsCursor = {
  offset: number;
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
  const [canReadInventory, canReadShoppingLists, canReadPurchaseOrders] = await Promise.all([
    hasWorkspacePermission({
      userId: context.user.id,
      workspaceId: context.workspace.id,
      permission: "inventory:read"
    }),
    hasWorkspacePermission({
      userId: context.user.id,
      workspaceId: context.workspace.id,
      permission: "shopping-lists:read"
    }),
    hasWorkspacePermission({
      userId: context.user.id,
      workspaceId: context.workspace.id,
      permission: "purchase-orders:read"
    })
  ]);
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
  const requestedSortBy = input.sortBy?.trim() ?? "";
  const activeSortBy =
    (requestedSortBy === "currentStock" && !canReadInventory) ||
    (requestedSortBy === "plannedQuantity" && !canReadShoppingLists) ||
    (requestedSortBy === "onOrderQuantity" && !canReadPurchaseOrders) ||
    (requestedSortBy === "avgNetCost" && !canReadPurchaseOrders) ||
    (requestedSortBy === "avgGrossCost" && !canReadPurchaseOrders)
      ? ""
      : requestedSortBy;
  const activeSortDirection: PartsListSortDirection =
    input.sortDirection === "desc" ? "desc" : "asc";

  let page: ListPage<PartsListItem>;

  if (activeSortBy === "currentStock" && canReadInventory) {
    page = await getDecimalFieldSortedPartsListPage({
      field: "currentStock",
      baseWhere,
      categoryPathsById,
      cursor: input.cursor,
      pageSize,
      sortDirection: activeSortDirection,
      totalCount,
      workspaceId: context.workspace.id,
      canReadInventory,
      canReadShoppingLists,
      canReadPurchaseOrders
    });
  } else if (activeSortBy === "plannedQuantity" && canReadShoppingLists) {
    page = await getDecimalFieldSortedPartsListPage({
      field: "plannedQty",
      baseWhere,
      categoryPathsById,
      cursor: input.cursor,
      pageSize,
      sortDirection: activeSortDirection,
      totalCount,
      workspaceId: context.workspace.id,
      canReadInventory,
      canReadShoppingLists,
      canReadPurchaseOrders
    });
  } else if (activeSortBy === "onOrderQuantity" && canReadPurchaseOrders) {
    page = await getDecimalFieldSortedPartsListPage({
      field: "onOrderQty",
      baseWhere,
      categoryPathsById,
      cursor: input.cursor,
      pageSize,
      sortDirection: activeSortDirection,
      totalCount,
      workspaceId: context.workspace.id,
      canReadInventory,
      canReadShoppingLists,
      canReadPurchaseOrders
    });
  } else if (activeSortBy === "avgNetCost" && canReadPurchaseOrders) {
    page = await getDecimalFieldSortedPartsListPage({
      field: "avgNetCostPrimary",
      baseWhere,
      categoryPathsById,
      cursor: input.cursor,
      pageSize,
      sortDirection: activeSortDirection,
      totalCount,
      workspaceId: context.workspace.id,
      canReadInventory,
      canReadShoppingLists,
      canReadPurchaseOrders
    });
  } else if (activeSortBy === "avgGrossCost" && canReadPurchaseOrders) {
    page = await getDecimalFieldSortedPartsListPage({
      field: "avgGrossCostPrimary",
      baseWhere,
      categoryPathsById,
      cursor: input.cursor,
      pageSize,
      sortDirection: activeSortDirection,
      totalCount,
      workspaceId: context.workspace.id,
      canReadInventory,
      canReadShoppingLists,
      canReadPurchaseOrders
    });
  } else if (activeSortBy) {
    page = await getSortedPartsListPage({
      baseWhere,
      categoryPathsById,
      pageSize,
      sortBy: activeSortBy,
      sortDirection: activeSortDirection,
      totalCount,
      workspaceId: context.workspace.id,
      cursor: input.cursor,
      canReadInventory,
      canReadShoppingLists,
      canReadPurchaseOrders
    });
  } else {
    const cursor = decodeListCursor<PartListCursor>(input.cursor);
    const where = cursor
      ? { AND: [baseWhere, getPartsCursorWhere(cursor)] }
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
      prisma.part.count({ where: baseWhere })
    ]);
    const pageParts = parts.slice(0, pageSize);
    const valueAttributeIdsByCategoryId = await getValueAttributeIdsByCategoryId({
      workspaceId: context.workspace.id,
      categoryIds: pageParts
        .map((part) => part.primaryCategoryId)
        .filter((categoryId): categoryId is string => Boolean(categoryId))
    });
    const lastPart = pageParts.at(-1);
    page = {
      items: pageParts.map((part) =>
        mapPartListItem({
          part,
          categoryPathsById,
          valueAttributeIdsByCategoryId,
          canReadInventory,
          canReadShoppingLists,
          canReadPurchaseOrders
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

  return page;
}

const partListSelect = {
  id: true,
  unitId: true,
  catalogNumber: true,
  description: true,
  currentStock: true,
  plannedQty: true,
  onOrderQty: true,
  avgNetCostPrimary: true,
  avgGrossCostPrimary: true,
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
      displayValue: true,
      numberValue: true,
      quantityBaseValue: true
    }
  }
} satisfies Prisma.PartSelect;

type SelectedPartListItem = Prisma.PartGetPayload<{
  select: typeof partListSelect;
}>;

type SortablePartRecord = {
  item: PartsListItem;
  part: SelectedPartListItem;
  valueAttributeId: string | null;
};

async function getDecimalFieldSortedPartsListPage({
  field,
  baseWhere,
  categoryPathsById,
  cursor,
  pageSize,
  sortDirection,
  totalCount,
  workspaceId,
  canReadInventory,
  canReadShoppingLists,
  canReadPurchaseOrders
}: {
  field: "currentStock" | "plannedQty" | "onOrderQty" | "avgNetCostPrimary" | "avgGrossCostPrimary";
  baseWhere: Prisma.PartWhereInput;
  categoryPathsById: Map<string, string>;
  cursor?: string | null;
  pageSize: number;
  sortDirection: PartsListSortDirection;
  totalCount: number;
  workspaceId: string;
  canReadInventory: boolean;
  canReadShoppingLists: boolean;
  canReadPurchaseOrders: boolean;
}): Promise<ListPage<PartsListItem>> {
  const decodedCursor = decodeListCursor<DecimalFieldCursor>(cursor);
  const cursorWhere = decodedCursor
    ? getDecimalFieldCursorWhere({ field, cursor: decodedCursor, sortDirection })
    : null;
  const where = cursorWhere ? { AND: [baseWhere, cursorWhere] } : baseWhere;
  const [parts, filteredCount] = await Promise.all([
    prisma.part.findMany({
      where,
      orderBy: [{ [field]: sortDirection }, { id: "asc" }],
      take: pageSize + 1,
      select: partListSelect
    }),
    prisma.part.count({ where: baseWhere })
  ]);
  const pageParts = parts.slice(0, pageSize);
  const valueAttributeIdsByCategoryId = await getValueAttributeIdsByCategoryId({
    workspaceId,
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
        valueAttributeIdsByCategoryId,
        canReadInventory,
        canReadShoppingLists,
        canReadPurchaseOrders
      })
    ),
    nextCursor:
      parts.length > pageSize && lastPart && lastPart[field] != null
        ? encodeListCursor<DecimalFieldCursor>({
            value: lastPart[field]!.toString(),
            id: lastPart.id
          })
        : null,
    totalCount,
    filteredCount
  };
}

async function getSortedPartsListPage({
  baseWhere,
  categoryPathsById,
  cursor,
  pageSize,
  sortBy,
  sortDirection,
  totalCount,
  workspaceId,
  canReadInventory,
  canReadShoppingLists,
  canReadPurchaseOrders
}: {
  baseWhere: Prisma.PartWhereInput;
  categoryPathsById: Map<string, string>;
  cursor?: string | null;
  pageSize: number;
  sortBy: string;
  sortDirection: PartsListSortDirection;
  totalCount: number;
  workspaceId: string;
  canReadInventory: boolean;
  canReadShoppingLists: boolean;
  canReadPurchaseOrders: boolean;
}): Promise<ListPage<PartsListItem>> {
  const [filteredParts, filteredCount] = await Promise.all([
    prisma.part.findMany({
      where: baseWhere,
      orderBy: [{ id: "asc" }],
      select: partListSelect
    }),
    prisma.part.count({ where: baseWhere })
  ]);
  const valueAttributeIdsByCategoryId = await getValueAttributeIdsByCategoryId({
    workspaceId,
    categoryIds: filteredParts
      .map((part) => part.primaryCategoryId)
      .filter((categoryId): categoryId is string => Boolean(categoryId))
  });
  const sortableRecords: SortablePartRecord[] = filteredParts.map((part) => {
    const item = mapPartListItem({
      part,
      categoryPathsById,
      valueAttributeIdsByCategoryId,
      canReadInventory,
      canReadShoppingLists,
      canReadPurchaseOrders
    });
    const valueAttributeId = part.primaryCategoryId
      ? valueAttributeIdsByCategoryId.get(part.primaryCategoryId) ?? null
      : null;

    return {
      item,
      part,
      valueAttributeId
    };
  });

  sortableRecords.sort((left, right) => {
    const comparison = comparePartsBySort({
      left,
      right,
      sortBy
    });

    if (comparison !== 0) {
      return sortDirection === "desc" ? -comparison : comparison;
    }

    return left.item.id.localeCompare(right.item.id, "en", {
      sensitivity: "base"
    });
  });

  const sortedCursor = decodeListCursor<SortedPartsCursor>(cursor);
  const offset = sortedCursor?.offset ?? 0;
  const pageItems = sortableRecords.slice(offset, offset + pageSize);
  const nextOffset = offset + pageItems.length;
  const nextCursor =
    nextOffset < sortableRecords.length
      ? encodeListCursor<SortedPartsCursor>({ offset: nextOffset })
      : null;

  return {
    items: pageItems.map((record) => record.item),
    nextCursor,
    totalCount,
    filteredCount
  };
}

function comparePartsBySort({
  left,
  right,
  sortBy
}: {
  left: SortablePartRecord;
  right: SortablePartRecord;
  sortBy: string;
}) {
  if (sortBy === "categories") {
    return compareText(left.item.primaryCategoryPath ?? "", right.item.primaryCategoryPath ?? "");
  }

  if (sortBy === "manufacturerName") {
    return compareText(left.item.manufacturerName, right.item.manufacturerName);
  }

  if (sortBy === "catalogNumber") {
    return compareText(left.item.catalogNumber, right.item.catalogNumber);
  }

  if (sortBy === "description") {
    return compareText(left.item.description ?? "", right.item.description ?? "");
  }

  if (sortBy === "valueDisplayValue") {
    const leftValue = getSortableValueForAttribute(left.part, left.valueAttributeId);
    const rightValue = getSortableValueForAttribute(right.part, right.valueAttributeId);

    return compareSortableValues(leftValue, rightValue);
  }

  if (sortBy === "currentStock") {
    const leftValue = Number(left.part.currentStock);
    const rightValue = Number(right.part.currentStock);
    return leftValue === rightValue ? 0 : leftValue < rightValue ? -1 : 1;
  }

  if (sortBy === "plannedQuantity") {
    const leftValue = Number(left.part.plannedQty);
    const rightValue = Number(right.part.plannedQty);
    return leftValue === rightValue ? 0 : leftValue < rightValue ? -1 : 1;
  }

  if (sortBy === "onOrderQuantity") {
    const leftValue = Number(left.part.onOrderQty);
    const rightValue = Number(right.part.onOrderQty);
    return leftValue === rightValue ? 0 : leftValue < rightValue ? -1 : 1;
  }

  if (sortBy.startsWith("attribute:")) {
    const attributeId = sortBy.replace("attribute:", "");
    const leftValue = getSortableValueForAttribute(left.part, attributeId);
    const rightValue = getSortableValueForAttribute(right.part, attributeId);

    return compareSortableValues(leftValue, rightValue);
  }

  return 0;
}

type SortableValue =
  | { kind: "quantity"; value: number }
  | { kind: "number"; value: number }
  | { kind: "text"; value: string }
  | null;

function getSortableValueForAttribute(
  part: SelectedPartListItem,
  attributeId: string | null
): SortableValue {
  if (!attributeId) {
    return null;
  }

  const attributeValue = part.attributeValues.find(
    (value) => value.attributeId === attributeId
  );

  if (!attributeValue) {
    return null;
  }

  if (attributeValue.quantityBaseValue !== null) {
    return {
      kind: "quantity",
      value: Number(attributeValue.quantityBaseValue)
    };
  }

  if (attributeValue.numberValue !== null) {
    return {
      kind: "number",
      value: Number(attributeValue.numberValue)
    };
  }

  return {
    kind: "text",
    value: attributeValue.displayValue ?? ""
  };
}

function compareSortableValues(left: SortableValue, right: SortableValue) {
  if (left === null && right === null) {
    return 0;
  }

  if (left === null) {
    return 1;
  }

  if (right === null) {
    return -1;
  }

  if ((left.kind === "quantity" || left.kind === "number") && right.kind === left.kind) {
    if (left.value < right.value) {
      return -1;
    }
    if (left.value > right.value) {
      return 1;
    }
    return 0;
  }

  if (left.kind === "text" && right.kind === "text") {
    return compareText(left.value, right.value);
  }

  return compareText(String(left.value), String(right.value));
}

function compareText(left: string, right: string) {
  return left.localeCompare(right, "en", {
    sensitivity: "base",
    numeric: true
  });
}

function mapPartListItem({
  part,
  categoryPathsById,
  valueAttributeIdsByCategoryId,
  canReadInventory,
  canReadShoppingLists,
  canReadPurchaseOrders
}: {
  part: SelectedPartListItem;
  categoryPathsById: Map<string, string>;
  valueAttributeIdsByCategoryId: Map<string, string | null>;
  canReadInventory: boolean;
  canReadShoppingLists: boolean;
  canReadPurchaseOrders: boolean;
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
    unitId: part.unitId,
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
    currentStock: canReadInventory ? part.currentStock.toString() : null,
    plannedQuantity: canReadShoppingLists ? part.plannedQty.toString() : null,
    onOrderQuantity: canReadPurchaseOrders ? part.onOrderQty.toString() : null,
    avgNetCost: canReadPurchaseOrders
      ? (part.avgNetCostPrimary?.toDecimalPlaces(4).toString() ?? null)
      : null,
    avgGrossCost: canReadPurchaseOrders
      ? (part.avgGrossCostPrimary?.toDecimalPlaces(4).toString() ?? null)
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

function getDecimalFieldCursorWhere({
  field,
  cursor,
  sortDirection
}: {
  field: "currentStock" | "plannedQty" | "onOrderQty" | "avgNetCostPrimary" | "avgGrossCostPrimary";
  cursor: DecimalFieldCursor;
  sortDirection: PartsListSortDirection;
}): Prisma.PartWhereInput {
  const decimalValue = new Prisma.Decimal(cursor.value);

  if (sortDirection === "desc") {
    return {
      OR: [
        { [field]: { lt: decimalValue } },
        { [field]: decimalValue, id: { gt: cursor.id } }
      ]
    };
  }

  return {
    OR: [
      { [field]: { gt: decimalValue } },
      { [field]: decimalValue, id: { gt: cursor.id } }
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
