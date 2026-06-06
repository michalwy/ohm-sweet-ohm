import "server-only";

import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/server/db/prisma";

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

export async function getShoppingLists(workspaceId: string): Promise<ShoppingListSummary[]> {
  const lists = await prisma.shoppingList.findMany({
    where: { workspaceId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      notes: true,
      createdAt: true,
      updatedAt: true,
      _count: { select: { items: true } }
    }
  });

  return lists.map((list) => ({
    id: list.id,
    name: list.name,
    notes: list.notes,
    itemCount: list._count.items,
    createdAt: list.createdAt.toISOString(),
    updatedAt: list.updatedAt.toISOString()
  }));
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
