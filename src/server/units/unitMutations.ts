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
  const dir: Prisma.SortOrder = sortDir === "desc" ? "desc" : "asc";
  const offset = decodeListCursor<UnitsOffsetCursor>(cursor)?.offset ?? 0;
  const where: Prisma.UnitWhereInput = { workspaceId };

  const [items, totalCount] = await Promise.all([
    prisma.unit.findMany({
      where,
      orderBy: [{ [sortBy]: dir }, { id: dir }],
      skip: offset,
      take: resolvedPageSize,
      select: unitListSelect
    }),
    prisma.unit.count({ where })
  ]);
  const nextOffset = offset + items.length;

  return {
    items,
    nextCursor:
      nextOffset < totalCount
        ? encodeListCursor<UnitsOffsetCursor>({ offset: nextOffset })
        : null,
    totalCount,
    filteredCount: totalCount
  };
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
