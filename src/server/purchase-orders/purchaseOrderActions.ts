"use server";

import { authorizeWorkspacePermission } from "@/server/access-control/authorize";
import { getCurrentWorkspaceContextBySlug } from "@/server/auth/currentContext";
import {
  addOrderItem,
  createPurchaseOrder,
  deletePurchaseOrder,
  generateOrderNumber,
  getDraftPurchaseOrders,
  getPartPurchaseOrderHistory,
  getPurchaseOrderDetail,
  getPurchaseOrders,
  lookupSupplierItem,
  markOrdered,
  receiveItems,
  removeOrderItem,
  revertOrderToDraft,
  type DraftPurchaseOrderOption,
  type PartPurchaseOrderHistoryItem,
  type PurchaseOrderDetail,
  type PurchaseOrderSummary,
  type PurchaseOrdersPageInput,
  type ReceiveItemInput,
  type SupplierLookupResult,
  updateOrderItem,
  updatePurchaseOrder
} from "@/server/purchase-orders/purchaseOrderMutations";
import { ExchangeRateUnavailableError, getExchangeRate, saveManualExchangeRate } from "@/server/currency/exchangeRates";
import type { ListPage } from "@/server/pagination";
import { getSupplierOrganizationsForWorkspace, type SupplierSummary } from "@/server/organizations/organizations";

export type PurchaseOrderActionResult<T> =
  | { ok: true; data: T; submittedAt: number }
  | { ok: false; error: string; errorDetails?: { from: string; to: string; date: string }; submittedAt: number };

// --- Queries ---

export async function getPurchaseOrdersForWorkspace(
  input: { workspaceSlug: string } & PurchaseOrdersPageInput
): Promise<PurchaseOrderActionResult<ListPage<PurchaseOrderSummary>>> {
  try {
    const context = await getAuthorizedContext(input.workspaceSlug, "purchase-orders:read");
    const page = await getPurchaseOrders(context.workspace.id, {
      cursor: input.cursor,
      pageSize: input.pageSize,
      sortBy: input.sortBy,
      sortDirection: input.sortDirection,
      pinnedId: input.pinnedId
    });
    return success(page);
  } catch (error) {
    return failure(error);
  }
}

export async function getPurchaseOrderDetailForWorkspace(input: {
  workspaceSlug: string;
  orderId: string;
}): Promise<PurchaseOrderActionResult<PurchaseOrderDetail | null>> {
  try {
    const context = await getAuthorizedContext(input.workspaceSlug, "purchase-orders:read");
    return success(await getPurchaseOrderDetail(context.workspace.id, input.orderId));
  } catch (error) {
    return failure(error);
  }
}

export async function getPartPurchaseOrderHistoryForWorkspace(input: {
  workspaceSlug: string;
  partId: string;
}): Promise<PurchaseOrderActionResult<PartPurchaseOrderHistoryItem[]>> {
  try {
    const context = await getAuthorizedContext(input.workspaceSlug, "purchase-orders:read");
    return success(
      await getPartPurchaseOrderHistory({ workspaceId: context.workspace.id, partId: input.partId })
    );
  } catch (error) {
    return failure(error);
  }
}

export async function getNextOrderNumberForWorkspace(input: {
  workspaceSlug: string;
}): Promise<PurchaseOrderActionResult<{ orderNumber: string }>> {
  try {
    const context = await getAuthorizedContext(input.workspaceSlug, "purchase-orders:read");
    const orderNumber = await generateOrderNumber(context.workspace.id);
    return success({ orderNumber });
  } catch (error) {
    return failure(error);
  }
}

export async function searchSupplierOrganizationsForWorkspace(input: {
  workspaceSlug: string;
  searchQuery?: string;
}): Promise<PurchaseOrderActionResult<SupplierSummary[]>> {
  try {
    const context = await getAuthorizedContext(input.workspaceSlug, "purchase-orders:read");
    const results = await getSupplierOrganizationsForWorkspace({
      userId: context.user.id,
      workspaceId: context.workspace.id,
      searchQuery: input.searchQuery
    });
    return success(results);
  } catch (error) {
    return failure(error);
  }
}

export async function lookupSupplierItemForWorkspace(input: {
  workspaceSlug: string;
  partId: string;
}): Promise<PurchaseOrderActionResult<SupplierLookupResult>> {
  try {
    const context = await getAuthorizedContext(input.workspaceSlug, "purchase-orders:read");
    return success(await lookupSupplierItem({ workspaceId: context.workspace.id, partId: input.partId }));
  } catch (error) {
    return failure(error);
  }
}

// --- Mutations ---

