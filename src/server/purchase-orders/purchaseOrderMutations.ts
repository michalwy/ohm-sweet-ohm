import "server-only";

import { Prisma } from "@/generated/prisma/client";
import { createInventoryEntry } from "@/server/inventory/entryMutations";
import { prisma } from "@/server/db/prisma";
import { batchGetExchangeRates, convertToWorkspacePrimary } from "@/server/currency/exchangeRates";
import {
  decodeListCursor,
  encodeListCursor,
  getListPageSize,
  type ListPage
} from "@/server/pagination";

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
  taxRate: string | null;
  notes: string | null;
};

export type PurchaseOrderDetail = {
  id: string;
  supplierId: string;
  supplierName: string;
  sourceShoppingListId: string | null;
  status: "DRAFT" | "ORDERED" | "RECEIVED";
  orderNumber: string | null;
  supplierOrderNumber: string | null;
  currency: string | null;
  taxRate: string | null;
  priceEntryMode: "net" | "gross";
  supplierDefaultTaxRate: string | null;
  supplierDefaultPriceEntryMode: string | null;
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
  supplierOrderNumber: string | null;
  currency: string | null;
  taxRate: string | null;
  priceEntryMode: "net" | "gross";
  orderedAt: string | null;
  notes: string | null;
  createdByName: string | null;
  itemCount: number;
  totalNetValue: string | null;
  totalGrossValue: string | null;
  totalNetValuePrimary: string | null;
  totalGrossValuePrimary: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PurchaseOrderSortBy =
  | "supplierName"
  | "orderNumber"
  | "status"
  | "itemCount"
  | "createdAt";
export type PurchaseOrderSortDirection = "asc" | "desc";

export type PurchaseOrdersPageInput = {
  cursor?: string | null;
  pageSize?: number | null;
  sortBy?: PurchaseOrderSortBy | null;
  sortDirection?: PurchaseOrderSortDirection | null;
};

type SupplierNameCursor = { supplierName: string; id: string };
type OrderNumberCursor = { orderNumber: string | null; id: string };
type CreatedAtCursor = { createdAt: string; id: string };
type OffsetCursor = { offset: number };

const STATUS_RANK: Record<string, number> = { DRAFT: 0, ORDERED: 1, RECEIVED: 2 };

const orderSelectShape = {
  id: true,
  status: true,
  orderNumber: true,
  supplierOrderNumber: true,
  currency: true,
  taxRate: true,
  priceEntryMode: true,
  orderedAt: true,
  notes: true,
  createdAt: true,
  updatedAt: true,
  supplier: { select: { name: true, id: true } },
  createdByUser: { select: { name: true } },
  _count: { select: { items: true } },
  items: {
    select: {
      unitPrice: true,
      currency: true,
      taxRate: true,
      quantity: true
    }
  }
} as const;

function computeOrderTotals(
  order: {
    currency: string | null;
    taxRate: Prisma.Decimal | null;
    orderedAt: Date | null;
    items: Array<{
      unitPrice: Prisma.Decimal | null;
      currency: string | null;
      taxRate: Prisma.Decimal | null;
      quantity: Prisma.Decimal;
    }>;
  },
  primaryCurrency: string,
  rateMap: Map<string, Prisma.Decimal | null>
): {
  totalNetValue: string | null;
  totalGrossValue: string | null;
  totalNetValuePrimary: string | null;
  totalGrossValuePrimary: string | null;
} {
  let netTotal = new Prisma.Decimal(0);
  let grossTotal = new Prisma.Decimal(0);
  let hasPrices = false;

  for (const item of order.items) {
    if (!item.unitPrice) continue;
    const effectiveCurrency = item.currency ?? order.currency;
    // Only sum items whose currency matches the order currency
    if (effectiveCurrency !== order.currency) continue;

    hasPrices = true;
    const lineNet = item.quantity.mul(item.unitPrice);
    const effectiveTaxRate = item.taxRate ?? order.taxRate ?? new Prisma.Decimal(0);
    const lineGross = lineNet.mul(new Prisma.Decimal(1).plus(effectiveTaxRate.div(100)));
    netTotal = netTotal.plus(lineNet);
    grossTotal = grossTotal.plus(lineGross);
  }

  if (!hasPrices) {
    return { totalNetValue: null, totalGrossValue: null, totalNetValuePrimary: null, totalGrossValuePrimary: null };
  }

  const netStr = netTotal.toDecimalPlaces(4).toString();
  const grossStr = grossTotal.toDecimalPlaces(4).toString();

  // Convert to primary currency using the orderedAt date rate
  const poCurrency = order.currency;
  if (!poCurrency || poCurrency === primaryCurrency) {
    return {
      totalNetValue: netStr,
      totalGrossValue: grossStr,
      totalNetValuePrimary: netStr,
      totalGrossValuePrimary: grossStr
    };
  }

  if (!order.orderedAt) {
    // DRAFT: no frozen rate yet
    return { totalNetValue: netStr, totalGrossValue: grossStr, totalNetValuePrimary: null, totalGrossValuePrimary: null };
  }

  const dateStr = formatRateKey(order.orderedAt);
  const rateKey = `${poCurrency}:${primaryCurrency}:${dateStr}`;
  const rate = rateMap.get(rateKey) ?? null;

  if (!rate) {
    return { totalNetValue: netStr, totalGrossValue: grossStr, totalNetValuePrimary: null, totalGrossValuePrimary: null };
  }

  return {
    totalNetValue: netStr,
    totalGrossValue: grossStr,
    totalNetValuePrimary: netTotal.mul(rate).toDecimalPlaces(4).toString(),
    totalGrossValuePrimary: grossTotal.mul(rate).toDecimalPlaces(4).toString()
  };
}

function formatRateKey(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function toOrderSummary(
  order: {
    id: string;
    status: "DRAFT" | "ORDERED" | "RECEIVED";
    orderNumber: string | null;
    supplierOrderNumber: string | null;
    currency: string | null;
    taxRate: Prisma.Decimal | null;
    priceEntryMode: string;
    orderedAt: Date | null;
    notes: string | null;
    createdAt: Date;
    updatedAt: Date;
    supplier: { id: string; name: string };
    createdByUser: { name: string | null } | null;
    _count: { items: number };
    items: Array<{
      unitPrice: Prisma.Decimal | null;
      currency: string | null;
      taxRate: Prisma.Decimal | null;
      quantity: Prisma.Decimal;
    }>;
  },
  primaryCurrency: string,
  rateMap: Map<string, Prisma.Decimal | null>
): PurchaseOrderSummary {
  const totals = computeOrderTotals(order, primaryCurrency, rateMap);
  return {
    id: order.id,
    supplierId: order.supplier.id,
    supplierName: order.supplier.name,
    status: order.status,
    orderNumber: order.orderNumber,
    supplierOrderNumber: order.supplierOrderNumber,
    currency: order.currency,
    taxRate: order.taxRate?.toString() ?? null,
    priceEntryMode: (order.priceEntryMode === "gross" ? "gross" : "net") as "net" | "gross",
    orderedAt: order.orderedAt?.toISOString() ?? null,
    notes: order.notes,
    createdByName: order.createdByUser?.name ?? null,
    itemCount: order._count.items,
    ...totals,
    createdAt: order.createdAt.toISOString(),
    updatedAt: order.updatedAt.toISOString()
  };
}

async function buildRateMap(
  rows: Array<{ currency: string | null; orderedAt: Date | null }>,
  primaryCurrency: string
): Promise<Map<string, Prisma.Decimal | null>> {
  const requests: Array<{ from: string; to: string; date: Date }> = [];
  for (const row of rows) {
    if (row.currency && row.currency !== primaryCurrency && row.orderedAt) {
      requests.push({ from: row.currency, to: primaryCurrency, date: row.orderedAt });
    }
  }
  return batchGetExchangeRates(requests);
}

export async function getPurchaseOrders(
  workspaceId: string,
  input: PurchaseOrdersPageInput = {}
): Promise<ListPage<PurchaseOrderSummary>> {
  const size = getListPageSize(input.pageSize);
  const sortBy = input.sortBy ?? "createdAt";
  const dir = input.sortDirection ?? (sortBy === "createdAt" ? "desc" : "asc");

  const [totalCount, workspace] = await Promise.all([
    prisma.purchaseOrder.count({ where: { workspaceId } }),
    prisma.workspace.findUniqueOrThrow({ where: { id: workspaceId }, select: { primaryCurrency: true } })
  ]);
  const primaryCurrency = workspace.primaryCurrency;

  if (sortBy === "status" || sortBy === "itemCount") {
    const cursor = decodeListCursor<OffsetCursor>(input.cursor);
    const offset = cursor?.offset ?? 0;

    const all = await prisma.purchaseOrder.findMany({
      where: { workspaceId },
      select: orderSelectShape
    });

    if (sortBy === "status") {
      all.sort((a, b) => {
        const diff = (STATUS_RANK[a.status] ?? 0) - (STATUS_RANK[b.status] ?? 0);
        return dir === "asc" ? diff : -diff;
      });
    } else {
      all.sort((a, b) => {
        const diff = a._count.items - b._count.items;
        return dir === "asc" ? diff : -diff;
      });
    }

    const sliced = all.slice(offset, offset + size + 1);
    const hasMore = sliced.length > size;
    const page = sliced.slice(0, size);
    const rateMap = await buildRateMap(page, primaryCurrency);
    const items = page.map((o) => toOrderSummary(o, primaryCurrency, rateMap));
    const nextCursor = hasMore
      ? encodeListCursor<OffsetCursor>({ offset: offset + size })
      : null;

    return { items, nextCursor, totalCount, filteredCount: totalCount };
  }

  if (sortBy === "supplierName") {
    const cursor = decodeListCursor<SupplierNameCursor>(input.cursor);

    const rows = await prisma.purchaseOrder.findMany({
      where: {
        workspaceId,
        ...(cursor
          ? {
              OR: [
                {
                  supplier: {
                    name: dir === "asc" ? { gt: cursor.supplierName } : { lt: cursor.supplierName }
                  }
                },
                {
                  supplier: { name: cursor.supplierName },
                  id: dir === "asc" ? { gt: cursor.id } : { lt: cursor.id }
                }
              ]
            }
          : {})
      },
      orderBy: [{ supplier: { name: dir } }, { id: dir }],
      take: size + 1,
      select: orderSelectShape
    });

    const hasMore = rows.length > size;
    const page = rows.slice(0, size);
    const rateMap = await buildRateMap(page, primaryCurrency);
    const items = page.map((o) => toOrderSummary(o, primaryCurrency, rateMap));
    const last = items[items.length - 1];
    const nextCursor =
      hasMore && last
        ? encodeListCursor<SupplierNameCursor>({ supplierName: last.supplierName, id: last.id })
        : null;

    return { items, nextCursor, totalCount, filteredCount: totalCount };
  }

  if (sortBy === "orderNumber") {
    const cursor = decodeListCursor<OrderNumberCursor>(input.cursor);

    const rows = await prisma.purchaseOrder.findMany({
      where: {
        workspaceId,
        ...(cursor
          ? {
              OR: [
                {
                  orderNumber:
                    dir === "asc"
                      ? { gt: cursor.orderNumber ?? "" }
                      : { lt: cursor.orderNumber ?? "" }
                },
                {
                  orderNumber: cursor.orderNumber,
                  id: dir === "asc" ? { gt: cursor.id } : { lt: cursor.id }
                }
              ]
            }
          : {})
      },
      orderBy: [{ orderNumber: dir }, { id: dir }],
      take: size + 1,
      select: orderSelectShape
    });

    const hasMore = rows.length > size;
    const page = rows.slice(0, size);
    const rateMap = await buildRateMap(page, primaryCurrency);
    const items = page.map((o) => toOrderSummary(o, primaryCurrency, rateMap));
    const last = items[items.length - 1];
    const nextCursor =
      hasMore && last
        ? encodeListCursor<OrderNumberCursor>({ orderNumber: last.orderNumber, id: last.id })
        : null;

    return { items, nextCursor, totalCount, filteredCount: totalCount };
  }

  // Default: createdAt sort
  const cursor = decodeListCursor<CreatedAtCursor>(input.cursor);
  const createdAtDir = dir === "asc" ? "asc" : "desc";

  const rows = await prisma.purchaseOrder.findMany({
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
    orderBy: [
      { createdAt: createdAtDir },
      { id: createdAtDir === "desc" ? "asc" : "desc" }
    ],
    take: size + 1,
    select: orderSelectShape
  });

  const hasMore = rows.length > size;
  const page = rows.slice(0, size);
  const rateMap = await buildRateMap(page, primaryCurrency);
  const items = page.map((o) => toOrderSummary(o, primaryCurrency, rateMap));
  const last = items[items.length - 1];
  const nextCursor =
    hasMore && last
      ? encodeListCursor<CreatedAtCursor>({ createdAt: last.createdAt, id: last.id })
      : null;

  return { items, nextCursor, totalCount, filteredCount: totalCount };
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
      supplierOrderNumber: true,
      currency: true,
      taxRate: true,
      priceEntryMode: true,
      orderedAt: true,
      notes: true,
      createdAt: true,
      updatedAt: true,
      supplier: {
        select: {
          id: true,
          name: true,
          defaultTaxRate: true,
          defaultPriceEntryMode: true
        }
      },
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
          taxRate: true,
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
    supplierOrderNumber: order.supplierOrderNumber,
    currency: order.currency,
    taxRate: order.taxRate?.toString() ?? null,
    priceEntryMode: (order.priceEntryMode === "gross" ? "gross" : "net") as "net" | "gross",
    supplierDefaultTaxRate: order.supplier.defaultTaxRate?.toString() ?? null,
    supplierDefaultPriceEntryMode: order.supplier.defaultPriceEntryMode,
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
      taxRate: item.taxRate?.toString() ?? null,
      notes: item.notes
    }))
  };
}

