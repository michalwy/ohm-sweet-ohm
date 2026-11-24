import "server-only";

import { Prisma } from "@/generated/prisma/client";
import type { WorkspaceActor } from "@/server/access-control/actor";
import { implementOperation } from "@/server/api/execute";
import { getExchangeRate, saveManualExchangeRate } from "@/server/currency/exchangeRates";
import { getSupplierOrganizationsForWorkspace } from "@/server/organizations/organizations";
import {
  addAdditionalCost,
  addOrderItem,
  addOrderItems,
  assertPartBelongsToWorkspace,
  createPurchaseOrder,
  deleteAdditionalCost,
  deletePurchaseOrder,
  getDraftPurchaseOrders,
  getPartPurchaseOrderHistory,
  getPurchaseOrderCreateDefaults,
  getPurchaseOrderDetail,
  getPurchaseOrders,
  lookupSupplierItem,
  markOrdered,
  receiveItems,
  removeOrderItem,
  revertOrderToDraft,
  updateAdditionalCost,
  updateOrderItem,
  updatePurchaseOrder
} from "@/server/purchase-orders/purchaseOrderMutations";
import {
  addAdditionalCostOperation,
  addPurchaseOrderItemOperation,
  addPurchaseOrderItemsOperation,
  createPurchaseOrderOperation,
  deleteAdditionalCostOperation,
  deletePurchaseOrderOperation,
  getExchangeRateOperation,
  getPartPurchaseHistoryOperation,
  getPurchaseOrderOperation,
  listDraftPurchaseOrdersOperation,
  listPurchaseOrdersOperation,
  lookupSupplierItemOperation,
  markPurchaseOrderOrderedOperation,
  receivePurchaseOrderItemsOperation,
  removePurchaseOrderItemOperation,
  revertPurchaseOrderToDraftOperation,
  saveExchangeRateOperation,
  searchSuppliersOperation,
  updateAdditionalCostOperation,
  updatePurchaseOrderItemOperation,
  updatePurchaseOrderOperation
} from "@/server/purchase-orders/purchaseOrderOperations";

/**
 * The purchase-order operations (#282), over the same domain functions as the server actions in
 * `purchaseOrderActions.ts`. Every call is scoped to the actor's workspace; the permission is checked
 * by `executeOperation` before the function runs.
 *
 * The domain's update functions take every field and clear what they are not given, as the UI's
 * dialogs send the whole form; the API's updates are partial, so each reads the record first and
 * passes the current value of every field the caller left out. Currencies are not editable after
 * creation, as in the UI: an order keeps its currency and its items are priced in it.
 */

async function readPurchaseOrder(actor: WorkspaceActor, orderId: string) {
  const order = await getPurchaseOrderDetail(actor.workspace.id, orderId);

  if (!order) {
    throw new Error("purchase-order-not-found");
  }

  return order;
}

async function readPurchaseOrderItem(actor: WorkspaceActor, orderId: string, itemId: string) {
  const order = await readPurchaseOrder(actor, orderId);
  const item = order.items.find((candidate) => candidate.id === itemId);

  if (!item) {
    throw new Error("purchase-order-item-not-found");
  }

  return item;
}

/** The net unit price of a line total, as the UI derives it when you type a line total. */
function unitPriceFromLineTotal(lineNetTotal: string, quantity: string): string | null {
  try {
    const qty = new Prisma.Decimal(quantity.trim());

    return qty.greaterThan(0) ? new Prisma.Decimal(lineNetTotal.trim()).div(qty).toFixed(10) : null;
  } catch {
    return null;
  }
}

function parseRateDate(date: string) {
  const parsed = new Date(`${date}T00:00:00.000Z`);

  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) {
    throw new Error("invalid-date");
  }

  return parsed;
}

export const listPurchaseOrdersImplementation = implementOperation(
  listPurchaseOrdersOperation,
  async (actor, input) =>
    getPurchaseOrders(actor.workspace.id, {
      cursor: input.cursor,
      pageSize: input.pageSize,
      sortBy: input.sortBy,
      sortDirection: input.sortDir,
      searchQuery: input.searchQuery,
      statusFilter: input.status,
      supplierIdFilter: input.supplierId,
      orderedAtFilter: input.orderedAt,
      receivedAtFilter: input.receivedAt,
      totalNetValueFilter: input.totalNetValue
    })
);

export const getPurchaseOrderImplementation = implementOperation(
  getPurchaseOrderOperation,
  async (actor, input) => readPurchaseOrder(actor, input.orderId)
);