export async function createPurchaseOrderForWorkspace(input: {
  workspaceSlug: string;
  supplierId: string;
  orderNumber?: string | null;
  currency?: string | null;
  taxRate?: string | null;
  priceEntryMode?: "net" | "gross" | null;
  notes?: string | null;
}): Promise<PurchaseOrderActionResult<{ orderId: string }>> {
  try {
    const context = await getAuthorizedContext(input.workspaceSlug, "purchase-orders:write");
    const order = await createPurchaseOrder({
      workspaceId: context.workspace.id,
      supplierId: input.supplierId,
      createdByUserId: context.user.id,
      orderNumber: input.orderNumber,
      currency: input.currency,
      taxRate: input.taxRate,
      priceEntryMode: input.priceEntryMode,
      notes: input.notes
    });
    return success({ orderId: order.id });
  } catch (error) {
    return failure(error);
  }
}

export async function updatePurchaseOrderForWorkspace(input: {
  workspaceSlug: string;
  orderId: string;
  supplierId?: string;
  orderNumber?: string | null;
  supplierOrderNumber?: string | null;
  currency?: string | null;
  taxRate?: string | null;
  orderedAt?: string | null;
  notes?: string | null;
}): Promise<PurchaseOrderActionResult<null>> {
  try {
    const context = await getAuthorizedContext(input.workspaceSlug, "purchase-orders:write");
    const orderedAt =
      input.orderedAt !== undefined
        ? input.orderedAt
          ? new Date(input.orderedAt)
          : null
        : undefined;
    await updatePurchaseOrder({
      workspaceId: context.workspace.id,
      orderId: input.orderId,
      supplierId: input.supplierId,
      orderNumber: input.orderNumber,
      supplierOrderNumber: input.supplierOrderNumber,
      currency: input.currency,
      taxRate: input.taxRate,
      orderedAt,
      notes: input.notes
    });
    return success(null);
  } catch (error) {
    return failure(error);
  }
}

export async function deletePurchaseOrderForWorkspace(input: {
  workspaceSlug: string;
  orderId: string;
}): Promise<PurchaseOrderActionResult<null>> {
  try {
    const context = await getAuthorizedContext(input.workspaceSlug, "purchase-orders:write");
    await deletePurchaseOrder({ workspaceId: context.workspace.id, orderId: input.orderId });
    return success(null);
  } catch (error) {
    return failure(error);
  }
}

export async function addOrderItemForWorkspace(input: {
  workspaceSlug: string;
  orderId: string;
  partId: string;
  quantity: string;
  supplierSku?: string | null;
  unitPrice?: string | null;
  lineNetTotal?: string | null;
  currency?: string | null;
  taxRate?: string | null;
  notes?: string | null;
  sourceShoppingListItemId?: string | null;
}): Promise<PurchaseOrderActionResult<null>> {
  try {
    const context = await getAuthorizedContext(input.workspaceSlug, "purchase-orders:write");
    await addOrderItem({
      workspaceId: context.workspace.id,
      orderId: input.orderId,
      partId: input.partId,
      quantity: input.quantity,
      supplierSku: input.supplierSku,
      unitPrice: input.unitPrice,
      lineNetTotal: input.lineNetTotal,
      currency: input.currency,
      taxRate: input.taxRate,
      notes: input.notes,
      sourceShoppingListItemId: input.sourceShoppingListItemId
    });
    return success(null);
  } catch (error) {
    return failure(error);
  }
}

export async function updateOrderItemForWorkspace(input: {
  workspaceSlug: string;
  orderId: string;
  itemId: string;
  quantity: string;
  supplierSku?: string | null;
  unitPrice?: string | null;
  lineNetTotal?: string | null;
  currency?: string | null;
  taxRate?: string | null;
  notes?: string | null;
}): Promise<PurchaseOrderActionResult<null>> {
  try {
    const context = await getAuthorizedContext(input.workspaceSlug, "purchase-orders:write");
    await updateOrderItem({
      workspaceId: context.workspace.id,
      orderId: input.orderId,
      itemId: input.itemId,
      quantity: input.quantity,
      supplierSku: input.supplierSku,
      unitPrice: input.unitPrice,
      lineNetTotal: input.lineNetTotal,
      currency: input.currency,
      taxRate: input.taxRate,
      notes: input.notes
    });
    return success(null);
  } catch (error) {
    return failure(error);
  }
}

export async function removeOrderItemForWorkspace(input: {
  workspaceSlug: string;
  orderId: string;
  itemId: string;
}): Promise<PurchaseOrderActionResult<null>> {
  try {
    const context = await getAuthorizedContext(input.workspaceSlug, "purchase-orders:write");
    await removeOrderItem({
      workspaceId: context.workspace.id,
      orderId: input.orderId,
      itemId: input.itemId
    });
    return success(null);
  } catch (error) {
    return failure(error);
  }
}

export async function markOrderedForWorkspace(input: {
  workspaceSlug: string;
  orderId: string;
}): Promise<PurchaseOrderActionResult<null>> {
  try {
    const context = await getAuthorizedContext(input.workspaceSlug, "purchase-orders:write");
    await markOrdered({ workspaceId: context.workspace.id, orderId: input.orderId });
    return success(null);
  } catch (error) {
    return failure(error);
  }
}

