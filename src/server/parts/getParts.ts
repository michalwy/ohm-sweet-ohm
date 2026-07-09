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
  unitId: string;
  catalogNumber: string;
  description: string | null;
  manufacturerName: string;
  isAssembled: boolean;
  valueDisplayValue: string | null;
  primaryCategoryId: string | null;
  primaryCategoryPath: string | null;
  secondaryCategoryId: string | null;
  secondaryCategoryPath: string | null;
  defaultLocationId: string | null;
  defaultLocationName: string | null;
  currentStock: string | null;
  reservedQuantity: string | null;
  allocatedQuantity: string | null;
  availableQuantity: string | null;
  balanceQuantity: string | null;
  plannedQuantity: string | null;
  onOrderQuantity: string | null;
  inProductionQuantity: string | null;
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
  pinnedId?: string | null;
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
  value: string | null;
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

  if (input.pinnedId) {
    const part = await prisma.part.findFirst({
      where: { id: input.pinnedId, workspaceId: context.workspace.id },
      select: partListSelect
    });
    if (!part) {
      return { items: [], nextCursor: null, totalCount, filteredCount: 0 };
    }
    const valueAttributeIdsByCategoryId = await getValueAttributeIdsByCategoryId({
      workspaceId: context.workspace.id,
      categoryIds: part.primaryCategoryId ? [part.primaryCategoryId] : []
    });
    return {
      items: [mapPartListItem({ part, categoryPathsById, valueAttributeIdsByCategoryId })],
      nextCursor: null,
      totalCount,
      filteredCount: 1
    };
  }

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
  const activeSortBy = input.sortBy?.trim() ?? "";
  const activeSortDirection: PartsListSortDirection =
    input.sortDirection === "desc" ? "desc" : "asc";

  let page: ListPage<PartsListItem>;

  if (activeSortBy === "currentStock") {
    page = await getDecimalFieldSortedPartsListPage({
      field: "currentStock",
      baseWhere,
      categoryPathsById,
      cursor: input.cursor,
      pageSize,
      sortDirection: activeSortDirection,
      totalCount,
      workspaceId: context.workspace.id,
    });
  } else if (activeSortBy === "reservedQuantity") {
    page = await getDecimalFieldSortedPartsListPage({
      field: "reservedQty",
      baseWhere,
      categoryPathsById,
      cursor: input.cursor,
      pageSize,
      sortDirection: activeSortDirection,
      totalCount,
      workspaceId: context.workspace.id,
    });
  } else if (activeSortBy === "allocatedQuantity") {
    page = await getDecimalFieldSortedPartsListPage({
      field: "allocatedQty",
      baseWhere,
      categoryPathsById,
      cursor: input.cursor,
      pageSize,
      sortDirection: activeSortDirection,
      totalCount,
      workspaceId: context.workspace.id,
    });
  } else if (activeSortBy === "availableQuantity") {
    page = await getDecimalFieldSortedPartsListPage({
      field: "availableQty",
      baseWhere,
      categoryPathsById,
      cursor: input.cursor,
      pageSize,
      sortDirection: activeSortDirection,
      totalCount,
      workspaceId: context.workspace.id,
    });
  } else if (activeSortBy === "balanceQuantity") {
    page = await getDecimalFieldSortedPartsListPage({
      field: "balanceQty",
      baseWhere,
      categoryPathsById,
      cursor: input.cursor,
      pageSize,
      sortDirection: activeSortDirection,
      totalCount,
      workspaceId: context.workspace.id,
    });
  } else if (activeSortBy === "plannedQuantity") {
    page = await getDecimalFieldSortedPartsListPage({
      field: "plannedQty",
      baseWhere,
      categoryPathsById,
      cursor: input.cursor,
      pageSize,
      sortDirection: activeSortDirection,
      totalCount,
      workspaceId: context.workspace.id,
    });
  } else if (activeSortBy === "onOrderQuantity") {
    page = await getDecimalFieldSortedPartsListPage({
      field: "onOrderQty",
      baseWhere,
      categoryPathsById,
      cursor: input.cursor,
      pageSize,
      sortDirection: activeSortDirection,
      totalCount,
      workspaceId: context.workspace.id,
    });
  } else if (activeSortBy === "inProductionQuantity") {
    page = await getDecimalFieldSortedPartsListPage({
      field: "inProductionQty",
      baseWhere,
      categoryPathsById,
      cursor: input.cursor,
      pageSize,
      sortDirection: activeSortDirection,
      totalCount,
      workspaceId: context.workspace.id,
    });
  } else if (activeSortBy === "avgNetCost") {
    page = await getDecimalFieldSortedPartsListPage({
      field: "avgNetCostPrimary",
      baseWhere,
      categoryPathsById,
      cursor: input.cursor,
      pageSize,
      sortDirection: activeSortDirection,
      totalCount,
      workspaceId: context.workspace.id,
    });
  } else if (activeSortBy === "avgGrossCost") {
    page = await getDecimalFieldSortedPartsListPage({
      field: "avgGrossCostPrimary",
      baseWhere,
      categoryPathsById,
      cursor: input.cursor,
      pageSize,
      sortDirection: activeSortDirection,
      totalCount,
      workspaceId: context.workspace.id,
    });
  } else if (
    activeSortBy === "manufacturerName" ||
    activeSortBy === "catalogNumber" ||
    activeSortBy === "description"
  ) {
    page = await getStringFieldSortedPartsListPage({
      field: activeSortBy,
      baseWhere,
      categoryPathsById,
      cursor: input.cursor,
      pageSize,
      sortDirection: activeSortDirection,
      totalCount,
      workspaceId: context.workspace.id,
    });
  } else if (activeSortBy === "categories") {
    page = await getStringFieldSortedPartsListPage({
      field: "categories",
      baseWhere,
      categoryPathsById,
      cursor: input.cursor,
      pageSize,
      sortDirection: activeSortDirection,
      totalCount,
      workspaceId: context.workspace.id,
    });
  } else if (activeSortBy === "valueDisplayValue") {
    page = await getDecimalFieldSortedPartsListPage({
      field: "valueSortNumber",
      baseWhere,
      categoryPathsById,
      cursor: input.cursor,
      pageSize,
      sortDirection: activeSortDirection,
      totalCount,
      workspaceId: context.workspace.id,
    });
  } else if (activeSortBy.startsWith("attribute:")) {
    const attributeId = activeSortBy.slice("attribute:".length);
    page = await getAttributeFieldSortedPartsListPage({
      attributeId,
      baseWhere,
      categoryPathsById,
      cursor: input.cursor,
      pageSize,
      sortDirection: activeSortDirection,
      totalCount,
      workspaceId: context.workspace.id,
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
  reservedQty: true,
  allocatedQty: true,
  availableQty: true,
  balanceQty: true,
  plannedQty: true,
  onOrderQty: true,
  inProductionQty: true,
  avgNetCostPrimary: true,
  avgGrossCostPrimary: true,
  valueSortNumber: true,
  manufacturer: {
    select: {
      name: true,
      isInternal: true
    }
  },
  assembledByDesign: {
    select: { id: true }
  },
  primaryCategoryId: true,
  primaryCategory: { select: { sortPath: true } },
  secondaryCategoryId: true,
  defaultLocation: {
    select: {
      id: true,
      name: true
    }
  },
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


async function getDecimalFieldSortedPartsListPage({
  field,
  baseWhere,
  categoryPathsById,
  cursor,
  pageSize,
  sortDirection,
  totalCount,
  workspaceId,
}: {
  field:
    | "currentStock"
    | "reservedQty"
    | "allocatedQty"
    | "availableQty"
    | "balanceQty"
    | "plannedQty"
    | "onOrderQty"
    | "inProductionQty"
    | "avgNetCostPrimary"
    | "avgGrossCostPrimary"
    | "valueSortNumber";
  baseWhere: Prisma.PartWhereInput;
  categoryPathsById: Map<string, string>;
  cursor?: string | null;
  pageSize: number;
  sortDirection: PartsListSortDirection;
  totalCount: number;
  workspaceId: string;
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
      })
    ),
    nextCursor:
      parts.length > pageSize && lastPart
        ? encodeListCursor<DecimalFieldCursor>({
            // Non-nullable fields always produce a string here. Nullable fields
            // (avgNetCostPrimary, avgGrossCostPrimary, valueSortNumber) may produce
            // null when the last page part has no value, which getDecimalFieldCursorWhere
            // handles via the isNullable path (NULLS LAST tail).
            value: lastPart[field]?.toString() ?? null,
            id: lastPart.id
          })
        : null,
    totalCount,
    filteredCount
  };
}