export const createPurchaseOrderImplementation = implementOperation(
  createPurchaseOrderOperation,
  async (actor, input) => {
    const defaults = await getPurchaseOrderCreateDefaults(actor.workspace.id, input.supplierId);
    const order = await createPurchaseOrder({
      workspaceId: actor.workspace.id,
      supplierId: input.supplierId,
      createdByUserId: actor.user.id,
      orderNumber: input.orderNumber,
      currency: input.currency === undefined ? defaults.currency : input.currency,
      taxRate: input.taxRate === undefined ? defaults.taxRate : input.taxRate,
      priceEntryMode: input.priceEntryMode === undefined ? defaults.priceEntryMode : input.priceEntryMode,
      notes: input.notes
    });

    return readPurchaseOrder(actor, order.id);
  }
);

export const updatePurchaseOrderImplementation = implementOperation(
  updatePurchaseOrderOperation,
  async (actor, input) => {
    const current = await readPurchaseOrder(actor, input.orderId);

    // The UI offers the order date only on an ordered order (#282).
    if (input.orderedAt !== undefined && current.status !== "ORDERED") {
      throw new Error("order-not-ordered");
    }

    await updatePurchaseOrder({
      workspaceId: actor.workspace.id,
      orderId: input.orderId,
      supplierId: input.supplierId,
      orderNumber: input.orderNumber === undefined ? current.orderNumber : input.orderNumber,
      supplierOrderNumber:
        input.supplierOrderNumber === undefined ? current.supplierOrderNumber : input.supplierOrderNumber,
      currency: current.currency,
      taxRate: input.taxRate,
      orderedAt:
        input.orderedAt === undefined ? undefined : input.orderedAt === null ? null : new Date(input.orderedAt),
      notes: input.notes === undefined ? current.notes : input.notes
    });

    return readPurchaseOrder(actor, input.orderId);
  }
);

export const deletePurchaseOrderImplementation = implementOperation(
  deletePurchaseOrderOperation,
  async (actor, input) => {
    await deletePurchaseOrder({ workspaceId: actor.workspace.id, orderId: input.orderId });

    return { orderId: input.orderId };
  }
);

export const addPurchaseOrderItemImplementation = implementOperation(
  addPurchaseOrderItemOperation,
  async (actor, input) => {
    // Priced in the order's currency, as the UI's item dialog does.
    const order = await readPurchaseOrder(actor, input.orderId);
    const unitPrice =
      input.unitPrice !== undefined
        ? input.unitPrice
        : input.lineNetTotal
          ? unitPriceFromLineTotal(input.lineNetTotal, input.quantity)
          : null;
    const item = await addOrderItem({
      workspaceId: actor.workspace.id,
      orderId: input.orderId,
      partId: input.partId,
      description: input.description,
      quantity: input.quantity,
      supplierSku: input.supplierSku,
      unitPrice,
      lineNetTotal: input.lineNetTotal,
      currency: order.currency,
      taxRate: input.taxRate,
      notes: input.notes
    });

    return { itemId: item.id, purchaseOrder: await readPurchaseOrder(actor, input.orderId) };
  }
);

export const addPurchaseOrderItemsImplementation = implementOperation(
  addPurchaseOrderItemsOperation,
  async (actor, input) => {
    await readPurchaseOrder(actor, input.orderId);

    const result = await addOrderItems({
      workspaceId: actor.workspace.id,
      orderId: input.orderId,
      items: input.items
    });

    return { ...result, purchaseOrder: await readPurchaseOrder(actor, input.orderId) };
  }
);

export const updatePurchaseOrderItemImplementation = implementOperation(
  updatePurchaseOrderItemOperation,
  async (actor, input) => {
    const current = await readPurchaseOrderItem(actor, input.orderId, input.itemId);
    const quantity = input.quantity ?? current.quantity;
    const priceUnchanged =
      input.quantity === undefined && input.unitPrice === undefined && input.lineNetTotal === undefined;
    const unitPrice =
      input.unitPrice !== undefined
        ? input.unitPrice
        : input.lineNetTotal
          ? unitPriceFromLineTotal(input.lineNetTotal, quantity)
          : current.unitPrice;
    const lineNetTotal = priceUnchanged ? current.lineNetValue : input.lineNetTotal;

    await updateOrderItem({
      workspaceId: actor.workspace.id,
      orderId: input.orderId,
      itemId: input.itemId,
      quantity,
      description: input.description,
      supplierSku: input.supplierSku === undefined ? current.supplierSku : input.supplierSku,
      unitPrice,
      lineNetTotal,
      currency: current.currency,
      taxRate: input.taxRate,
      notes: input.notes === undefined ? current.notes : input.notes
    });

    return readPurchaseOrder(actor, input.orderId);
  }
);

