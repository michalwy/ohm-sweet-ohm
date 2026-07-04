import "server-only";

import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/server/db/prisma";

type InventoryEntryType = "RECEIPT" | "ISSUE" | "TRANSFER" | "ADJUSTMENT";

export type CreateInventoryEntryInput = {
  workspaceId: string;
  partId: string;
  entryType: InventoryEntryType;
  quantity: string;
  fromLocationId?: string | null;
  toLocationId?: string | null;
  note?: string | null;
  createdByUserId?: string | null;
  unitCost?: Prisma.Decimal | null;
  costCurrency?: string | null;
  unitCostPrimary?: Prisma.Decimal | null;
  unitGrossCostPrimary?: Prisma.Decimal | null;
};

export async function createInventoryEntry(input: CreateInventoryEntryInput) {
  return prisma.$transaction((tx) => createInventoryEntryWithinTx(tx, input));
}

/**
 * Core inventory-entry creation usable inside a caller-provided transaction, so a higher-level
 * mutation (e.g. a build assembling a designator) can issue stock and update its own
 * denormalized counters atomically in one transaction. `createInventoryEntry` simply wraps
 * this in `prisma.$transaction`.
 */
export async function createInventoryEntryWithinTx(
  tx: Prisma.TransactionClient,
  input: CreateInventoryEntryInput
) {
  const quantity = parseQuantity(input.quantity);
  const nextEntryShape = {
    fromLocationId: input.fromLocationId ?? null,
    toLocationId: input.toLocationId ?? null
  };

  validateEntryShape(input.entryType, nextEntryShape);

  {
    await lockPartRow(tx, {
      workspaceId: input.workspaceId,
      partId: input.partId
    });

    const part = await tx.part.findFirst({
      where: {
        id: input.partId,
        workspaceId: input.workspaceId
      },
      select: {
        id: true,
        currentStock: true,
        avgNetCostPrimary: true,
        avgGrossCostPrimary: true,
        unit: {
          select: {
            allowsFraction: true
          }
        }
      }
    });

    if (!part) {
      throw new Error("part-not-found");
    }

    if (!part.unit.allowsFraction && !quantity.isInteger()) {
      throw new Error("fractional-quantity-not-allowed");
    }

    const locations = await getValidatedLocations(tx, {
      workspaceId: input.workspaceId,
      fromLocationId: nextEntryShape.fromLocationId,
      toLocationId: nextEntryShape.toLocationId
    });

    await assertLocationBalanceRules(tx, {
      workspaceId: input.workspaceId,
      partId: input.partId,
      entryType: input.entryType,
      quantity,
      fromLocationId: locations.fromLocationId,
      toLocationId: locations.toLocationId
    });

    const reservationUnitsToRelocate =
      input.entryType === "TRANSFER" && locations.fromLocationId
        ? await computeReservationUnitsToRelocate(tx, {
            workspaceId: input.workspaceId,
            partId: input.partId,
            locationId: locations.fromLocationId,
            transferQuantity: quantity
          })
        : 0;

    const entry = await tx.inventoryEntry.create({
      data: {
        workspaceId: input.workspaceId,
        partId: input.partId,
        entryType: input.entryType,
        quantity,
        fromLocationId: locations.fromLocationId,
        toLocationId: locations.toLocationId,
        note: normalizeOptionalText(input.note ?? null),
        createdByUserId: input.createdByUserId ?? null,
        unitCost: input.unitCost ?? null,
        costCurrency: input.costCurrency ?? null,
        unitCostPrimary: input.unitCostPrimary ?? null,
        unitGrossCostPrimary: input.unitGrossCostPrimary ?? null
      }
    });

    if (reservationUnitsToRelocate > 0 && locations.fromLocationId && locations.toLocationId) {
      await relocateReservationsForTransfer(tx, {
        workspaceId: input.workspaceId,
        partId: input.partId,
        fromLocationId: locations.fromLocationId,
        toLocationId: locations.toLocationId,
        unitsToRelocate: reservationUnitsToRelocate
      });
    }

    const isReceipt = input.entryType === "RECEIPT";
    const stockBefore = new Prisma.Decimal(part.currentStock);
    const newAvgNet = isReceipt
      ? computeMovingAverage(part.avgNetCostPrimary, stockBefore, input.unitCostPrimary ?? null, quantity)
      : undefined;
    const newAvgGross = isReceipt
      ? computeMovingAverage(part.avgGrossCostPrimary, stockBefore, input.unitGrossCostPrimary ?? null, quantity)
      : undefined;

    await tx.part.update({
      where: {
        id: input.partId
      },
      data: {
        currentStock: {
          increment: getPartStockDelta({
            entryType: input.entryType,
            quantity
          })
        },
        ...(newAvgNet !== undefined && { avgNetCostPrimary: newAvgNet }),
        ...(newAvgGross !== undefined && { avgGrossCostPrimary: newAvgGross })
      }
    });

    return entry;
  }
}