type StringSortField = "manufacturerName" | "catalogNumber" | "description" | "categories";

type StringFieldCursor = {
  value: string | null;
  id: string;
};

async function getStringFieldSortedPartsListPage({
  field,
  baseWhere,
  categoryPathsById,
  cursor,
  pageSize,
  sortDirection,
  totalCount,
  workspaceId,
}: {
  field: StringSortField;
  baseWhere: Prisma.PartWhereInput;
  categoryPathsById: Map<string, string>;
  cursor?: string | null;
  pageSize: number;
  sortDirection: PartsListSortDirection;
  totalCount: number;
  workspaceId: string;
}): Promise<ListPage<PartsListItem>> {
  const decodedCursor = decodeListCursor<StringFieldCursor>(cursor);
  const cursorWhere = decodedCursor
    ? getStringFieldCursorWhere({ field, cursor: decodedCursor, sortDirection })
    : null;
  const where = cursorWhere ? { AND: [baseWhere, cursorWhere] } : baseWhere;
  const [parts, filteredCount] = await Promise.all([
    prisma.part.findMany({
      where,
      orderBy: getStringFieldOrderBy({ field, sortDirection }),
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
      })
    ),
    nextCursor:
      parts.length > pageSize && lastPart
        ? encodeListCursor<StringFieldCursor>({
            value: getStringFieldValue(lastPart, field),
            id: lastPart.id
          })
        : null,
    totalCount,
    filteredCount
  };
}

