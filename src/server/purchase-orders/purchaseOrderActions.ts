"use server";

import { authorizeWorkspacePermission } from "@/server/access-control/authorize";
import { getCurrentWorkspaceContextBySlug } from "@/server/auth/currentContext";
import {
  addOrderItem,
  createPurchaseOrder,
  deletePurchaseOrder,
  generateOrderNumber,
  getDraftPurchaseOrders,
  getPurchaseOrderDetail,
  getPurchaseOrders,
  lookupSupplierItem,
  markOrdered,
  receiveItems,
  removeOrderItem,
  revertOrderToDraft,
  type DraftPurchaseOrderOption,
  type PurchaseOrderDetail,
  type PurchaseOrderSummary,
  type PurchaseOrdersPageInput,
  type ReceiveItemInput,
  type SupplierLookupResult,
  updateOrderItem,
  updatePurchaseOrder
} from "@/server/purchase-orders/purchaseOrderMutations";
import type { ListPage } from "@/server/pagination";
import { getSupplierOrganizationsForWorkspace } from "@/server/organizations/organizations";
import { revalidatePath } from "next/cache";

export type PurchaseOrderActionResult<T> =
  | { ok: true; data: T; submittedAt: number }
  | { ok: false; error: string; submittedAt: number };

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
      sortDirection: input.sortDirection
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
}): Promise<PurchaseOrderActionResult<{ id: string; name: string }[]>> {
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
  notes?: string | null;
}): Promise<PurchaseOrderActionResult<{ orderId: string }>> {
  try {
    const context = await getAuthorizedContext(input.workspaceSlug, "purchase-orders:write");
    const order = await createPurchaseOrder({
      workspaceId: context.workspace.id,
      supplierId: input.supplierId,
      createdByUserId: context.user.id,
      orderNumber: input.orderNumber,
      notes: input.notes
    });
    revalidatePath(workspacePath(input.workspaceSlug));
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
      orderedAt,
      notes: input.notes
    });
    revalidatePath(workspacePath(input.workspaceSlug));
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
    revalidatePath(workspacePath(input.workspaceSlug));
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
  currency?: string | null;
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
      currency: input.currency,
      notes: input.notes,
      sourceShoppingListItemId: input.sourceShoppingListItemId
    });
    revalidatePath(workspacePath(input.workspaceSlug));
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
  currency?: string | null;
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
      currency: input.currency,
      notes: input.notes
    });
    revalidatePath(workspacePath(input.workspaceSlug));
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
    revalidatePath(workspacePath(input.workspaceSlug));
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
    revalidatePath(workspacePath(input.workspaceSlug));
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
    revalidatePath(workspacePath(input.workspaceSlug));
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
    revalidatePath(workspacePath(input.workspaceSlug));
    return success(null);
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

function workspacePath(workspaceSlug: string) {
  return `/w/${encodeURIComponent(workspaceSlug)}`;
}

function success<T>(data: T): PurchaseOrderActionResult<T> {
  return { ok: true, data, submittedAt: Date.now() };
}

function failure(error: unknown): PurchaseOrderActionResult<never> {
  if (!(error instanceof Error)) {
    return { ok: false, error: "database-unavailable", submittedAt: Date.now() };
  }
  return { ok: false, error: error.message.replaceAll("_", "-"), submittedAt: Date.now() };
}
