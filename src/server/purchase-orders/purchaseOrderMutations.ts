import "server-only";

import { Prisma } from "@/generated/prisma/client";
import { createInventoryEntry } from "@/server/inventory/entryMutations";
import { prisma } from "@/server/db/prisma";

export type PurchaseOrderItem = {
  id: string;
  partId: string;
  partCatalogNumber: string;
  partDescription: string | null;
  manufacturerName: string;
  sourceShoppingListItemId: string | null;
  quantity: string;
  receivedQuantity: string;
  supplierSku: string | null;
  unitPrice: string | null;
  currency: string | null;
  notes: string | null;
};

export type PurchaseOrderDetail = {
  id: string;
  supplierId: string;
  supplierName: string;
  sourceShoppingListId: string | null;
  status: "DRAFT" | "ORDERED" | "RECEIVED";
  orderNumber: string | null;
  orderedAt: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  items: PurchaseOrderItem[];
};

export type PurchaseOrderSummary = {
  id: string;
  supplierId: string;
  supplierName: string;
  status: "DRAFT" | "ORDERED" | "RECEIVED";
  orderNumber: string | null;
  itemCount: number;
  createdAt: string;
  updatedAt: string;
};

export async function getPurchaseOrders(workspaceId: string): Promise<PurchaseOrderSummary[]> {
  const orders = await prisma.purchaseOrder.findMany({
    where: { workspaceId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      status: true,
      orderNumber: true,
      createdAt: true,
      updatedAt: true,
      supplier: { select: { name: true, id: true } },
      _count: { select: { items: true } }
    }
  });

  return orders.map((order) => ({
    id: order.id,
    supplierId: order.supplier.id,
    supplierName: order.supplier.name,
    status: order.status,
    orderNumber: order.orderNumber,
    itemCount: order._count.items,
    createdAt: order.createdAt.toISOString(),
    updatedAt: order.updatedAt.toISOString()
  }));
}

export async function getPurchaseOrderDetail(
  workspaceId: string,
  orderId: string
): Promise<PurchaseOrderDetail | null> {
  const order = await prisma.purchaseOrder.findFirst({
    where: { id: orderId, workspaceId },
    select: {
      id: true,
      sourceShoppingListId: true,
      status: true,
      orderNumber: true,
      orderedAt: true,
      notes: true,
      createdAt: true,
      updatedAt: true,
      supplier: { select: { id: true, name: true } },
      items: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          partId: true,
          sourceShoppingListItemId: true,
          quantity: true,
          receivedQuantity: true,
          supplierSku: true,
          unitPrice: true,
          currency: true,
          notes: true,
          part: {
            select: {
              catalogNumber: true,
              description: true,
              manufacturer: { select: { name: true } }
            }
          }
        }
      }
    }
  });

  if (!order) return null;

  return {
    id: order.id,
    supplierId: order.supplier.id,
    supplierName: order.supplier.name,
    sourceShoppingListId: order.sourceShoppingListId,
    status: order.status,
    orderNumber: order.orderNumber,
    orderedAt: order.orderedAt?.toISOString() ?? null,
    notes: order.notes,
    createdAt: order.createdAt.toISOString(),
    updatedAt: order.updatedAt.toISOString(),
    items: order.items.map((item) => ({
      id: item.id,
      partId: item.partId,
      partCatalogNumber: item.part.catalogNumber,
      partDescription: item.part.description,
      manufacturerName: item.part.manufacturer.name,
      sourceShoppingListItemId: item.sourceShoppingListItemId,
      quantity: item.quantity.toString(),
      receivedQuantity: item.receivedQuantity.toString(),
      supplierSku: item.supplierSku,
      unitPrice: item.unitPrice?.toString() ?? null,
      currency: item.currency,
      notes: item.notes
    }))
  };
}

export async function createPurchaseOrder(input: {
  workspaceId: string;
  supplierId: string;
  orderNumber?: string | null;
  notes?: string | null;
}) {
  await assertSupplierBelongsToWorkspace(input.workspaceId, input.supplierId);

  return prisma.purchaseOrder.create({
    data: {
      workspaceId: input.workspaceId,
      supplierId: input.supplierId,
      orderNumber: normalizeOptionalText(input.orderNumber),
      notes: normalizeOptionalText(input.notes)
    }
  });
}

export async function updatePurchaseOrder(input: {
  workspaceId: string;
  orderId: string;
  supplierId?: string;
  orderNumber?: string | null;
  notes?: string | null;
}) {
  const order = await assertOrderBelongsToWorkspace(input.workspaceId, input.orderId);

  if (order.status === "RECEIVED") {
    throw new Error("order-already-received");
  }

  if (input.supplierId && input.supplierId !== order.supplierId) {
    await assertSupplierBelongsToWorkspace(input.workspaceId, input.supplierId);
  }

  return prisma.purchaseOrder.update({
    where: { id: input.orderId },
    data: {
      ...(input.supplierId ? { supplierId: input.supplierId } : {}),
      orderNumber: normalizeOptionalText(input.orderNumber),
      notes: normalizeOptionalText(input.notes)
    }
  });
}

