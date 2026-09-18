import "server-only";

import { Prisma } from "@/generated/prisma/client";
import { getLocationPathBelow, getLocationSubtreeIds } from "@/lib/locationTree";
import { prisma } from "@/server/db/prisma";
import {
  getPartLocationKey,
  getReservedQuantitiesAtLocations
} from "@/server/inventory/entryMutations";
import { getStorageLocations } from "@/server/inventory/locationMutations";

export type LocationStockItem = {
  partId: string;
  catalogNumber: string;
  manufacturerName: string;
  description: string | null;
  locationId: string;
  /** Where the stock sits relative to the opened location; its own name for stock held directly. */
  locationPath: string;
  quantity: string;
  availableQuantity: string;
};

/**
 * Parts with non-zero stock at a location — and, with `includeSublocations`, anywhere below it —
 * one row per part and location. Stock is the movement-history balance used by the part stock
 * breakdown; available is that balance minus hard reservations held at the same location.
 */
export async function getLocationStock(input: {
  workspaceId: string;
  locationId: string;
  includeSublocations: boolean;
}): Promise<LocationStockItem[]> {
  const locations = await getStorageLocations(input.workspaceId);
  if (!locations.some((location) => location.id === input.locationId)) {
    throw new Error("location-not-found");
  }

  const locationIds = input.includeSublocations
    ? getLocationSubtreeIds(locations, input.locationId)
    : [input.locationId];

  const [balances, reserved] = await Promise.all([
    getBalancesAtLocations(input.workspaceId, locationIds),
    getReservedQuantitiesAtLocations({ workspaceId: input.workspaceId, locationIds })
  ]);

  if (balances.length === 0) {
    return [];
  }

  const parts = await prisma.part.findMany({
    where: {
      workspaceId: input.workspaceId,
      id: { in: [...new Set(balances.map((balance) => balance.partId))] }
    },
    select: {
      id: true,
      catalogNumber: true,
      description: true,
      manufacturer: { select: { name: true } }
    }
  });
  const partsById = new Map(parts.map((part) => [part.id, part]));

  const items: LocationStockItem[] = [];
  for (const balance of balances) {
    const part = partsById.get(balance.partId);
    if (!part) continue;

    const quantity = new Prisma.Decimal(balance.quantity);
    const reservedHere =
      reserved.get(getPartLocationKey(balance.partId, balance.locationId)) ??
      new Prisma.Decimal(0);

    items.push({
      partId: part.id,
      catalogNumber: part.catalogNumber,
      manufacturerName: part.manufacturer.name,
      description: part.description,
      locationId: balance.locationId,
      locationPath: getLocationPathBelow(locations, input.locationId, balance.locationId),
      quantity: quantity.toString(),
      availableQuantity: quantity.minus(reservedHere).toString()
    });
  }

  const isHeldDirectly = (item: LocationStockItem) => (item.locationId === input.locationId ? 0 : 1);

  return items.sort(
    (left, right) =>
      isHeldDirectly(left) - isHeldDirectly(right) ||
      compareText(left.locationPath, right.locationPath) ||
      compareText(left.manufacturerName, right.manufacturerName) ||
      compareText(left.catalogNumber, right.catalogNumber)
  );
}

/**
 * Per part and location balance, with the same movement semantics as
 * `getPartLocationBalancesWithDb`: receipts, adjustments and incoming transfers add at the
 * destination; issues and outgoing transfers subtract at the source.
 */
async function getBalancesAtLocations(workspaceId: string, locationIds: string[]) {
  return prisma.$queryRaw<
    Array<{ partId: string; locationId: string; quantity: Prisma.Decimal }>
  >`
    SELECT "partId", "locationId", SUM("delta") AS "quantity"
    FROM (
      SELECT "partId", "toLocationId" AS "locationId", "quantity" AS "delta"
      FROM "InventoryEntry"
      WHERE "workspaceId" = ${workspaceId}
        AND "toLocationId" IN (${Prisma.join(locationIds)})
        AND "entryType" IN ('RECEIPT', 'ADJUSTMENT', 'TRANSFER')
      UNION ALL
      SELECT "partId", "fromLocationId" AS "locationId", -"quantity" AS "delta"
      FROM "InventoryEntry"
      WHERE "workspaceId" = ${workspaceId}
        AND "fromLocationId" IN (${Prisma.join(locationIds)})
        AND "entryType" IN ('ISSUE', 'TRANSFER')
    ) AS "movements"
    GROUP BY "partId", "locationId"
    HAVING SUM("delta") <> 0
  `;
}

function compareText(left: string, right: string) {
  return left.localeCompare(right, "en", { numeric: true });
}
