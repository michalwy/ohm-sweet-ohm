import "server-only";

import { Prisma, type PrismaClient } from "@/generated/prisma/client";
import { prisma } from "@/server/db/prisma";

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
    throw new Error("unit_not_found");
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
    throw new Error("unit_not_found");
  }
}

function normalizeUnitName(value: string) {
  return value.trim().toLocaleLowerCase("en").replace(/\s+/g, " ");
}