export async function deletePurchaseOrder(input: {
  workspaceId: string;
  orderId: string;
}) {
  const order = await assertOrderBelongsToWorkspace(input.workspaceId, input.orderId);

  if (order.status !== "DRAFT") {
    throw new Error("only-draft-orders-can-be-deleted");
  }

  await prisma.purchaseOrder.delete({ where: { id: input.orderId } });
}

export async function addOrderItem(input: {
  workspaceId: string;
  orderId: string;
  partId: string;
  quantity: string;
  supplierSku?: string | null;
  unitPrice?: string | null;
  currency?: string | null;
  notes?: string | null;
  sourceShoppingListItemId?: string | null;
}) {
  const order = await assertOrderBelongsToWorkspace(input.workspaceId, input.orderId);

  if (order.status === "RECEIVED") {
    throw new Error("order-already-received");
  }

  await assertPartBelongsToWorkspace(input.workspaceId, input.partId);

  const quantity = parseQuantity(input.quantity);
  const unitPrice = input.unitPrice ? parseUnitPrice(input.unitPrice) : null;

  return prisma.purchaseOrderItem.create({
    data: {
      purchaseOrderId: input.orderId,
      partId: input.partId,
      quantity,
      supplierSku: normalizeOptionalText(input.supplierSku),
      unitPrice,
      currency: normalizeOptionalText(input.currency),
      notes: normalizeOptionalText(input.notes),
      sourceShoppingListItemId: input.sourceShoppingListItemId ?? null
    }
  });
}

export async function updateOrderItem(input: {
  workspaceId: string;
  orderId: string;
  itemId: string;
  quantity: string;
  supplierSku?: string | null;
  unitPrice?: string | null;
  currency?: string | null;
  notes?: string | null;
}) {
  const order = await assertOrderBelongsToWorkspace(input.workspaceId, input.orderId);

  if (order.status === "RECEIVED") {
    throw new Error("order-already-received");
  }

  await assertItemBelongsToOrder(input.orderId, input.itemId);

  const quantity = parseQuantity(input.quantity);
  const unitPrice = input.unitPrice ? parseUnitPrice(input.unitPrice) : null;

  return prisma.purchaseOrderItem.update({
    where: { id: input.itemId },
    data: {
      quantity,
      supplierSku: normalizeOptionalText(input.supplierSku),
      unitPrice,
      currency: normalizeOptionalText(input.currency),
      notes: normalizeOptionalText(input.notes)
    }
  });
}

export async function removeOrderItem(input: {
  workspaceId: string;
  orderId: string;
  itemId: string;
}) {
  const order = await assertOrderBelongsToWorkspace(input.workspaceId, input.orderId);

  if (order.status === "RECEIVED") {
    throw new Error("order-already-received");
  }

  await assertItemBelongsToOrder(input.orderId, input.itemId);
  await prisma.purchaseOrderItem.delete({ where: { id: input.itemId } });
}

export async function markOrdered(input: {
  workspaceId: string;
  orderId: string;
}) {
  const order = await assertOrderBelongsToWorkspace(input.workspaceId, input.orderId);

  if (order.status !== "DRAFT") {
    throw new Error("order-not-in-draft");
  }

  const itemCount = await prisma.purchaseOrderItem.count({
    where: { purchaseOrderId: input.orderId }
  });

  if (itemCount === 0) {
    throw new Error("order-has-no-items");
  }

  return prisma.purchaseOrder.update({
    where: { id: input.orderId },
    data: { status: "ORDERED", orderedAt: new Date() }
  });
}

export type ReceiveItemInput = {
  itemId: string;
  quantity: string;
  locationId: string;
};

