import "server-only";

import { Prisma } from "@/generated/prisma/client";
import {
  LOCATION_GENERATOR_MAX_NEW,
  normalizeLocationName as normalizeLocationNameKey,
  planLocationHierarchy,
  resolvePlannedLocations,
  validateLocationGeneratorLevels,
  type LocationGeneratorLevel
} from "@/lib/locationGenerator";
import { prisma } from "@/server/db/prisma";

export type StorageLocationListItem = {
  id: string;
  parentId: string | null;
  name: string;
  isAssignable: boolean;
  isArchived: boolean;
};

export const STORAGE_LOCATION_PATH_SEPARATOR = " / ";

export async function getStorageLocations(workspaceId: string) {
  return prisma.storageLocation.findMany({
    where: {
      workspaceId
    },
    orderBy: [{ name: "asc" }, { id: "asc" }],
    select: {
      id: true,
      parentId: true,
      name: true,
      isAssignable: true,
      isArchived: true
    }
  });
}

/** Build each location's full ancestor path (e.g. "Warehouse / Shelf A / Drawer 5"), by id. */
export function buildStorageLocationPaths(
  locations: Array<{ id: string; parentId: string | null; name: string }>
): Map<string, string> {
  const locationsById = new Map(locations.map((location) => [location.id, location]));
  const pathsById = new Map<string, string>();

  function getPath(locationId: string, seen: Set<string>): string {
    const existingPath = pathsById.get(locationId);
    if (existingPath) return existingPath;

    const location = locationsById.get(locationId);
    if (!location) return "";

    if (!location.parentId || seen.has(location.parentId)) {
      pathsById.set(locationId, location.name);
      return location.name;
    }

    const parentPath = getPath(location.parentId, new Set(seen).add(locationId));
    const path = parentPath
      ? `${parentPath}${STORAGE_LOCATION_PATH_SEPARATOR}${location.name}`
      : location.name;

    pathsById.set(locationId, path);
    return path;
  }

  for (const location of locations) {
    getPath(location.id, new Set());
  }

  return pathsById;
}

export async function createStorageLocation(input: {
  workspaceId: string;
  parentId?: string | null;
  name: string;
  isAssignable: boolean;
}) {
  const normalizedName = normalizeLocationName(input.name);
  await assertParentLocation(input.workspaceId, input.parentId ?? null);

  const duplicate = await prisma.storageLocation.findFirst({
    where: {
      workspaceId: input.workspaceId,
      parentId: input.parentId ?? null,
      normalizedName
    },
    select: {
      id: true
    }
  });

  if (duplicate) {
    throw new Error("duplicate-location-name");
  }

  return prisma.storageLocation.create({
    data: {
      workspaceId: input.workspaceId,
      parentId: input.parentId ?? null,
      name: input.name.trim(),
      normalizedName,
      isAssignable: input.isAssignable
    },
    select: {
      id: true,
      parentId: true,
      name: true,
      isAssignable: true,
      isArchived: true
    }
  });
}

export async function updateStorageLocation(input: {
  workspaceId: string;
  locationId: string;
  parentId?: string | null;
  name: string;
  isAssignable: boolean;
  isArchived: boolean;
}) {
  const current = await prisma.storageLocation.findFirst({
    where: {
      id: input.locationId,
      workspaceId: input.workspaceId
    },
    select: {
      id: true,
      isArchived: true
    }
  });

  if (!current) {
    throw new Error("location-not-found");
  }

  await assertParentLocation(
    input.workspaceId,
    input.parentId ?? null,
    input.locationId
  );

  const normalizedName = normalizeLocationName(input.name);
  const duplicate = await prisma.storageLocation.findFirst({
    where: {
      workspaceId: input.workspaceId,
      parentId: input.parentId ?? null,
      normalizedName,
      id: {
        not: input.locationId
      }
    },
    select: {
      id: true
    }
  });

  if (duplicate) {
    throw new Error("duplicate-location-name");
  }

  if (!current.isArchived && input.isArchived) {
    await assertLocationHasZeroStock(input.workspaceId, input.locationId);
  }

  return prisma.storageLocation.update({
    where: {
      id: input.locationId
    },
    data: {
      parentId: input.parentId ?? null,
      name: input.name.trim(),
      normalizedName,
      isAssignable: input.isAssignable,
      isArchived: input.isArchived
    },
    select: {
      id: true,
      parentId: true,
      name: true,
      isAssignable: true,
      isArchived: true
    }
  });
}

async function assertLocationHasZeroStock(workspaceId: string, locationId: string) {
  const nonZeroRows = await prisma.$queryRaw<Array<{ partId: string }>>`
    SELECT "partId"
    FROM "InventoryEntry"
    WHERE "workspaceId" = ${workspaceId}
      AND ("fromLocationId" = ${locationId} OR "toLocationId" = ${locationId})
    GROUP BY "partId"
    HAVING SUM(
      CASE
        WHEN "entryType" = 'RECEIPT' AND "toLocationId" = ${locationId} THEN "quantity"
        WHEN "entryType" = 'ADJUSTMENT' AND "toLocationId" = ${locationId} THEN "quantity"
        WHEN "entryType" = 'TRANSFER' AND "toLocationId" = ${locationId} THEN "quantity"
        WHEN "entryType" = 'ISSUE' AND "fromLocationId" = ${locationId} THEN -"quantity"
        WHEN "entryType" = 'TRANSFER' AND "fromLocationId" = ${locationId} THEN -"quantity"
        ELSE 0
      END
    ) <> 0
    LIMIT 1
  `;

  if (nonZeroRows.length > 0) {
    throw new Error("location-has-stock");
  }
}