function getStringFieldOrderBy({
  field,
  sortDirection
}: {
  field: StringSortField;
  sortDirection: PartsListSortDirection;
}): Prisma.PartOrderByWithRelationInput[] {
  const tiebreak: Prisma.PartOrderByWithRelationInput = { id: "asc" };

  switch (field) {
    case "manufacturerName":
      return [{ manufacturer: { name: sortDirection } }, tiebreak];
    case "catalogNumber":
      return [{ catalogNumber: sortDirection }, tiebreak];
    // Nullable column: keep parts without a description grouped at the end
    // regardless of direction so keyset pagination stays consistent.
    case "description":
      return [{ description: { sort: sortDirection, nulls: "last" } }, tiebreak];
    // Nullable via optional relation: parts with no primary category or null sortPath sort last.
    case "categories":
      return [
        { primaryCategory: { sortPath: { sort: sortDirection, nulls: "last" } } },
        tiebreak
      ];
  }
}

function getStringFieldValue(part: SelectedPartListItem, field: StringSortField) {
  switch (field) {
    case "manufacturerName":
      return part.manufacturer.name;
    case "catalogNumber":
      return part.catalogNumber;
    case "description":
      return part.description;
    case "categories":
      return part.primaryCategory?.sortPath ?? null;
  }
}