export async function receiveItemsForWorkspace(input: {
  workspaceSlug: string;
  orderId: string;
  items: ReceiveItemInput[];
}): Promise<PurchaseOrderActionResult<null>> {
  try {
    const context = await getAuthorizedContext(input.workspaceSlug, "purchase-orders:write");
    await receiveItems({
      workspaceId: context.workspace.id,
      orderId: input.orderId,
      createdByUserId: context.user.id,
      items: input.items
    });
    return success(null);
  } catch (error) {
    return failure(error);
  }
}

export async function revertOrderToDraftForWorkspace(input: {
  workspaceSlug: string;
  orderId: string;
}): Promise<PurchaseOrderActionResult<null>> {
  try {
    const context = await getAuthorizedContext(input.workspaceSlug, "purchase-orders:write");
    await revertOrderToDraft({ workspaceId: context.workspace.id, orderId: input.orderId });
    return success(null);
  } catch (error) {
    return failure(error);
  }
}

export async function getExchangeRateForWorkspace(input: {
  workspaceSlug: string;
  from: string;
  to: string;
  date: string;
}): Promise<PurchaseOrderActionResult<{ rate: string } | null>> {
  try {
    await getAuthorizedContext(input.workspaceSlug, "purchase-orders:read");
    const rate = await getExchangeRate(input.from, input.to, new Date(input.date));
    return success(rate ? { rate: rate.toString() } : null);
  } catch (error) {
    return failure(error);
  }
}

export async function getDraftPurchaseOrdersForWorkspace(input: {
  workspaceSlug: string;
}): Promise<PurchaseOrderActionResult<DraftPurchaseOrderOption[]>> {
  try {
    const context = await getAuthorizedContext(input.workspaceSlug, "purchase-orders:read");
    const orders = await getDraftPurchaseOrders(context.workspace.id);
    return success(orders);
  } catch (error) {
    return failure(error);
  }
}

export async function addMultipleOrderItemsForWorkspace(input: {
  workspaceSlug: string;
  orderId: string;
  items: Array<{ partId: string; quantity: string }>;
}): Promise<PurchaseOrderActionResult<{ addedCount: number }>> {
  try {
    const context = await getAuthorizedContext(input.workspaceSlug, "purchase-orders:write");
    const order = await getPurchaseOrderDetail(context.workspace.id, input.orderId);
    if (!order) throw new Error("order-not-found");

    const existingByPartId = new Map(order.items.map((item) => [item.partId, item]));

    for (const item of input.items) {
      const existing = existingByPartId.get(item.partId);
      if (existing) {
        const mergedQty = (parseFloat(existing.quantity) + parseFloat(item.quantity)).toString();
        await updateOrderItem({
          workspaceId: context.workspace.id,
          orderId: input.orderId,
          itemId: existing.id,
          quantity: mergedQty
        });
      } else {
        await addOrderItem({
          workspaceId: context.workspace.id,
          orderId: input.orderId,
          partId: item.partId,
          quantity: item.quantity
        });
      }
    }

    return success({ addedCount: input.items.length });
  } catch (error) {
    return failure(error);
  }
}

// --- Helpers ---

async function getAuthorizedContext(
  workspaceSlug: string,
  permission: "purchase-orders:read" | "purchase-orders:write"
) {
  const context = await getCurrentWorkspaceContextBySlug(workspaceSlug);
  if (!context) throw new Error("workspace-not-found");

  await authorizeWorkspacePermission({
    userId: context.user.id,
    workspaceId: context.workspace.id,
    permission
  });

  return context;
}


function success<T>(data: T): PurchaseOrderActionResult<T> {
  return { ok: true, data, submittedAt: Date.now() };
}

function failure(error: unknown): PurchaseOrderActionResult<never> {
  if (!(error instanceof Error)) {
    return { ok: false, error: "database-unavailable", submittedAt: Date.now() };
  }
  if (error instanceof ExchangeRateUnavailableError) {
    return {
      ok: false,
      error: "exchange-rate-unavailable",
      errorDetails: { from: error.from, to: error.to, date: error.date },
      submittedAt: Date.now()
    };
  }
  return { ok: false, error: error.message.replaceAll("_", "-"), submittedAt: Date.now() };
}

export async function saveManualExchangeRateForWorkspace(input: {
  workspaceSlug: string;
  from: string;
  to: string;
  date: string;
  rate: string;
}): Promise<PurchaseOrderActionResult<null>> {
  try {
    await getAuthorizedContext(input.workspaceSlug, "purchase-orders:write");
    await saveManualExchangeRate(input.from, input.to, new Date(input.date), input.rate);
    return success(null);
  } catch (error) {
    return failure(error);
  }
}