export async function getPartLocationBalances(input: {
  workspaceId: string;
  partId: string;
}) {
  return getPartLocationBalancesWithDb(prisma, input);
}

function parseQuantity(rawValue: string) {
  const normalized = rawValue.trim();
  if (!normalized) {
    throw new Error("missing-required-fields");
  }

  let quantity: Prisma.Decimal;
  try {
    quantity = new Prisma.Decimal(normalized);
  } catch {
    throw new Error("invalid-quantity");
  }

  if (quantity.equals(0)) {
    throw new Error("invalid-quantity");
  }

  return quantity;
}

function validateEntryShape(
  entryType: InventoryEntryType,
  locations: { fromLocationId: string | null; toLocationId: string | null }
) {
  if (entryType === "RECEIPT") {
    if (!locations.toLocationId || locations.fromLocationId) {
      throw new Error("invalid-entry-shape");
    }
    return;
  }

  if (entryType === "ISSUE") {
    if (!locations.fromLocationId || locations.toLocationId) {
      throw new Error("invalid-entry-shape");
    }
    return;
  }

  if (entryType === "TRANSFER") {
    if (
      !locations.fromLocationId ||
      !locations.toLocationId ||
      locations.fromLocationId === locations.toLocationId
    ) {
      throw new Error("invalid-entry-shape");
    }
    return;
  }

  if (entryType === "ADJUSTMENT") {
    if (!locations.toLocationId || locations.fromLocationId) {
      throw new Error("invalid-entry-shape");
    }
  }
}

async function getValidatedLocations(
  db: Prisma.TransactionClient,
  input: {
  workspaceId: string;
  fromLocationId: string | null;
  toLocationId: string | null;
}
) {
  const ids = [input.fromLocationId, input.toLocationId].filter(
    (id): id is string => Boolean(id)
  );

  if (ids.length === 0) {
    return {
      fromLocationId: input.fromLocationId,
      toLocationId: input.toLocationId
    };
  }

  const locations = await db.storageLocation.findMany({
    where: {
      workspaceId: input.workspaceId,
      id: { in: ids }
    },
    select: {
      id: true,
      isAssignable: true,
      isArchived: true
    }
  });

  if (locations.length !== new Set(ids).size) {
    throw new Error("location-not-found");
  }

  if (locations.some((location) => location.isArchived)) {
    throw new Error("location-archived");
  }

  if (locations.some((location) => !location.isAssignable)) {
    throw new Error("location-not-assignable");
  }

  return {
    fromLocationId: input.fromLocationId,
    toLocationId: input.toLocationId
  };
}

async function assertLocationBalanceRules(
  db: Prisma.TransactionClient,
  input: {
  workspaceId: string;
  partId: string;
  entryType: InventoryEntryType;
  quantity: Prisma.Decimal;
  fromLocationId: string | null;
  toLocationId: string | null;
}
) {
  if (input.entryType === "ISSUE" && input.fromLocationId) {
    await assertNonNegativeAfterDelta(db, {
      workspaceId: input.workspaceId,
      partId: input.partId,
      locationId: input.fromLocationId,
      delta: input.quantity.negated()
    });
    return;
  }

  if (input.entryType === "TRANSFER" && input.fromLocationId) {
    await assertNonNegativeAfterDelta(db, {
      workspaceId: input.workspaceId,
      partId: input.partId,
      locationId: input.fromLocationId,
      delta: input.quantity.negated()
    });
    return;
  }

  if (
    input.entryType === "ADJUSTMENT" &&
    input.toLocationId &&
    input.quantity.lessThan(0)
  ) {
    await assertNonNegativeAfterDelta(db, {
      workspaceId: input.workspaceId,
      partId: input.partId,
      locationId: input.toLocationId,
      delta: input.quantity
    });
  }
}

async function assertNonNegativeAfterDelta(
  db: Prisma.TransactionClient,
  input: {
  workspaceId: string;
  partId: string;
  locationId: string;
  delta: Prisma.Decimal;
}
) {
  const balances = await getPartLocationBalancesWithDb(db, {
    workspaceId: input.workspaceId,
    partId: input.partId
  });
  const current = balances.get(input.locationId) ?? new Prisma.Decimal(0);
  const next = current.plus(input.delta);

  if (next.lessThan(0)) {
    throw new Error("insufficient-stock");
  }
}

