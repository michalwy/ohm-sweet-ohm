import "server-only";

import { Prisma, type PrismaClient } from "@/generated/prisma/client";
import { prisma } from "@/server/db/prisma";
import {
  decodeListCursor,
  encodeListCursor,
  getListPageSize,
  type ListPage
} from "@/server/pagination";

type PrismaTransaction = Omit<
  PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$extends"
>;

export type UnitListItem = {
  id: string;
  name: string;
  symbol: string;
  allowsFraction: boolean;
};

const unitListSelect = {
  id: true,
  name: true,
  symbol: true,
  allowsFraction: true
} satisfies Prisma.UnitSelect;

export async function getWorkspaceUnits(workspaceId: string) {
  return prisma.unit.findMany({
    where: {
      workspaceId
    },
    orderBy: [{ name: "asc" }, { id: "asc" }],
    select: unitListSelect
  });
}

export type UnitListSortField = "name" | "symbol" | "allowsFraction";

type UnitsOffsetCursor = {
  offset: number;
};

export async function getUnitsPageForWorkspace({
  workspaceId,
  cursor,
  pageSize,
  sortBy = "name",
  sortDir = "asc"
}: {
  workspaceId: string;
  cursor?: string | null;
  pageSize?: number | null;
  sortBy?: UnitListSortField;
  sortDir?: "asc" | "desc";
}): Promise<ListPage<UnitListItem>> {
  const resolvedPageSize = getListPageSize(pageSize);
  const dir = sortDir === "desc" ? "desc" : "asc";
  const units = await prisma.unit.findMany({
    where: { workspaceId },
    select: unitListSelect
  });
  const totalCount = units.length;

  const sorted = [...units].sort((left, right) => {
    const comparison = compareUnitsBySort(left, right, sortBy);
    if (comparison !== 0) {
      return dir === "desc" ? -comparison : comparison;
    }
    return compareListText(left.id, right.id);
  });

  const decoded = decodeListCursor<UnitsOffsetCursor>(cursor);
  const offset = decoded?.offset ?? 0;
  const items = sorted.slice(offset, offset + resolvedPageSize);
  const nextOffset = offset + items.length;

  return {
    items,
    nextCursor:
      nextOffset < sorted.length
        ? encodeListCursor<UnitsOffsetCursor>({ offset: nextOffset })
        : null,
    totalCount,
    filteredCount: totalCount
  };
}

function compareUnitsBySort(
  left: UnitListItem,
  right: UnitListItem,
  sortBy: UnitListSortField
) {
  if (sortBy === "symbol") {
    return compareListText(left.symbol, right.symbol);
  }
  if (sortBy === "allowsFraction") {
    return Number(left.allowsFraction) - Number(right.allowsFraction);
  }
  return compareListText(left.name, right.name);
}

function compareListText(left: string, right: string) {
  return left.localeCompare(right, "en", {
    sensitivity: "base",
    numeric: true
  });
}

export async function createUnit(input: {
  workspaceId: string;
  name: string;
  symbol: string;
  allowsFraction: boolean;
}) {
  return prisma.unit.create({
    data: {
      workspaceId: input.workspaceId,
      name: input.name.trim(),
      normalizedName: normalizeUnitName(input.name),
      symbol: input.symbol.trim(),
      allowsFraction: input.allowsFraction
    },
    select: unitListSelect
  });
}

export async function updateUnit(input: {
  workspaceId: string;
  unitId: string;
  name: string;
  symbol: string;
  allowsFraction: boolean;
}) {
  const updated = await prisma.unit.updateMany({
    where: {
      id: input.unitId,
      workspaceId: input.workspaceId
    },
    data: {
      name: input.name.trim(),
      normalizedName: normalizeUnitName(input.name),
      symbol: input.symbol.trim(),
      allowsFraction: input.allowsFraction
    }
  });

  if (updated.count === 0) {
    throw new Error("unit-not-found");
  }

  return prisma.unit.findUniqueOrThrow({
    where: {
      id: input.unitId
    },
    select: unitListSelect
  });
}

export async function deleteUnit(input: {
  workspaceId: string;
  unitId: string;
}) {
  const tx = prisma as PrismaTransaction;
  const deleted = await tx.unit.deleteMany({
    where: {
      id: input.unitId,
      workspaceId: input.workspaceId
    }
  });

  if (deleted.count === 0) {
    throw new Error("unit-not-found");
  }
}

function normalizeUnitName(value: string) {
  return value.trim().toLocaleLowerCase("en").replace(/\s+/g, " ");
}
