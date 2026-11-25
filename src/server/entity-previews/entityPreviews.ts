import "server-only";

import { prisma } from "@/server/db/prisma";

// The few key fields an entity link shows on hover (#123). Each query is scoped to the workspace
// and selects only what the preview shows, so hovering a link stays cheap.

export type PartPreview = {
  id: string;
  manufacturerName: string;
  catalogNumber: string;
  description: string | null;
};

export type PurchaseOrderPreview = {
  id: string;
  orderNumber: string | null;
  status: "DRAFT" | "ORDERED" | "RECEIVED";
  supplierName: string;
  itemCount: number;
};

export type ShoppingListPreview = {
  id: string;
  name: string;
  description: string | null;
  itemCount: number;
};

export async function getPartPreview(workspaceId: string, partId: string): Promise<PartPreview | null> {
  const part = await prisma.part.findFirst({
    where: { id: partId, workspaceId },
    select: {
      id: true,
      catalogNumber: true,
      description: true,
      manufacturer: { select: { name: true } }
    }
  });
  if (!part) return null;
  return {
    id: part.id,
    manufacturerName: part.manufacturer.name,
    catalogNumber: part.catalogNumber,
    description: part.description
  };
}

export async function getPurchaseOrderPreview(
  workspaceId: string,
  orderId: string
): Promise<PurchaseOrderPreview | null> {
  const order = await prisma.purchaseOrder.findFirst({
    where: { id: orderId, workspaceId },
    select: {
      id: true,
      orderNumber: true,
      status: true,
      supplier: { select: { name: true } },
      _count: { select: { items: true } }
    }
  });
  if (!order) return null;
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    status: order.status,
    supplierName: order.supplier.name,
    itemCount: order._count.items
  };
}

export async function getShoppingListPreview(
  workspaceId: string,
  listId: string
): Promise<ShoppingListPreview | null> {
  const list = await prisma.shoppingList.findFirst({
    where: { id: listId, workspaceId },
    select: {
      id: true,
      name: true,
      description: true,
      _count: { select: { items: true } }
    }
  });
  if (!list) return null;
  return {
    id: list.id,
    name: list.name,
    description: list.description,
    itemCount: list._count.items
  };
}