export async function generateOrderNumber(workspaceId: string): Promise<string> {
  const year = new Date().getFullYear();
  const count = await prisma.purchaseOrder.count({ where: { workspaceId } });
  return `PO-${year}-${String(count + 1).padStart(3, "0")}`;
}

export async function createPurchaseOrder(input: {
  workspaceId: string;
  supplierId: string;
  createdByUserId?: string | null;
  orderNumber?: string | null;
  currency?: string | null;
  taxRate?: string | null;
  priceEntryMode?: "net" | "gross" | null;
  notes?: string | null;
}) {
  await assertSupplierBelongsToWorkspace(input.workspaceId, input.supplierId);

  const orderNumber =
    normalizeOptionalText(input.orderNumber) ?? (await generateOrderNumber(input.workspaceId));

  return prisma.purchaseOrder.create({
    data: {
      workspaceId: input.workspaceId,
      supplierId: input.supplierId,
      createdByUserId: input.createdByUserId ?? null,
      orderNumber,
      currency: normalizeOptionalText(input.currency),
      taxRate: input.taxRate ? parseTaxRate(input.taxRate) : null,
      priceEntryMode: input.priceEntryMode ?? "net",
      notes: normalizeOptionalText(input.notes)
    }
  });
}

export async function updatePurchaseOrder(input: {
  workspaceId: string;
  orderId: string;
  supplierId?: string;
  orderNumber?: string | null;
  supplierOrderNumber?: string | null;
  currency?: string | null;
  taxRate?: string | null;
  orderedAt?: Date | null;
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
      supplierOrderNumber: normalizeOptionalText(input.supplierOrderNumber),
      currency: normalizeOptionalText(input.currency),
      ...(input.taxRate !== undefined ? { taxRate: input.taxRate ? parseTaxRate(input.taxRate) : null } : {}),
      ...(input.orderedAt !== undefined ? { orderedAt: input.orderedAt } : {}),
      notes: normalizeOptionalText(input.notes)
    }
  });
}