function getStringFieldCursorWhere({
  field,
  cursor,
  sortDirection
}: {
  field: StringSortField;
  cursor: StringFieldCursor;
  sortDirection: PartsListSortDirection;
}): Prisma.PartWhereInput {
  const op = sortDirection === "desc" ? "lt" : "gt";

  if (field === "manufacturerName") {
    const value = cursor.value ?? "";
    return {
      OR: [
        { manufacturer: { name: { [op]: value } } },
        { manufacturer: { name: value }, id: { gt: cursor.id } }
      ]
    };
  }

  if (field === "catalogNumber") {
    const value = cursor.value ?? "";
    return {
      OR: [
        { catalogNumber: { [op]: value } },
        { catalogNumber: value, id: { gt: cursor.id } }
      ]
    };
  }

  // description is nullable and ordered NULLS LAST in both directions.
  if (field === "description") {
    if (cursor.value === null) {
      // Already inside the trailing block of null descriptions: page by id only.
      return { description: null, id: { gt: cursor.id } };
    }

    return {
      OR: [
        { description: { [op]: cursor.value } },
        { description: cursor.value, id: { gt: cursor.id } },
        // All null-description rows sort after any non-null value.
        { description: null }
      ]
    };
  }

  // categories sorts by primaryCategory.sortPath NULLS LAST.
  // Parts with no primary category, or a primary category with null sortPath, sort last.
  if (cursor.value === null) {
    // Already in the null-sortPath tail; page by id only.
    return {
      OR: [
        { primaryCategoryId: null },
        { primaryCategory: { sortPath: null }, id: { gt: cursor.id } }
      ]
    };
  }

  return {
    OR: [
      { primaryCategory: { sortPath: { [op]: cursor.value } } },
      { primaryCategory: { sortPath: cursor.value }, id: { gt: cursor.id } },
      { primaryCategoryId: null },
      { primaryCategory: { sortPath: null } }
    ]
  };
}

type AttributeSortCursor = {
  value: string | null;
  id: string;
};

