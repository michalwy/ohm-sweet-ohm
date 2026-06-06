import "server-only";

import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/server/db/prisma";
import {
  decodeListCursor,
  encodeListCursor,
  getListPageSize,
  type ListPage
} from "@/server/pagination";

export type ShoppingListItem = {
  id: string;
  partId: string;
  partCatalogNumber: string;
  partDescription: string | null;
  manufacturerName: string;
  quantity: string;
  notes: string | null;
  orderedInPurchaseOrderId: string | null;
};

export type ShoppingListDetail = {
  id: string;
  name: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  items: ShoppingListItem[];
};

export type ShoppingListSummary = {
  id: string;
  name: string;
  notes: string | null;
  itemCount: number;
  createdAt: string;
  updatedAt: string;
};

export type ShoppingListSortBy = "name" | "itemCount" | "createdAt";
export type ShoppingListSortDirection = "asc" | "desc";

export type ShoppingListsPageInput = {
  cursor?: string | null;
  pageSize?: number | null;
  sortBy?: ShoppingListSortBy | null;
  sortDirection?: ShoppingListSortDirection | null;
};

type NameCursor = { name: string; id: string };
type CreatedAtCursor = { createdAt: string; id: string };
type OffsetCursor = { offset: number };

export async function getShoppingLists(
  workspaceId: string,
  input: ShoppingListsPageInput = {}
): Promise<ListPage<ShoppingListSummary>> {
  const size = getListPageSize(input.pageSize);
  const sortBy = input.sortBy ?? "createdAt";
  const dir = input.sortDirection ?? (sortBy === "createdAt" ? "desc" : "asc");

  const selectShape = {
    id: true,
    name: true,
    notes: true,
    createdAt: true,
    updatedAt: true,
    _count: { select: { items: true } }
  } as const;

  const totalCount = await prisma.shoppingList.count({ where: { workspaceId } });

  function toSummary(list: {
    id: string;
    name: string;
    notes: string | null;
    createdAt: Date;
    updatedAt: Date;
    _count: { items: number };
  }): ShoppingListSummary {
    return {
      id: list.id,
      name: list.name,
      notes: list.notes,
      itemCount: list._count.items,
      createdAt: list.createdAt.toISOString(),
      updatedAt: list.updatedAt.toISOString()
    };
  }

  if (sortBy === "itemCount") {
    // Load all, sort in-memory, slice with offset cursor
    const cursor = decodeListCursor<OffsetCursor>(input.cursor);
    const offset = cursor?.offset ?? 0;

    const all = await prisma.shoppingList.findMany({
      where: { workspaceId },
      select: selectShape
    });

    all.sort((a, b) => {
      const diff = a._count.items - b._count.items;
      return dir === "asc" ? diff : -diff;
    });

    const sliced = all.slice(offset, offset + size + 1);
    const hasMore = sliced.length > size;
    const items = sliced.slice(0, size).map(toSummary);
    const nextCursor = hasMore
      ? encodeListCursor<OffsetCursor>({ offset: offset + size })
      : null;

    return { items, nextCursor, totalCount, filteredCount: totalCount };
  }

  if (sortBy === "name") {
    const cursor = decodeListCursor<NameCursor>(input.cursor);

    const rows = await prisma.shoppingList.findMany({
      where: {
        workspaceId,
        ...(cursor
          ? {
              OR: [
                { name: dir === "asc" ? { gt: cursor.name } : { lt: cursor.name } },
                { name: cursor.name, id: dir === "asc" ? { gt: cursor.id } : { lt: cursor.id } }
              ]
            }
          : {})
      },
      orderBy: [{ name: dir }, { id: dir }],
      take: size + 1,
      select: selectShape
    });

    const hasMore = rows.length > size;
    const items = rows.slice(0, size).map(toSummary);
    const last = items[items.length - 1];
    const nextCursor =
      hasMore && last
        ? encodeListCursor<NameCursor>({ name: last.name, id: last.id })
        : null;

    return { items, nextCursor, totalCount, filteredCount: totalCount };
  }

  // Default: createdAt sort
  const cursor = decodeListCursor<CreatedAtCursor>(input.cursor);
  const createdAtDir = dir === "asc" ? "asc" : "desc";

  const rows = await prisma.shoppingList.findMany({
    where: {
      workspaceId,
      ...(cursor
        ? {
            OR: [
              {
                createdAt:
                  createdAtDir === "desc"
                    ? { lt: new Date(cursor.createdAt) }
                    : { gt: new Date(cursor.createdAt) }
              },
              {
                createdAt: new Date(cursor.createdAt),
                id: createdAtDir === "desc" ? { lt: cursor.id } : { gt: cursor.id }
              }
            ]
          }
        : {})
    },
    orderBy: [{ createdAt: createdAtDir }, { id: createdAtDir === "desc" ? "asc" : "desc" }],
    take: size + 1,
    select: selectShape
  });

  const hasMore = rows.length > size;
  const items = rows.slice(0, size).map(toSummary);
  const last = items[items.length - 1];
  const nextCursor =
    hasMore && last
      ? encodeListCursor<CreatedAtCursor>({ createdAt: last.createdAt, id: last.id })
      : null;

  return { items, nextCursor, totalCount, filteredCount: totalCount };
}