export async function deletePurchaseOrder(input: {
  workspaceId: string;
  orderId: string;
}) {
  const order = await assertOrderBelongsToWorkspace(input.workspaceId, input.orderId);

  if (order.status === "RECEIVED") {
    throw new Error("received-orders-cannot-be-deleted");
  }

  await prisma.$transaction(async (tx) => {
    const items = await tx.purchaseOrderItem.findMany({
      where: { purchaseOrderId: input.orderId },
      select: { partId: true, quantity: true, sourceShoppingListItemId: true }
    });

    await tx.purchaseOrder.delete({ where: { id: input.orderId } });

    if (order.status === "DRAFT") {
      const deltaByPartId = sumQtyByPartId(
        items.filter((item) => item.sourceShoppingListItemId === null)
      );
      for (const [partId, delta] of deltaByPartId) {
        await tx.part.update({
          where: { id: partId },
          data: { plannedQty: { decrement: delta } }
        });
      }
    } else {
      // ORDERED: decrement onOrderQty for all items; restore plannedQty for SL-sourced ones
      for (const item of items) {
        await tx.part.update({
          where: { id: item.partId },
          data: {
            onOrderQty: { decrement: item.quantity },
            ...(item.sourceShoppingListItemId !== null
              ? { plannedQty: { increment: item.quantity } }
              : {})
          }
        });
      }
    }
  });
}

