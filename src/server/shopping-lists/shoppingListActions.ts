"use server";

import { authorizeWorkspacePermission } from "@/server/access-control/authorize";
import { getCurrentWorkspaceContextBySlug } from "@/server/auth/currentContext";
import {
  addShoppingListItem,
  convertShoppingListToOrder,
  createShoppingList,
  deleteShoppingList,
  getPartShoppingListMembership,
  getShoppingListDetail,
  getShoppingLists,
  removeShoppingListItem,
  type PartShoppingListMembershipItem,
  type ShoppingListDetail,
  type ShoppingListSummary,
  type ShoppingListsPageInput,
  updateShoppingList,
  updateShoppingListItem
} from "@/server/shopping-lists/shoppingListMutations";
import type { ListPage } from "@/server/pagination";

export type ShoppingListActionResult<T> =
  | { ok: true; data: T; submittedAt: number }
  | { ok: false; error: string; submittedAt: number };

// --- Queries ---

export async function getShoppingListsForWorkspace(
  input: { workspaceSlug: string } & ShoppingListsPageInput
): Promise<ShoppingListActionResult<ListPage<ShoppingListSummary>>> {
  try {
    const context = await getAuthorizedContext(input.workspaceSlug, "shopping-lists:read");
    const page = await getShoppingLists(context.workspace.id, {
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

export async function getShoppingListDetailForWorkspace(input: {
  workspaceSlug: string;
  listId: string;
}): Promise<ShoppingListActionResult<ShoppingListDetail | null>> {
  try {
    const context = await getAuthorizedContext(input.workspaceSlug, "shopping-lists:read");
    const detail = await getShoppingListDetail(context.workspace.id, input.listId);
    return success(detail);
  } catch (error) {
    return failure(error);
  }
}

export async function getPartShoppingListMembershipForWorkspace(input: {
  workspaceSlug: string;
  partId: string;
}): Promise<ShoppingListActionResult<PartShoppingListMembershipItem[]>> {
  try {
    const context = await getAuthorizedContext(input.workspaceSlug, "shopping-lists:read");
    const data = await getPartShoppingListMembership({
      workspaceId: context.workspace.id,
      partId: input.partId
    });
    return success(data);
  } catch (error) {
    return failure(error);
  }
}

export async function getAllShoppingListsForWorkspace(input: {
  workspaceSlug: string;
}): Promise<ShoppingListActionResult<Array<{ id: string; name: string; itemCount: number }>>> {
  try {
    const context = await getAuthorizedContext(input.workspaceSlug, "shopping-lists:read");
    const page = await getShoppingLists(context.workspace.id, { pageSize: 500, sortBy: "name", sortDirection: "asc" });
    return success(page.items.map((sl) => ({ id: sl.id, name: sl.name, itemCount: sl.itemCount })));
  } catch (error) {
    return failure(error);
  }
}

// --- Mutations ---

export async function createShoppingListForWorkspace(input: {
  workspaceSlug: string;
  name: string;
  description?: string | null;
}): Promise<ShoppingListActionResult<{ listId: string }>> {
  try {
    const context = await getAuthorizedContext(input.workspaceSlug, "shopping-lists:write");
    const list = await createShoppingList({
      workspaceId: context.workspace.id,
      name: input.name,
      description: input.description,
      createdByUserId: context.user.id
    });
    return success({ listId: list.id });
  } catch (error) {
    return failure(error);
  }
}

export async function updateShoppingListForWorkspace(input: {
  workspaceSlug: string;
  listId: string;
  name: string;
  description?: string | null;
}): Promise<ShoppingListActionResult<null>> {
  try {
    const context = await getAuthorizedContext(input.workspaceSlug, "shopping-lists:write");
    await updateShoppingList({
      workspaceId: context.workspace.id,
      listId: input.listId,
      name: input.name,
      description: input.description
    });
    return success(null);
  } catch (error) {
    return failure(error);
  }
}

export async function deleteShoppingListForWorkspace(input: {
  workspaceSlug: string;
  listId: string;
}): Promise<ShoppingListActionResult<null>> {
  try {
    const context = await getAuthorizedContext(input.workspaceSlug, "shopping-lists:write");
    await deleteShoppingList({
      workspaceId: context.workspace.id,
      listId: input.listId
    });
    return success(null);
  } catch (error) {
    return failure(error);
  }
}

export async function addShoppingListItemForWorkspace(input: {
  workspaceSlug: string;
  listId: string;
  partId: string;
  quantity: string;
  description?: string | null;
}): Promise<ShoppingListActionResult<null>> {
  try {
    const context = await getAuthorizedContext(input.workspaceSlug, "shopping-lists:write");
    await addShoppingListItem({
      workspaceId: context.workspace.id,
      listId: input.listId,
      partId: input.partId,
      quantity: input.quantity,
      description: input.description
    });
    return success(null);
  } catch (error) {
    return failure(error);
  }
}

export async function updateShoppingListItemForWorkspace(input: {
  workspaceSlug: string;
  listId: string;
  itemId: string;
  quantity: string;
  description?: string | null;
}): Promise<ShoppingListActionResult<null>> {
  try {
    const context = await getAuthorizedContext(input.workspaceSlug, "shopping-lists:write");
    await updateShoppingListItem({
      workspaceId: context.workspace.id,
      listId: input.listId,
      itemId: input.itemId,
      quantity: input.quantity,
      description: input.description
    });
    return success(null);
  } catch (error) {
    return failure(error);
  }
}

export async function removeShoppingListItemForWorkspace(input: {
  workspaceSlug: string;
  listId: string;
  itemId: string;
}): Promise<ShoppingListActionResult<null>> {
  try {
    const context = await getAuthorizedContext(input.workspaceSlug, "shopping-lists:write");
    await removeShoppingListItem({
      workspaceId: context.workspace.id,
      listId: input.listId,
      itemId: input.itemId
    });
    return success(null);
  } catch (error) {
    return failure(error);
  }
}

export async function convertShoppingListToOrderForWorkspace(input: {
  workspaceSlug: string;
  listId: string;
  selectedItemIds: string[];
  supplierId?: string | null;
  existingOrderId?: string | null;
}): Promise<ShoppingListActionResult<{ purchaseOrderId: string }>> {
  try {
    const context = await getAuthorizedContext(input.workspaceSlug, "shopping-lists:write");
    const order = await convertShoppingListToOrder({
      workspaceId: context.workspace.id,
      listId: input.listId,
      selectedItemIds: input.selectedItemIds,
      supplierId: input.supplierId,
      existingOrderId: input.existingOrderId
    });
    return success({ purchaseOrderId: order.id });
  } catch (error) {
    return failure(error);
  }
}

export async function addMultipleShoppingListItemsForWorkspace(input: {
  workspaceSlug: string;
  listId: string;
  items: Array<{ partId: string; quantity: string }>;
}): Promise<ShoppingListActionResult<{ addedCount: number }>> {
  try {
    const context = await getAuthorizedContext(input.workspaceSlug, "shopping-lists:write");
    const list = await getShoppingListDetail(context.workspace.id, input.listId);
    if (!list) throw new Error("list-not-found");

    const existingByPartId = new Map(list.items.map((item) => [item.partId, item]));

    for (const item of input.items) {
      const existing = existingByPartId.get(item.partId);
      if (existing) {
        const mergedQty = (parseFloat(existing.quantity) + parseFloat(item.quantity)).toString();
        await updateShoppingListItem({
          workspaceId: context.workspace.id,
          listId: input.listId,
          itemId: existing.id,
          quantity: mergedQty,
          description: existing.description
        });
      } else {
        await addShoppingListItem({
          workspaceId: context.workspace.id,
          listId: input.listId,
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
  permission: "shopping-lists:read" | "shopping-lists:write"
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


function success<T>(data: T): ShoppingListActionResult<T> {
  return { ok: true, data, submittedAt: Date.now() };
}

function failure(error: unknown): ShoppingListActionResult<never> {
  if (!(error instanceof Error)) return { ok: false, error: "database-unavailable", submittedAt: Date.now() };
  return { ok: false, error: error.message.replaceAll("_", "-"), submittedAt: Date.now() };
}