async function getAttributeFieldSortedPartsListPage({
  attributeId,
  baseWhere,
  categoryPathsById,
  cursor,
  pageSize,
  sortDirection,
  totalCount,
  workspaceId,
}: {
  attributeId: string;
  baseWhere: Prisma.PartWhereInput;
  categoryPathsById: Map<string, string>;
  cursor?: string | null;
  pageSize: number;
  sortDirection: PartsListSortDirection;
  totalCount: number;
  workspaceId: string;
}): Promise<ListPage<PartsListItem>> {
  const attribute = await prisma.attribute.findFirst({
    where: { id: attributeId, workspaceId },
    select: { type: true }
  });

  if (!attribute) {
    return {
      items: [],
      nextCursor: null,
      totalCount,
      filteredCount: 0
    };
  }

  const sortCol =
    attribute.type === "QUANTITY"
      ? "quantityBaseValue"
      : attribute.type === "NUMBER"
        ? "numberValue"
        : "displayValue";

  const [filteredIds, filteredCount] = await Promise.all([
    prisma.part.findMany({ where: baseWhere, select: { id: true }, orderBy: [{ id: "asc" }] }),
    prisma.part.count({ where: baseWhere })
  ]);

  const ids = filteredIds.map((p) => p.id);

  const decodedCursor = decodeListCursor<AttributeSortCursor>(cursor);

  type RawRow = { id: string; sort_val: string | null };

  let rows: RawRow[];

  if (ids.length === 0) {
    rows = [];
  } else if (sortCol === "quantityBaseValue" || sortCol === "numberValue") {
    const colSql = Prisma.raw(`pav."${sortCol}"`);
    const dirSql = Prisma.raw(sortDirection === "desc" ? "DESC" : "ASC");

    if (!decodedCursor) {
      rows = await prisma.$queryRaw<RawRow[]>`
        SELECT p.id, ${colSql}::text AS sort_val
        FROM "Part" p
        LEFT JOIN "PartAttributeValue" pav
          ON pav."partId" = p.id AND pav."attributeId" = ${attributeId}
        WHERE p.id = ANY(${ids})
        ORDER BY ${colSql} ${dirSql} NULLS LAST, p.id ASC
        LIMIT ${pageSize + 1}
      `;
    } else if (decodedCursor.value === null) {
      rows = await prisma.$queryRaw<RawRow[]>`
        SELECT p.id, ${colSql}::text AS sort_val
        FROM "Part" p
        LEFT JOIN "PartAttributeValue" pav
          ON pav."partId" = p.id AND pav."attributeId" = ${attributeId}
        WHERE p.id = ANY(${ids})
          AND ${colSql} IS NULL
          AND p.id > ${decodedCursor.id}
        ORDER BY p.id ASC
        LIMIT ${pageSize + 1}
      `;
    } else {
      const cursorVal = new Prisma.Decimal(decodedCursor.value);
      if (sortDirection === "asc") {
        rows = await prisma.$queryRaw<RawRow[]>`
          SELECT p.id, ${colSql}::text AS sort_val
          FROM "Part" p
          LEFT JOIN "PartAttributeValue" pav
            ON pav."partId" = p.id AND pav."attributeId" = ${attributeId}
          WHERE p.id = ANY(${ids})
            AND (
              ${colSql} > ${cursorVal}
              OR (${colSql} = ${cursorVal} AND p.id > ${decodedCursor.id})
              OR ${colSql} IS NULL
            )
          ORDER BY ${colSql} ASC NULLS LAST, p.id ASC
          LIMIT ${pageSize + 1}
        `;
      } else {
        rows = await prisma.$queryRaw<RawRow[]>`
          SELECT p.id, ${colSql}::text AS sort_val
          FROM "Part" p
          LEFT JOIN "PartAttributeValue" pav
            ON pav."partId" = p.id AND pav."attributeId" = ${attributeId}
          WHERE p.id = ANY(${ids})
            AND (
              ${colSql} < ${cursorVal}
              OR (${colSql} = ${cursorVal} AND p.id > ${decodedCursor.id})
              OR ${colSql} IS NULL
            )
          ORDER BY ${colSql} DESC NULLS LAST, p.id ASC
          LIMIT ${pageSize + 1}
        `;
      }
    }
  } else {
    // TEXT / CHOICE / BOOLEAN: sort by displayValue as text
    const colSql = Prisma.raw(`pav."displayValue"`);
    const dirSql = Prisma.raw(sortDirection === "desc" ? "DESC" : "ASC");

    if (!decodedCursor) {
      rows = await prisma.$queryRaw<RawRow[]>`
        SELECT p.id, ${colSql} AS sort_val
        FROM "Part" p
        LEFT JOIN "PartAttributeValue" pav
          ON pav."partId" = p.id AND pav."attributeId" = ${attributeId}
        WHERE p.id = ANY(${ids})
        ORDER BY ${colSql} ${dirSql} NULLS LAST, p.id ASC
        LIMIT ${pageSize + 1}
      `;
    } else if (decodedCursor.value === null) {
      rows = await prisma.$queryRaw<RawRow[]>`
        SELECT p.id, ${colSql} AS sort_val
        FROM "Part" p
        LEFT JOIN "PartAttributeValue" pav
          ON pav."partId" = p.id AND pav."attributeId" = ${attributeId}
        WHERE p.id = ANY(${ids})
          AND ${colSql} IS NULL
          AND p.id > ${decodedCursor.id}
        ORDER BY p.id ASC
        LIMIT ${pageSize + 1}
      `;
    } else {
      const cv = decodedCursor.value;
      if (sortDirection === "asc") {
        rows = await prisma.$queryRaw<RawRow[]>`
          SELECT p.id, ${colSql} AS sort_val
          FROM "Part" p
          LEFT JOIN "PartAttributeValue" pav
            ON pav."partId" = p.id AND pav."attributeId" = ${attributeId}
          WHERE p.id = ANY(${ids})
            AND (
              ${colSql} > ${cv}
              OR (${colSql} = ${cv} AND p.id > ${decodedCursor.id})
              OR ${colSql} IS NULL
            )
          ORDER BY ${colSql} ASC NULLS LAST, p.id ASC
          LIMIT ${pageSize + 1}
        `;
      } else {
        rows = await prisma.$queryRaw<RawRow[]>`
          SELECT p.id, ${colSql} AS sort_val
          FROM "Part" p
          LEFT JOIN "PartAttributeValue" pav
            ON pav."partId" = p.id AND pav."attributeId" = ${attributeId}
          WHERE p.id = ANY(${ids})
            AND (
              ${colSql} < ${cv}
              OR (${colSql} = ${cv} AND p.id > ${decodedCursor.id})
              OR ${colSql} IS NULL
            )
          ORDER BY ${colSql} DESC NULLS LAST, p.id ASC
          LIMIT ${pageSize + 1}
        `;
      }
    }
  }

  const pageRows = rows.slice(0, pageSize);
  const pageIds = pageRows.map((r) => r.id);

  const pageParts = await prisma.part.findMany({
    where: { id: { in: pageIds } },
    select: partListSelect
  });

  // Restore the sort order returned by raw SQL (Prisma IN doesn't preserve order)
  const orderMap = new Map(pageIds.map((id, i) => [id, i]));
  const orderedParts = [...pageParts].sort(
    (a, b) => (orderMap.get(a.id) ?? 0) - (orderMap.get(b.id) ?? 0)
  );

  const valueAttributeIdsByCategoryId = await getValueAttributeIdsByCategoryId({
    workspaceId,
    categoryIds: orderedParts
      .map((part) => part.primaryCategoryId)
      .filter((id): id is string => Boolean(id))
  });

  const lastRow = pageRows.at(-1);

  return {
    items: orderedParts.map((part) =>
      mapPartListItem({ part, categoryPathsById, valueAttributeIdsByCategoryId })
    ),
    nextCursor:
      rows.length > pageSize && lastRow
        ? encodeListCursor<AttributeSortCursor>({
            value: lastRow.sort_val,
            id: lastRow.id
          })
        : null,
    totalCount,
    filteredCount
  };
}

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
    unitId: part.unitId,
    catalogNumber: part.catalogNumber,
    description: part.description,
    manufacturerName: part.manufacturer.name,
    isAssembled: part.assembledByDesign !== null,
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
    defaultLocationId: part.defaultLocation?.id ?? null,
    defaultLocationName: part.defaultLocation?.name ?? null,
    currentStock: part.currentStock.toString(),
    reservedQuantity: part.reservedQty.toString(),
    allocatedQuantity: part.allocatedQty.toString(),
    availableQuantity: part.availableQty.toString(),
    balanceQuantity: part.balanceQty.toString(),
    plannedQuantity: part.plannedQty.toString(),
    onOrderQuantity: part.onOrderQty.toString(),
    inProductionQuantity: part.inProductionQty.toString(),
    avgNetCost: part.avgNetCostPrimary?.toDecimalPlaces(2).toFixed(2) ?? null,
    avgGrossCost: part.avgGrossCostPrimary?.toDecimalPlaces(2).toFixed(2) ?? null,
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
  field:
    | "currentStock"
    | "reservedQty"
    | "allocatedQty"
    | "availableQty"
    | "balanceQty"
    | "plannedQty"
    | "onOrderQty"
    | "inProductionQty"
    | "avgNetCostPrimary"
    | "avgGrossCostPrimary"
    | "valueSortNumber";
  cursor: DecimalFieldCursor;
  sortDirection: PartsListSortDirection;
}): Prisma.PartWhereInput {
  // Only these fields are nullable Decimals; others have NOT NULL constraints.
  const isNullable =
    field === "avgNetCostPrimary" ||
    field === "avgGrossCostPrimary" ||
    field === "valueSortNumber";

  // Null values sort last in both directions (nullable fields only).
  if (cursor.value === null && isNullable) {
    // Already in the null-value tail; page by id only.
    return { [field]: null, id: { gt: cursor.id } };
  }

  const decimalValue = new Prisma.Decimal(cursor.value ?? "0");

  if (sortDirection === "desc") {
    return {
      OR: [
        { [field]: { lt: decimalValue } },
        { [field]: decimalValue, id: { gt: cursor.id } },
        // Null values always sort after any non-null value (nullable fields only)
        ...(isNullable ? [{ [field]: null } as Prisma.PartWhereInput] : [])
      ]
    };
  }

  return {
    OR: [
      { [field]: { gt: decimalValue } },
      { [field]: decimalValue, id: { gt: cursor.id } },
      // Null values always sort after any non-null value (nullable fields only)
      ...(isNullable ? [{ [field]: null } as Prisma.PartWhereInput] : [])
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