export async function revertOrderToDraft(input: {
  workspaceId: string;
  orderId: string;
}) {
  const order = await assertOrderBelongsToWorkspace(input.workspaceId, input.orderId);

  if (order.status !== "ORDERED") {
    throw new Error("order-not-ordered");
  }

  const items = await prisma.purchaseOrderItem.findMany({
    where: { purchaseOrderId: input.orderId },
    select: { partId: true, quantity: true }
  });

  await prisma.$transaction(async (tx) => {
    await tx.purchaseOrder.update({
      where: { id: input.orderId },
      data: { status: "DRAFT", orderedAt: null }
    });

    const deltaByPartId = sumQtyByPartId(items);
    for (const [partId, delta] of deltaByPartId) {
      await tx.part.update({
        where: { id: partId },
        data: { onOrderQty: { decrement: delta }, plannedQty: { increment: delta } }
      });
    }
  });
}

export type DraftPurchaseOrderOption = {
  id: string;
  orderNumber: string | null;
  supplierName: string;
  supplierId: string;
  itemCount: number;
};

export async function getDraftPurchaseOrders(workspaceId: string): Promise<DraftPurchaseOrderOption[]> {
  const orders = await prisma.purchaseOrder.findMany({
    where: { workspaceId, status: "DRAFT" },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      orderNumber: true,
      supplier: { select: { id: true, name: true } },
      _count: { select: { items: true } }
    }
  });
  return orders.map((o) => ({
    id: o.id,
    orderNumber: o.orderNumber,
    supplierId: o.supplier.id,
    supplierName: o.supplier.name,
    itemCount: o._count.items
  }));
}