function computeMovingAverage(
  oldAvg: Prisma.Decimal | null,
  stockBefore: Prisma.Decimal,
  unitCost: Prisma.Decimal | null,
  qty: Prisma.Decimal
): Prisma.Decimal | null {
  if (unitCost === null) return oldAvg;
  const stockBeforeNonNeg = stockBefore.lessThan(0) ? new Prisma.Decimal(0) : stockBefore;
  const newStock = stockBeforeNonNeg.plus(qty);
  if (newStock.isZero()) return oldAvg;
  const oldTotal = (oldAvg ?? new Prisma.Decimal(0)).mul(stockBeforeNonNeg);
  return oldTotal.plus(unitCost.mul(qty)).div(newStock).toDecimalPlaces(8);
}

function getPartStockDelta(input: {
  entryType: InventoryEntryType;
  quantity: Prisma.Decimal;
}) {
  if (input.entryType === "RECEIPT") {
    return input.quantity;
  }

  if (input.entryType === "ISSUE") {
    return input.quantity.negated();
  }

  if (input.entryType === "TRANSFER") {
    return new Prisma.Decimal(0);
  }

  return input.quantity;
}

export async function getPartLocationBalancesWithDb(
  db: Prisma.TransactionClient | typeof prisma,
  input: {
    workspaceId: string;
    partId: string;
  }
) {
  const entries = await db.inventoryEntry.findMany({
    where: {
      workspaceId: input.workspaceId,
      partId: input.partId
    },
    select: {
      entryType: true,
      quantity: true,
      fromLocationId: true,
      toLocationId: true
    }
  });

  const balances = new Map<string, Prisma.Decimal>();

  for (const entry of entries) {
    const quantity = new Prisma.Decimal(entry.quantity);

    if (entry.entryType === "RECEIPT" && entry.toLocationId) {
      addBalance(balances, entry.toLocationId, quantity);
      continue;
    }

    if (entry.entryType === "ISSUE" && entry.fromLocationId) {
      addBalance(balances, entry.fromLocationId, quantity.negated());
      continue;
    }

    if (entry.entryType === "TRANSFER" && entry.fromLocationId && entry.toLocationId) {
      addBalance(balances, entry.fromLocationId, quantity.negated());
      addBalance(balances, entry.toLocationId, quantity);
      continue;
    }

    if (entry.entryType === "ADJUSTMENT" && entry.toLocationId) {
      addBalance(balances, entry.toLocationId, quantity);
    }
  }

  return balances;
}

export async function getPartLocationAvailableBalances(input: {
  workspaceId: string;
  partId: string;
}) {
  return getPartLocationAvailableBalancesWithDb(prisma, input);
}

/**
 * Per-location balance minus the hard reservation currently held at that specific location, so
 * pickers can show what is truly still usable there (ADR 0021/0023, refs #172). A build's
 * `reservedQty` is a part-level aggregate, but each unit of it traces back to the source location
 * on its (not-yet-assembled) `BuildDesignatorAssignment` row once the build is `STARTED`/
 * `IN_PROGRESS` — that link is what lets the aggregate be attributed back to a location.
 */
export async function getPartLocationAvailableBalancesWithDb(
  db: Prisma.TransactionClient | typeof prisma,
  input: {
    workspaceId: string;
    partId: string;
  }
) {
  const [balances, reservedByLocation] = await Promise.all([
    getPartLocationBalancesWithDb(db, input),
    getReservedQuantitiesByLocationWithDb(db, input)
  ]);

  const available = new Map<string, Prisma.Decimal>();
  for (const [locationId, balance] of balances) {
    const reserved = reservedByLocation.get(locationId) ?? new Prisma.Decimal(0);
    available.set(locationId, balance.minus(reserved));
  }
  return available;
}

async function getReservedQuantitiesByLocationWithDb(
  db: Prisma.TransactionClient | typeof prisma,
  input: {
    workspaceId: string;
    partId: string;
  }
) {
  const rows = await db.buildDesignatorAssignment.groupBy({
    by: ["sourceLocationId"],
    where: {
      workspaceId: input.workspaceId,
      partId: input.partId,
      assembled: false,
      sourceLocationId: { not: null },
      buildLineItem: { build: { state: { in: ["STARTED", "IN_PROGRESS"] } } }
    },
    _count: { _all: true }
  });

  const reserved = new Map<string, Prisma.Decimal>();
  for (const row of rows) {
    if (row.sourceLocationId) {
      reserved.set(row.sourceLocationId, new Prisma.Decimal(row._count._all));
    }
  }
  return reserved;
}

