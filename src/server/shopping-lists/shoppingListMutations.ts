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
  description: string | null;
  orderedInPurchaseOrderId: string | null;
  orderedInPurchaseOrderNumber: string | null;
  orderedInPurchaseOrderSupplierName: string | null;
};

export type ShoppingListDetail = {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
  items: ShoppingListItem[];
};

export type ShoppingListSummary = {
  id: string;
  name: string;
  description: string | null;
  itemCount: number;
  createdAt: string;
  updatedAt: string;
  createdByName: string | null;
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
    description: true,
    createdAt: true,
    updatedAt: true,
    createdByUser: { select: { name: true } },
    _count: { select: { items: true } }
  } as const;

  const totalCount = await prisma.shoppingList.count({ where: { workspaceId } });

  function toSummary(list: {
    id: string;
    name: string;
    description: string | null;
    createdAt: Date;
    updatedAt: Date;
    createdByUser: { name: string | null } | null;
    _count: { items: number };
  }): ShoppingListSummary {
    return {
      id: list.id,
      name: list.name,
      description: list.description,
      itemCount: list._count.items,
      createdAt: list.createdAt.toISOString(),
      updatedAt: list.updatedAt.toISOString(),
      createdByName: list.createdByUser?.name ?? null
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
      description: true,
      createdAt: true,
      updatedAt: true,
      items: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          partId: true,
          quantity: true,
          description: true,
          part: {
            select: {
              catalogNumber: true,
              description: true,
              manufacturer: { select: { name: true } }
            }
          },
          purchaseOrderItems: {
            select: {
              purchaseOrderId: true,
              purchaseOrder: {
                select: {
                  orderNumber: true,
                  supplier: { select: { name: true } }
                }
              }
            },
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
    description: list.description,
    createdAt: list.createdAt.toISOString(),
    updatedAt: list.updatedAt.toISOString(),
    items: list.items.map((item) => ({
      id: item.id,
      partId: item.partId,
      partCatalogNumber: item.part.catalogNumber,
      partDescription: item.part.description,
      manufacturerName: item.part.manufacturer.name,
      quantity: item.quantity.toString(),
      description: item.description,
      orderedInPurchaseOrderId: item.purchaseOrderItems[0]?.purchaseOrderId ?? null,
      orderedInPurchaseOrderNumber: item.purchaseOrderItems[0]?.purchaseOrder.orderNumber ?? null,
      orderedInPurchaseOrderSupplierName: item.purchaseOrderItems[0]?.purchaseOrder.supplier.name ?? null
    }))
  };
}

export async function createShoppingList(input: {
  workspaceId: string;
  name: string;
  description?: string | null;
  createdByUserId?: string | null;
}) {
  const name = input.name.trim();
  if (!name) throw new Error("name-required");

  return prisma.shoppingList.create({
    data: {
      workspaceId: input.workspaceId,
      name,
      description: normalizeOptionalText(input.description),
      createdByUserId: input.createdByUserId ?? null
    }
  });
}

export async function updateShoppingList(input: {
  workspaceId: string;
  listId: string;
  name: string;
  description?: string | null;
}) {
  const name = input.name.trim();
  if (!name) throw new Error("name-required");

  await assertListBelongsToWorkspace(input.workspaceId, input.listId);

  return prisma.shoppingList.update({
    where: { id: input.listId },
    data: {
      name,
      description: normalizeOptionalText(input.description)
    }
  });
}

export async function deleteShoppingList(input: {
  workspaceId: string;
  listId: string;
}) {
  await assertListBelongsToWorkspace(input.workspaceId, input.listId);

  await prisma.$transaction(async (tx) => {
    const items = await tx.shoppingListItem.findMany({
      where: { shoppingListId: input.listId },
      select: {
        partId: true,
        quantity: true,
        purchaseOrderItems: { select: { id: true }, take: 1 }
      }
    });

    await tx.shoppingList.delete({ where: { id: input.listId } });

    const deltaByPartId = sumQtyByPartId(
      items.filter((item) => item.purchaseOrderItems.length === 0)
    );

    for (const [partId, delta] of deltaByPartId) {
      await tx.part.update({
        where: { id: partId },
        data: { plannedQty: { decrement: delta } }
      });
    }
  });
}

export async function addShoppingListItem(input: {
  workspaceId: string;
  listId: string;
  partId: string;
  quantity: string;
  description?: string | null;
}) {
  await assertListBelongsToWorkspace(input.workspaceId, input.listId);

  const quantity = parseQuantity(input.quantity);

  await assertPartBelongsToWorkspace(input.workspaceId, input.partId);

  const item = await prisma.shoppingListItem.create({
    data: {
      shoppingListId: input.listId,
      partId: input.partId,
      quantity,
      description: normalizeOptionalText(input.description)
    }
  });

  await prisma.part.update({
    where: { id: input.partId },
    data: { plannedQty: { increment: quantity } }
  });

  return item;
}

export async function updateShoppingListItem(input: {
  workspaceId: string;
  listId: string;
  itemId: string;
  quantity: string;
  description?: string | null;
}) {
  await assertItemBelongsToList(input.workspaceId, input.listId, input.itemId);

  const newQuantity = parseQuantity(input.quantity);

  const oldItem = await prisma.shoppingListItem.findUniqueOrThrow({
    where: { id: input.itemId },
    select: { partId: true, quantity: true, purchaseOrderItems: { select: { id: true }, take: 1 } }
  });

  const updated = await prisma.shoppingListItem.update({
    where: { id: input.itemId },
    data: {
      quantity: newQuantity,
      description: normalizeOptionalText(input.description)
    }
  });

  if (oldItem.purchaseOrderItems.length === 0) {
    const delta = newQuantity.minus(oldItem.quantity);
    if (!delta.isZero()) {
      await prisma.part.update({
        where: { id: oldItem.partId },
        data: { plannedQty: { increment: delta } }
      });
    }
  }

  return updated;
}

export async function removeShoppingListItem(input: {
  workspaceId: string;
  listId: string;
  itemId: string;
}) {
  await assertItemBelongsToList(input.workspaceId, input.listId, input.itemId);

  const item = await prisma.shoppingListItem.findUniqueOrThrow({
    where: { id: input.itemId },
    select: { partId: true, quantity: true, purchaseOrderItems: { select: { id: true }, take: 1 } }
  });

  await prisma.shoppingListItem.delete({ where: { id: input.itemId } });

  if (item.purchaseOrderItems.length === 0) {
    await prisma.part.update({
      where: { id: item.partId },
      data: { plannedQty: { decrement: item.quantity } }
    });
  }
}

export async function convertShoppingListToOrder(input: {
  workspaceId: string;
  listId: string;
  selectedItemIds: string[];
  supplierId?: string | null;
  existingOrderId?: string | null;
}) {
  if (input.selectedItemIds.length === 0) {
    throw new Error("no-items-selected");
  }
  if (!input.supplierId && !input.existingOrderId) {
    throw new Error("supplier-or-order-required");
  }

  await assertListBelongsToWorkspace(input.workspaceId, input.listId);

  const items = await prisma.shoppingListItem.findMany({
    where: {
      id: { in: input.selectedItemIds },
      shoppingListId: input.listId
    },
    select: {
      id: true,
      partId: true,
      quantity: true,
      description: true,
      _count: { select: { purchaseOrderItems: true } }
    }
  });

  if (items.length === 0) throw new Error("items-not-found");

  const alreadyConverted = items.some((i) => i._count.purchaseOrderItems > 0);
  if (alreadyConverted) throw new Error("items-already-on-order");

  const newItems = items.map((item) => ({
    partId: item.partId,
    sourceShoppingListItemId: item.id,
    quantity: item.quantity,
    notes: item.description
  }));

  if (input.existingOrderId) {
    const order = await prisma.purchaseOrder.findFirst({
      where: { id: input.existingOrderId, workspaceId: input.workspaceId },
      select: { id: true, status: true }
    });
    if (!order) throw new Error("purchase-order-not-found");
    if (order.status !== "DRAFT") throw new Error("order-not-in-draft");

    await prisma.purchaseOrderItem.createMany({
      data: newItems.map((item) => ({ ...item, purchaseOrderId: input.existingOrderId! }))
    });

    return prisma.purchaseOrder.findUniqueOrThrow({ where: { id: input.existingOrderId } });
  }

  const supplier = await prisma.organization.findFirst({
    where: { id: input.supplierId!, workspaceId: input.workspaceId }
  });
  if (!supplier) throw new Error("supplier-not-found");

  return prisma.purchaseOrder.create({
    data: {
      workspaceId: input.workspaceId,
      supplierId: input.supplierId!,
      sourceShoppingListId: input.listId,
      items: { create: newItems }
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

function sumQtyByPartId(
  items: Array<{ partId: string; quantity: Prisma.Decimal }>
): Map<string, Prisma.Decimal> {
  const result = new Map<string, Prisma.Decimal>();
  for (const item of items) {
    result.set(
      item.partId,
      (result.get(item.partId) ?? new Prisma.Decimal(0)).plus(item.quantity)
    );
  }
  return result;
}

function normalizeOptionalText(value?: string | null) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}