export async function addOrderItem(input: {
  workspaceId: string;
  orderId: string;
  partId: string;
  quantity: string;
  supplierSku?: string | null;
  unitPrice?: string | null;
  currency?: string | null;
  taxRate?: string | null;
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

  const item = await prisma.purchaseOrderItem.create({
    data: {
      purchaseOrderId: input.orderId,
      partId: input.partId,
      quantity,
      supplierSku: normalizeOptionalText(input.supplierSku),
      unitPrice,
      currency: normalizeOptionalText(input.currency),
      taxRate: input.taxRate ? parseTaxRate(input.taxRate) : null,
      notes: normalizeOptionalText(input.notes),
      sourceShoppingListItemId: input.sourceShoppingListItemId ?? null
    }
  });

  if (!input.sourceShoppingListItemId) {
    await prisma.part.update({
      where: { id: input.partId },
      data: { plannedQty: { increment: quantity } }
    });
  }

  return item;
}

export async function updateOrderItem(input: {
  workspaceId: string;
  orderId: string;
  itemId: string;
  quantity: string;
  supplierSku?: string | null;
  unitPrice?: string | null;
  currency?: string | null;
  taxRate?: string | null;
  notes?: string | null;
}) {
  const order = await assertOrderBelongsToWorkspace(input.workspaceId, input.orderId);

  if (order.status === "RECEIVED") {
    throw new Error("order-already-received");
  }

  await assertItemBelongsToOrder(input.orderId, input.itemId);

  const newQuantity = parseQuantity(input.quantity);
  const unitPrice = input.unitPrice ? parseUnitPrice(input.unitPrice) : null;

  const oldItem = await prisma.purchaseOrderItem.findUniqueOrThrow({
    where: { id: input.itemId },
    select: { partId: true, quantity: true, sourceShoppingListItemId: true }
  });

  const updated = await prisma.purchaseOrderItem.update({
    where: { id: input.itemId },
    data: {
      quantity: newQuantity,
      supplierSku: normalizeOptionalText(input.supplierSku),
      unitPrice,
      currency: normalizeOptionalText(input.currency),
      taxRate: input.taxRate !== undefined ? (input.taxRate ? parseTaxRate(input.taxRate) : null) : undefined,
      notes: normalizeOptionalText(input.notes)
    }
  });

  if (order.status === "DRAFT" && oldItem.sourceShoppingListItemId === null) {
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

  const item = await prisma.purchaseOrderItem.findUniqueOrThrow({
    where: { id: input.itemId },
    select: { partId: true, quantity: true, sourceShoppingListItemId: true }
  });

  await prisma.purchaseOrderItem.delete({ where: { id: input.itemId } });

  if (order.status === "DRAFT" && item.sourceShoppingListItemId === null) {
    await prisma.part.update({
      where: { id: item.partId },
      data: { plannedQty: { decrement: item.quantity } }
    });
  } else if (order.status === "ORDERED") {
    await prisma.part.update({
      where: { id: item.partId },
      data: {
        onOrderQty: { decrement: item.quantity },
        // SL item still exists, so restore its plannedQty contribution (markOrdered had decremented it)
        ...(item.sourceShoppingListItemId !== null
          ? { plannedQty: { increment: item.quantity } }
          : {})
      }
    });
  }
}

export async function markOrdered(input: {
  workspaceId: string;
  orderId: string;
}) {
  const order = await assertOrderBelongsToWorkspace(input.workspaceId, input.orderId);

  if (order.status !== "DRAFT") {
    throw new Error("order-not-in-draft");
  }

  const items = await prisma.purchaseOrderItem.findMany({
    where: { purchaseOrderId: input.orderId },
    select: { partId: true, quantity: true }
  });

  if (items.length === 0) {
    throw new Error("order-has-no-items");
  }

  await prisma.$transaction(async (tx) => {
    await tx.purchaseOrder.update({
      where: { id: input.orderId },
      data: { status: "ORDERED", orderedAt: new Date() }
    });

    const deltaByPartId = sumQtyByPartId(items);
    for (const [partId, delta] of deltaByPartId) {
      await tx.part.update({
        where: { id: partId },
        data: {
          plannedQty: { decrement: delta },
          onOrderQty: { increment: delta }
        }
      });
    }
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

  const [orderPricing, workspacePrimary] = await Promise.all([
    prisma.purchaseOrder.findUniqueOrThrow({
      where: { id: input.orderId },
      select: { currency: true, orderedAt: true }
    }),
    prisma.workspace.findUniqueOrThrow({
      where: { id: input.workspaceId },
      select: { primaryCurrency: true }
    })
  ]);
  const primaryCurrency = workspacePrimary.primaryCurrency;

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
      unitPrice: true,
      currency: true,
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

      // Compute unit cost for inventory tracking
      let unitCost: Prisma.Decimal | null = null;
      let costCurrency: string | null = null;
      let unitCostPrimary: Prisma.Decimal | null = null;
      if (orderItem.unitPrice != null) {
        unitCost = orderItem.unitPrice;
        costCurrency = orderItem.currency ?? orderPricing.currency ?? null;
        if (costCurrency) {
          if (costCurrency === primaryCurrency) {
            unitCostPrimary = unitCost;
          } else if (orderPricing.orderedAt) {
            unitCostPrimary = await convertToWorkspacePrimary(unitCost, costCurrency, primaryCurrency, orderPricing.orderedAt);
          }
        }
      }

      // createInventoryEntry runs in its own nested transaction; call it BEFORE
      // tx.part.update so both don't compete for a lock on the same Part row.
      await createInventoryEntry({
        workspaceId: input.workspaceId,
        partId: orderItem.partId,
        entryType: "RECEIPT",
        quantity: qty.toString(),
        toLocationId: receiveInput.locationId,
        createdByUserId: input.createdByUserId,
        unitCost,
        costCurrency,
        unitCostPrimary
      });

      await tx.purchaseOrderItem.update({
        where: { id: orderItem.id },
        data: { receivedQuantity: { increment: qty } }
      });

      await tx.part.update({
        where: { id: orderItem.partId },
        data: { onOrderQty: { decrement: qty } }
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

function parseTaxRate(rawValue: string) {
  const normalized = rawValue.trim();
  if (!normalized) return null;

  let rate: Prisma.Decimal;
  try {
    rate = new Prisma.Decimal(normalized);
  } catch {
    throw new Error("invalid-tax-rate");
  }

  if (rate.lessThan(0) || rate.greaterThanOrEqualTo(100)) throw new Error("invalid-tax-rate");
  return rate;
}

function normalizeOptionalText(value?: string | null) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
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