export const removePurchaseOrderItemImplementation = implementOperation(
  removePurchaseOrderItemOperation,
  async (actor, input) => {
    await removeOrderItem({
      workspaceId: actor.workspace.id,
      orderId: input.orderId,
      itemId: input.itemId
    });

    return readPurchaseOrder(actor, input.orderId);
  }
);

export const addAdditionalCostImplementation = implementOperation(
  addAdditionalCostOperation,
  async (actor, input) => {
    const cost = await addAdditionalCost({
      workspaceId: actor.workspace.id,
      orderId: input.orderId,
      label: input.label,
      amount: input.amount,
      taxRate: input.taxRate
    });

    return { costId: cost.id, purchaseOrder: await readPurchaseOrder(actor, input.orderId) };
  }
);

export const updateAdditionalCostImplementation = implementOperation(
  updateAdditionalCostOperation,
  async (actor, input) => {
    const order = await readPurchaseOrder(actor, input.orderId);
    const current = order.additionalCosts.find((cost) => cost.id === input.costId);

    if (!current) {
      throw new Error("additional-cost-not-found");
    }

    await updateAdditionalCost({
      workspaceId: actor.workspace.id,
      orderId: input.orderId,
      costId: input.costId,
      label: input.label ?? current.label,
      amount: input.amount ?? current.amount,
      taxRate: input.taxRate === undefined ? current.taxRate : input.taxRate
    });

    return readPurchaseOrder(actor, input.orderId);
  }
);

export const deleteAdditionalCostImplementation = implementOperation(
  deleteAdditionalCostOperation,
  async (actor, input) => {
    await deleteAdditionalCost({
      workspaceId: actor.workspace.id,
      orderId: input.orderId,
      costId: input.costId
    });

    return readPurchaseOrder(actor, input.orderId);
  }
);

export const markPurchaseOrderOrderedImplementation = implementOperation(
  markPurchaseOrderOrderedOperation,
  async (actor, input) => {
    await markOrdered({ workspaceId: actor.workspace.id, orderId: input.orderId });

    return readPurchaseOrder(actor, input.orderId);
  }
);

export const receivePurchaseOrderItemsImplementation = implementOperation(
  receivePurchaseOrderItemsOperation,
  async (actor, input) => {
    await receiveItems({
      workspaceId: actor.workspace.id,
      orderId: input.orderId,
      createdByUserId: actor.user.id,
      items: input.items
    });

    return readPurchaseOrder(actor, input.orderId);
  }
);

export const revertPurchaseOrderToDraftImplementation = implementOperation(
  revertPurchaseOrderToDraftOperation,
  async (actor, input) => {
    await revertOrderToDraft({ workspaceId: actor.workspace.id, orderId: input.orderId });

    return readPurchaseOrder(actor, input.orderId);
  }
);

export const listDraftPurchaseOrdersImplementation = implementOperation(
  listDraftPurchaseOrdersOperation,
  async (actor) => ({ items: await getDraftPurchaseOrders(actor.workspace.id) })
);

export const getPartPurchaseHistoryImplementation = implementOperation(
  getPartPurchaseHistoryOperation,
  async (actor, input) => {
    await assertPartBelongsToWorkspace(actor.workspace.id, input.id);

    return {
      items: await getPartPurchaseOrderHistory({ workspaceId: actor.workspace.id, partId: input.id })
    };
  }
);

export const searchSuppliersImplementation = implementOperation(
  searchSuppliersOperation,
  async (actor, input) => ({
    items: await getSupplierOrganizationsForWorkspace({
      userId: actor.user.id,
      workspaceId: actor.workspace.id,
      searchQuery: input.searchQuery
    })
  })
);

export const lookupSupplierItemImplementation = implementOperation(
  lookupSupplierItemOperation,
  async (actor, input) => {
    await assertPartBelongsToWorkspace(actor.workspace.id, input.id);

    const result = await lookupSupplierItem({ workspaceId: actor.workspace.id, partId: input.id });

    return result.ok
      ? { ok: true, supplierSku: result.supplierSku, reason: null }
      : { ok: false, supplierSku: null, reason: result.reason };
  }
);

export const getExchangeRateImplementation = implementOperation(
  getExchangeRateOperation,
  async (_actor, input) => {
    const rate = await getExchangeRate(input.from, input.to, parseRateDate(input.date));

    return { from: input.from, to: input.to, date: input.date, rate: rate?.toString() ?? null };
  }
);

export const saveExchangeRateImplementation = implementOperation(
  saveExchangeRateOperation,
  async (_actor, input) => {
    const rate = await saveManualExchangeRate(input.from, input.to, parseRateDate(input.date), input.rate);

    return { from: input.from, to: input.to, date: input.date, rate: rate.toString() };
  }
);