export async function getShoppingListDetail(
  workspaceId: string,
  listId: string
): Promise<ShoppingListDetail | null> {
  const list = await prisma.shoppingList.findFirst({
    where: { id: listId, workspaceId },
    select: {
      id: true,
      name: true,
      notes: true,
      createdAt: true,
      updatedAt: true,
      items: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          partId: true,
          quantity: true,
          notes: true,
          part: {
            select: {
              catalogNumber: true,
              description: true,
              manufacturer: { select: { name: true } }
            }
          },
          purchaseOrderItems: {
            select: { purchaseOrderId: true },
            take: 1
          }
        }
      }
    }
  });

  if (!list) return null;

  return {
    id: list.id,
    name: list.name,
    notes: list.notes,
    createdAt: list.createdAt.toISOString(),
    updatedAt: list.updatedAt.toISOString(),
    items: list.items.map((item) => ({
      id: item.id,
      partId: item.partId,
      partCatalogNumber: item.part.catalogNumber,
      partDescription: item.part.description,
      manufacturerName: item.part.manufacturer.name,
      quantity: item.quantity.toString(),
      notes: item.notes,
      orderedInPurchaseOrderId: item.purchaseOrderItems[0]?.purchaseOrderId ?? null
    }))
  };
}

export async function createShoppingList(input: {
  workspaceId: string;
  name: string;
  notes?: string | null;
}) {
  const name = input.name.trim();
  if (!name) throw new Error("name-required");

  return prisma.shoppingList.create({
    data: {
      workspaceId: input.workspaceId,
      name,
      notes: normalizeOptionalText(input.notes)
    }
  });
}

export async function updateShoppingList(input: {
  workspaceId: string;
  listId: string;
  name: string;
  notes?: string | null;
}) {
  const name = input.name.trim();
  if (!name) throw new Error("name-required");

  await assertListBelongsToWorkspace(input.workspaceId, input.listId);

  return prisma.shoppingList.update({
    where: { id: input.listId },
    data: {
      name,
      notes: normalizeOptionalText(input.notes)
    }
  });
}

export async function deleteShoppingList(input: {
  workspaceId: string;
  listId: string;
}) {
  await assertListBelongsToWorkspace(input.workspaceId, input.listId);
  await prisma.shoppingList.delete({ where: { id: input.listId } });
}

export async function addShoppingListItem(input: {
  workspaceId: string;
  listId: string;
  partId: string;
  quantity: string;
  notes?: string | null;
}) {
  await assertListBelongsToWorkspace(input.workspaceId, input.listId);

  const quantity = parseQuantity(input.quantity);

  await assertPartBelongsToWorkspace(input.workspaceId, input.partId);

  return prisma.shoppingListItem.create({
    data: {
      shoppingListId: input.listId,
      partId: input.partId,
      quantity,
      notes: normalizeOptionalText(input.notes)
    }
  });
}

export async function updateShoppingListItem(input: {
  workspaceId: string;
  listId: string;
  itemId: string;
  quantity: string;
  notes?: string | null;
}) {
  await assertItemBelongsToList(input.workspaceId, input.listId, input.itemId);

  const quantity = parseQuantity(input.quantity);

  return prisma.shoppingListItem.update({
    where: { id: input.itemId },
    data: {
      quantity,
      notes: normalizeOptionalText(input.notes)
    }
  });
}

export async function removeShoppingListItem(input: {
  workspaceId: string;
  listId: string;
  itemId: string;
}) {
  await assertItemBelongsToList(input.workspaceId, input.listId, input.itemId);
  await prisma.shoppingListItem.delete({ where: { id: input.itemId } });
}

export async function convertShoppingListToOrder(input: {
  workspaceId: string;
  listId: string;
  selectedItemIds: string[];
  supplierId: string;
}) {
  if (input.selectedItemIds.length === 0) {
    throw new Error("no-items-selected");
  }

  await assertListBelongsToWorkspace(input.workspaceId, input.listId);

  const [items, supplier] = await Promise.all([
    prisma.shoppingListItem.findMany({
      where: {
        id: { in: input.selectedItemIds },
        shoppingListId: input.listId
      },
      select: { id: true, partId: true, quantity: true, notes: true }
    }),
    prisma.organization.findFirst({
      where: { id: input.supplierId, workspaceId: input.workspaceId }
    })
  ]);

  if (items.length === 0) throw new Error("items-not-found");
  if (!supplier) throw new Error("supplier-not-found");

  return prisma.purchaseOrder.create({
    data: {
      workspaceId: input.workspaceId,
      supplierId: input.supplierId,
      sourceShoppingListId: input.listId,
      items: {
        create: items.map((item) => ({
          partId: item.partId,
          sourceShoppingListItemId: item.id,
          quantity: item.quantity,
          notes: item.notes
        }))
      }
    }
  });
}

async function assertListBelongsToWorkspace(workspaceId: string, listId: string) {
  const list = await prisma.shoppingList.findFirst({
    where: { id: listId, workspaceId },
    select: { id: true }
  });
  if (!list) throw new Error("shopping-list-not-found");
}

async function assertItemBelongsToList(
  workspaceId: string,
  listId: string,
  itemId: string
) {
  const item = await prisma.shoppingListItem.findFirst({
    where: {
      id: itemId,
      shoppingListId: listId,
      shoppingList: { workspaceId }
    },
    select: { id: true }
  });
  if (!item) throw new Error("shopping-list-item-not-found");
}

async function assertPartBelongsToWorkspace(workspaceId: string, partId: string) {
  const part = await prisma.part.findFirst({
    where: { id: partId, workspaceId },
    select: { id: true }
  });
  if (!part) throw new Error("part-not-found");
}

function parseQuantity(rawValue: string) {
  const normalized = rawValue.trim();
  if (!normalized) throw new Error("missing-required-fields");

  let quantity: Prisma.Decimal;
  try {
    quantity = new Prisma.Decimal(normalized);
  } catch {
    throw new Error("invalid-quantity");
  }

  if (quantity.lessThanOrEqualTo(0)) throw new Error("invalid-quantity");

  return quantity;
}

function normalizeOptionalText(value?: string | null) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}
