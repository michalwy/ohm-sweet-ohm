import "server-only";

import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/server/db/prisma";

type InventoryEntryType = "RECEIPT" | "ISSUE" | "TRANSFER" | "ADJUSTMENT";

export async function createInventoryEntry(input: {
  workspaceId: string;
  partId: string;
  entryType: InventoryEntryType;
  quantity: string;
  fromLocationId?: string | null;
  toLocationId?: string | null;
  note?: string | null;
  createdByMemberId?: string | null;
}) {
  const part = await prisma.part.findFirst({
    where: {
      id: input.partId,
      workspaceId: input.workspaceId
    },
    select: {
      id: true,
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

  const quantity = parseQuantity(input.quantity);

  if (!part.unit.allowsFraction && !quantity.isInteger()) {
    throw new Error("fractional-quantity-not-allowed");
  }

  validateEntryShape(input.entryType, {
    fromLocationId: input.fromLocationId ?? null,
    toLocationId: input.toLocationId ?? null
  });

  const locations = await getValidatedLocations({
    workspaceId: input.workspaceId,
    fromLocationId: input.fromLocationId ?? null,
    toLocationId: input.toLocationId ?? null
  });

  await assertLocationBalanceRules({
    workspaceId: input.workspaceId,
    partId: input.partId,
    entryType: input.entryType,
    quantity,
    fromLocationId: locations.fromLocationId,
    toLocationId: locations.toLocationId
  });

  return prisma.inventoryEntry.create({
    data: {
      workspaceId: input.workspaceId,
      partId: input.partId,
      entryType: input.entryType,
      quantity,
      fromLocationId: locations.fromLocationId,
      toLocationId: locations.toLocationId,
      note: normalizeOptionalText(input.note ?? null),
      createdByMemberId: input.createdByMemberId ?? null
    }
  });
}

export async function getPartLocationBalances(input: {
  workspaceId: string;
  partId: string;
}) {
  const entries = await prisma.inventoryEntry.findMany({
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

async function getValidatedLocations(input: {
  workspaceId: string;
  fromLocationId: string | null;
  toLocationId: string | null;
}) {
  const ids = [input.fromLocationId, input.toLocationId].filter(
    (id): id is string => Boolean(id)
  );

  if (ids.length === 0) {
    return {
      fromLocationId: input.fromLocationId,
      toLocationId: input.toLocationId
    };
  }

  const locations = await prisma.storageLocation.findMany({
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

async function assertLocationBalanceRules(input: {
  workspaceId: string;
  partId: string;
  entryType: InventoryEntryType;
  quantity: Prisma.Decimal;
  fromLocationId: string | null;
  toLocationId: string | null;
}) {
  if (input.entryType === "ISSUE" && input.fromLocationId) {
    await assertNonNegativeAfterDelta({
      workspaceId: input.workspaceId,
      partId: input.partId,
      locationId: input.fromLocationId,
      delta: input.quantity.negated()
    });
    return;
  }

  if (input.entryType === "TRANSFER" && input.fromLocationId) {
    await assertNonNegativeAfterDelta({
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
    await assertNonNegativeAfterDelta({
      workspaceId: input.workspaceId,
      partId: input.partId,
      locationId: input.toLocationId,
      delta: input.quantity
    });
  }
}

async function assertNonNegativeAfterDelta(input: {
  workspaceId: string;
  partId: string;
  locationId: string;
  delta: Prisma.Decimal;
}) {
  const balances = await getPartLocationBalances({
    workspaceId: input.workspaceId,
    partId: input.partId
  });
  const current = balances.get(input.locationId) ?? new Prisma.Decimal(0);
  const next = current.plus(input.delta);

  if (next.lessThan(0)) {
    throw new Error("insufficient-stock");
  }
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