export async function receiveItems(input: {
  workspaceId: string;
  orderId: string;
  createdByUserId: string;
  items: ReceiveItemInput[];
}) {
  if (input.items.length === 0) {
    throw new Error("no-items-to-receive");
  }

  const order = await assertOrderBelongsToWorkspace(input.workspaceId, input.orderId);

  if (order.status === "DRAFT") {
    throw new Error("order-not-ordered");
  }
  if (order.status === "RECEIVED") {
    throw new Error("order-already-received");
  }

  const orderItems = await prisma.purchaseOrderItem.findMany({
    where: {
      purchaseOrderId: input.orderId,
      id: { in: input.items.map((i) => i.itemId) }
    },
    select: {
      id: true,
      partId: true,
      quantity: true,
      receivedQuantity: true,
      part: { select: { unit: { select: { allowsFraction: true } } } }
    }
  });

  if (orderItems.length !== input.items.length) {
    throw new Error("items-not-found");
  }

  const receiveMap = new Map(input.items.map((i) => [i.itemId, i]));

  return prisma.$transaction(async (tx) => {
    for (const orderItem of orderItems) {
      const receiveInput = receiveMap.get(orderItem.id)!;
      const qty = parseQuantity(receiveInput.quantity);

      if (!orderItem.part.unit.allowsFraction && !qty.isInteger()) {
        throw new Error("fractional-quantity-not-allowed");
      }

      const alreadyReceived = new Prisma.Decimal(orderItem.receivedQuantity);
      const ordered = new Prisma.Decimal(orderItem.quantity);
      const remaining = ordered.minus(alreadyReceived);

      if (qty.greaterThan(remaining)) {
        throw new Error("receive-exceeds-ordered-quantity");
      }

      await tx.purchaseOrderItem.update({
        where: { id: orderItem.id },
        data: { receivedQuantity: { increment: qty } }
      });

      await createInventoryEntry({
        workspaceId: input.workspaceId,
        partId: orderItem.partId,
        entryType: "RECEIPT",
        quantity: qty.toString(),
        toLocationId: receiveInput.locationId,
        createdByUserId: input.createdByUserId
      });
    }

    const allItems = await tx.purchaseOrderItem.findMany({
      where: { purchaseOrderId: input.orderId },
      select: { quantity: true, receivedQuantity: true }
    });

    const allReceived = allItems.every((item) =>
      new Prisma.Decimal(item.receivedQuantity).greaterThanOrEqualTo(
        new Prisma.Decimal(item.quantity)
      )
    );

    if (allReceived) {
      await tx.purchaseOrder.update({
        where: { id: input.orderId },
        data: { status: "RECEIVED" }
      });
    }
  });
}

export type SupplierLookupResult =
  | { ok: true; supplierSku: string; unitPrice: null }
  | { ok: false; reason: "no-provider" | "not-found" | "lookup-failed" };

export async function lookupSupplierItem(input: {
  workspaceId: string;
  partId: string;
}): Promise<SupplierLookupResult> {
  const part = await prisma.part.findFirst({
    where: { id: input.partId, workspaceId: input.workspaceId },
    select: { catalogNumber: true }
  });

  if (!part) return { ok: false, reason: "not-found" };

  const workspace = await prisma.workspace.findUnique({
    where: { id: input.workspaceId },
    select: { activeSupplierProvider: true }
  });

  if (!workspace?.activeSupplierProvider) {
    return { ok: false, reason: "no-provider" };
  }

  const { getSupplierPartSearchProvider } = await import(
    "@/server/integrations/providers"
  );

  const providerKeyMap: Record<string, string> = {
    DIGIKEY: "digikey",
    TME: "tme",
    MOUSER: "mouser"
  };

  const providerKey = providerKeyMap[workspace.activeSupplierProvider];
  if (!providerKey) return { ok: false, reason: "no-provider" };

  const provider = getSupplierPartSearchProvider(
    providerKey as "digikey" | "tme" | "mouser"
  );
  if (!provider) return { ok: false, reason: "no-provider" };

  try {
    const result = await provider.searchParts({
      workspaceId: input.workspaceId,
      query: part.catalogNumber,
      limit: 1
    });

    if (!result.ok || result.page.items.length === 0) {
      return { ok: false, reason: "not-found" };
    }

    return { ok: true, supplierSku: result.page.items[0].catalogNumber, unitPrice: null };
  } catch {
    return { ok: false, reason: "lookup-failed" };
  }
}

async function assertOrderBelongsToWorkspace(workspaceId: string, orderId: string) {
  const order = await prisma.purchaseOrder.findFirst({
    where: { id: orderId, workspaceId },
    select: { id: true, status: true, supplierId: true }
  });
  if (!order) throw new Error("purchase-order-not-found");
  return order;
}

async function assertItemBelongsToOrder(orderId: string, itemId: string) {
  const item = await prisma.purchaseOrderItem.findFirst({
    where: { id: itemId, purchaseOrderId: orderId },
    select: { id: true }
  });
  if (!item) throw new Error("purchase-order-item-not-found");
}

async function assertSupplierBelongsToWorkspace(workspaceId: string, supplierId: string) {
  const org = await prisma.organization.findFirst({
    where: { id: supplierId, workspaceId },
    select: { id: true }
  });
  if (!org) throw new Error("supplier-not-found");
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

function parseUnitPrice(rawValue: string) {
  const normalized = rawValue.trim();
  if (!normalized) return null;

  let price: Prisma.Decimal;
  try {
    price = new Prisma.Decimal(normalized);
  } catch {
    throw new Error("invalid-unit-price");
  }

  if (price.lessThan(0)) throw new Error("invalid-unit-price");
  return price;
}

function normalizeOptionalText(value?: string | null) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}
