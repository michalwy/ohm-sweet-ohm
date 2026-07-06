import type { Prisma, PrismaClient } from "@/generated/prisma/client";

type DatabaseClient = PrismaClient | Prisma.TransactionClient;

const DEFAULT_UNITS = [
  { name: "Pieces", normalizedName: "pieces", symbol: "pcs", allowsFraction: false },
  { name: "Meters", normalizedName: "meters", symbol: "m", allowsFraction: true },
  { name: "Liters", normalizedName: "liters", symbol: "L", allowsFraction: true }
] as const;

export const DEFAULT_PART_UNIT_NORMALIZED_NAME = "pieces";

const STARTER_DICTIONARY_UNITS = [
  { name: "Grams", normalizedName: "grams", symbol: "g", allowsFraction: true },
  { name: "Rolls", normalizedName: "rolls", symbol: "rolls", allowsFraction: false },
  { name: "Boxes", normalizedName: "boxes", symbol: "boxes", allowsFraction: false },
  { name: "Sets", normalizedName: "sets", symbol: "sets", allowsFraction: false }
] as const;

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

export async function ensureStarterDictionaryUnitsForWorkspace(
  tx: DatabaseClient,
  workspaceId: string
): Promise<number> {
  let unitsCreated = 0;

  for (const unit of STARTER_DICTIONARY_UNITS) {
    const existing = await tx.unit.findUnique({
      where: {
        workspaceId_normalizedName: {
          workspaceId,
          normalizedName: unit.normalizedName
        }
      },
      select: { id: true }
    });

    if (!existing) {
      unitsCreated++;
    }

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

  return unitsCreated;
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
