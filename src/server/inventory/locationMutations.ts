import "server-only";

import { prisma } from "@/server/db/prisma";

export type StorageLocationListItem = {
  id: string;
  parentId: string | null;
  name: string;
  isAssignable: boolean;
  isArchived: boolean;
};

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
  const normalized = value.trim().toLocaleLowerCase("en").replace(/\s+/g, " ");

  if (!normalized) {
    throw new Error("missing-required-fields");
  }

  return normalized;
}
