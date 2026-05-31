import type { Prisma, PrismaClient } from "@/generated/prisma/client";

type DatabaseClient = PrismaClient | Prisma.TransactionClient;

const DEFAULT_UNITS = [
  { name: "Pieces", normalizedName: "pieces", symbol: "pcs", allowsFraction: false },
  { name: "Meters", normalizedName: "meters", symbol: "m", allowsFraction: true },
  { name: "Liters", normalizedName: "liters", symbol: "L", allowsFraction: true }
] as const;

export const DEFAULT_PART_UNIT_NORMALIZED_NAME = "pieces";

export async function ensureDefaultUnitsForWorkspace(
  tx: DatabaseClient,
  workspaceId: string
) {
  for (const unit of DEFAULT_UNITS) {
    await tx.unit.upsert({
      where: {
        workspaceId_normalizedName: {
          workspaceId,
          normalizedName: unit.normalizedName
        }
      },
      update: {
        name: unit.name,
        symbol: unit.symbol,
        allowsFraction: unit.allowsFraction
      },
      create: {
        workspaceId,
        name: unit.name,
        normalizedName: unit.normalizedName,
        symbol: unit.symbol,
        allowsFraction: unit.allowsFraction
      }
    });
  }
}

export async function getDefaultPartUnitId(
  tx: DatabaseClient,
  workspaceId: string
) {
  const unit = await tx.unit.findUnique({
    where: {
      workspaceId_normalizedName: {
        workspaceId,
        normalizedName: DEFAULT_PART_UNIT_NORMALIZED_NAME
      }
    },
    select: {
      id: true
    }
  });

  if (unit) {
    return unit.id;
  }

  await ensureDefaultUnitsForWorkspace(tx, workspaceId);

  const fallbackUnit = await tx.unit.findUniqueOrThrow({
    where: {
      workspaceId_normalizedName: {
        workspaceId,
        normalizedName: DEFAULT_PART_UNIT_NORMALIZED_NAME
      }
    },
    select: {
      id: true
    }
  });

  return fallbackUnit.id;
}