/**
 * A transfer that dips into stock already held by a hard reservation (a started build's
 * not-yet-assembled `BuildDesignatorAssignment` rows) would otherwise leave that reservation
 * pointing at a location with no physical stock left to cover it, producing negative available
 * quantity there. Compute how many reserved units the transfer must carry along with it so the
 * source location's available quantity never drops below zero.
 */
async function computeReservationUnitsToRelocate(
  db: Prisma.TransactionClient,
  input: {
    workspaceId: string;
    partId: string;
    locationId: string;
    transferQuantity: Prisma.Decimal;
  }
) {
  const [balances, reservedByLocation] = await Promise.all([
    getPartLocationBalancesWithDb(db, input),
    getReservedQuantitiesByLocationWithDb(db, input)
  ]);

  const balance = balances.get(input.locationId) ?? new Prisma.Decimal(0);
  const reserved = reservedByLocation.get(input.locationId) ?? new Prisma.Decimal(0);
  const available = balance.minus(reserved);
  const deficit = input.transferQuantity.minus(available);

  if (deficit.lessThanOrEqualTo(0)) {
    return 0;
  }

  const unitsToRelocate = deficit.greaterThan(reserved) ? reserved : deficit;
  return unitsToRelocate.ceil().toNumber();
}

/**
 * Moves the oldest not-yet-assembled reservations at `fromLocationId` onto `toLocationId` so a
 * transfer that consumed reserved stock keeps the build's future assembly sourcing correct.
 */
async function relocateReservationsForTransfer(
  db: Prisma.TransactionClient,
  input: {
    workspaceId: string;
    partId: string;
    fromLocationId: string;
    toLocationId: string;
    unitsToRelocate: number;
  }
) {
  const assignments = await db.buildDesignatorAssignment.findMany({
    where: {
      workspaceId: input.workspaceId,
      partId: input.partId,
      sourceLocationId: input.fromLocationId,
      assembled: false,
      buildLineItem: { build: { state: { in: ["STARTED", "IN_PROGRESS"] } } }
    },
    select: { id: true },
    orderBy: { createdAt: "asc" },
    take: input.unitsToRelocate
  });

  if (assignments.length === 0) {
    return;
  }

  await db.buildDesignatorAssignment.updateMany({
    where: { id: { in: assignments.map((assignment) => assignment.id) } },
    data: { sourceLocationId: input.toLocationId }
  });
}

function addBalance(
  balances: Map<string, Prisma.Decimal>,
  locationId: string,
  delta: Prisma.Decimal
) {
  const current = balances.get(locationId) ?? new Prisma.Decimal(0);
  balances.set(locationId, current.plus(delta));
}

function normalizeOptionalText(value: string | null) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

export type InventoryHistoryItem = {
  id: string;
  entryType: "RECEIPT" | "ISSUE" | "TRANSFER" | "ADJUSTMENT";
  quantity: string;
  fromLocationName: string | null;
  toLocationName: string | null;
  note: string | null;
  createdAt: string;
  authorName: string | null;
};

export async function getPartInventoryHistory(input: {
  workspaceId: string;
  partId: string;
}): Promise<InventoryHistoryItem[]> {
  const entries = await prisma.inventoryEntry.findMany({
    where: {
      workspaceId: input.workspaceId,
      partId: input.partId
    },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      entryType: true,
      quantity: true,
      note: true,
      createdAt: true,
      fromLocation: { select: { name: true } },
      toLocation: { select: { name: true } },
      createdByUser: { select: { name: true } }
    }
  });

  return entries.map((entry) => ({
    id: entry.id,
    entryType: entry.entryType,
    quantity: entry.quantity.toString(),
    fromLocationName: entry.fromLocation?.name ?? null,
    toLocationName: entry.toLocation?.name ?? null,
    note: entry.note,
    createdAt: entry.createdAt.toISOString(),
    authorName: entry.createdByUser?.name ?? null
  }));
}

async function lockPartRow(
  db: Prisma.TransactionClient,
  input: {
    workspaceId: string;
    partId: string;
  }
) {
  const lockedParts = await db.$queryRaw<Array<{ id: string }>>`
    SELECT id
    FROM "Part"
    WHERE id = ${input.partId}
      AND "workspaceId" = ${input.workspaceId}
    FOR UPDATE
  `;

  if (lockedParts.length === 0) {
    throw new Error("part-not-found");
  }
}