export async function deleteStorageLocation(input: {
  workspaceId: string;
  locationId: string;
}) {
  const [childrenCount, partDefaultsCount, inventoryUsageCount] =
    await Promise.all([
      prisma.storageLocation.count({
        where: {
          workspaceId: input.workspaceId,
          parentId: input.locationId
        }
      }),
      prisma.part.count({
        where: {
          workspaceId: input.workspaceId,
          defaultLocationId: input.locationId
        }
      }),
      prisma.inventoryEntry.count({
        where: {
          workspaceId: input.workspaceId,
          OR: [{ fromLocationId: input.locationId }, { toLocationId: input.locationId }]
        }
      })
    ]);

  if (childrenCount > 0) {
    throw new Error("location-has-children");
  }

  if (partDefaultsCount > 0 || inventoryUsageCount > 0) {
    throw new Error("location-in-use");
  }

  const deleted = await prisma.storageLocation.deleteMany({
    where: {
      id: input.locationId,
      workspaceId: input.workspaceId
    }
  });

  if (deleted.count === 0) {
    throw new Error("location-not-found");
  }
}

/**
 * Create a whole location hierarchy under one parent (or at root) in one transaction. A planned
 * location whose name already exists under the same parent is reused, untouched, and the levels
 * below it are generated inside it — which is how an existing structure is extended.
 */
export async function generateStorageLocations(input: {
  workspaceId: string;
  parentId: string | null;
  levels: LocationGeneratorLevel[];
}): Promise<{ created: StorageLocationListItem[]; reusedCount: number }> {
  if (validateLocationGeneratorLevels(input.levels).length > 0) {
    throw new Error("invalid-location-generator");
  }
  const plan = planLocationHierarchy(input.levels);

  try {
    return await prisma.$transaction(async (tx) => {
      if (input.parentId) {
        const parent = await tx.storageLocation.findFirst({
          where: { id: input.parentId, workspaceId: input.workspaceId },
          select: { id: true }
        });
        if (!parent) {
          throw new Error("invalid-parent-location");
        }
      }

      const existing = await tx.storageLocation.findMany({
        where: { workspaceId: input.workspaceId },
        select: { id: true, parentId: true, normalizedName: true }
      });
      const resolved = resolvePlannedLocations(plan, input.parentId, existing);
      const toCreate = plan.filter((planned) => resolved.get(planned.key) === null);

      if (toCreate.length > LOCATION_GENERATOR_MAX_NEW) {
        throw new Error("too-many-generated-locations");
      }

      const idsByKey = new Map<string, string>();
      for (const [key, existingId] of resolved) {
        if (existingId) idsByKey.set(key, existingId);
      }

      // One insert per level: every parent a level needs was resolved or created by the one above.
      const created: StorageLocationListItem[] = [];
      const maxDepth = Math.max(-1, ...toCreate.map((planned) => planned.depth));
      for (let depth = 0; depth <= maxDepth; depth += 1) {
        const levelRows = toCreate
          .filter((planned) => planned.depth === depth)
          .map((planned) => ({
            planned,
            parentId: planned.parentKey === null ? input.parentId : idsByKey.get(planned.parentKey)!
          }));
        if (levelRows.length === 0) continue;

        const rows = await tx.storageLocation.createManyAndReturn({
          data: levelRows.map(({ planned, parentId }) => ({
            workspaceId: input.workspaceId,
            parentId,
            name: planned.name,
            normalizedName: planned.normalizedName,
            isAssignable: planned.isAssignable
          })),
          select: {
            id: true,
            parentId: true,
            name: true,
            normalizedName: true,
            isAssignable: true,
            isArchived: true
          }
        });

        // Match rows back by parent and name, unique among siblings, rather than by return order.
        const rowIdsByParentAndName = new Map(
          rows.map((row) => [`${row.parentId ?? ""} ${row.normalizedName}`, row.id])
        );
        for (const { planned, parentId } of levelRows) {
          idsByKey.set(
            planned.key,
            rowIdsByParentAndName.get(`${parentId ?? ""} ${planned.normalizedName}`)!
          );
        }
        created.push(
          ...rows.map((row) => ({
            id: row.id,
            parentId: row.parentId,
            name: row.name,
            isAssignable: row.isAssignable,
            isArchived: row.isArchived
          }))
        );
      }

      return { created, reusedCount: plan.length - toCreate.length };
    });
  } catch (error) {
    // A concurrent create of the same sibling name loses the race on the unique index.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new Error("duplicate-location-name");
    }
    throw error;
  }
}

async function assertParentLocation(
  workspaceId: string,
  parentId: string | null,
  locationId?: string
) {
  if (!parentId) {
    return;
  }

  if (locationId && parentId === locationId) {
    throw new Error("location-parent-cycle");
  }

  const parent = await prisma.storageLocation.findFirst({
    where: {
      id: parentId,
      workspaceId
    },
    select: {
      id: true
    }
  });

  if (!parent) {
    throw new Error("invalid-parent-location");
  }
}

function normalizeLocationName(value: string) {
  const normalized = normalizeLocationNameKey(value);

  if (!normalized) {
    throw new Error("missing-required-fields");
  }

  return normalized;
}
