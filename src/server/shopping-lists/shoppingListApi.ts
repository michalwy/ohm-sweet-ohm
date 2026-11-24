import "server-only";

import type { WorkspaceActor } from "@/server/access-control/actor";
import { implementOperation } from "@/server/api/execute";
import {
  addShoppingListItem,
  addShoppingListItems,
  assertPartBelongsToWorkspace,
  convertShoppingListToOrder,
  createShoppingList,
  deleteShoppingList,
  getPartShoppingListMembership,
  getShoppingListDetail,
  getShoppingLists,
  removeShoppingListItem,
  updateShoppingList,
  updateShoppingListItem
} from "@/server/shopping-lists/shoppingListMutations";
import {
  addShoppingListItemOperation,
  addShoppingListItemsOperation,
  convertShoppingListToPurchaseOrderOperation,
  createShoppingListOperation,
  deleteShoppingListOperation,
  getPartShoppingListsOperation,
  getShoppingListOperation,
  listShoppingListsOperation,
  removeShoppingListItemOperation,
  updateShoppingListItemOperation,
  updateShoppingListOperation
} from "@/server/shopping-lists/shoppingListOperations";

/**
 * The shopping-list operations (#281), over the same domain functions as the server actions in
 * `shoppingListActions.ts`. Every call is scoped to the actor's workspace; the permission is checked
 * by `executeOperation` before the function runs.
 */

async function readShoppingList(actor: WorkspaceActor, listId: string) {
  const list = await getShoppingListDetail(actor.workspace.id, listId);

  if (!list) {
    throw new Error("shopping-list-not-found");
  }

  return list;
}

async function readShoppingListItem(actor: WorkspaceActor, listId: string, itemId: string) {
  const list = await readShoppingList(actor, listId);
  const item = list.items.find((candidate) => candidate.id === itemId);

  if (!item) {
    throw new Error("shopping-list-item-not-found");
  }

  return item;
}

export const listShoppingListsImplementation = implementOperation(
  listShoppingListsOperation,
  async (actor, input) =>
    getShoppingLists(actor.workspace.id, {
      cursor: input.cursor,
      pageSize: input.pageSize,
      sortBy: input.sortBy,
      sortDirection: input.sortDir,
      searchQuery: input.searchQuery
    })
);

export const getShoppingListImplementation = implementOperation(
  getShoppingListOperation,
  async (actor, input) => readShoppingList(actor, input.listId)
);

export const createShoppingListImplementation = implementOperation(
  createShoppingListOperation,
  async (actor, input) => {
    const list = await createShoppingList({
      workspaceId: actor.workspace.id,
      name: input.name,
      description: input.description,
      createdByUserId: actor.user.id
    });

    return readShoppingList(actor, list.id);
  }
);

export const updateShoppingListImplementation = implementOperation(
  updateShoppingListOperation,
  async (actor, input) => {
    const current = await readShoppingList(actor, input.listId);

    await updateShoppingList({
      workspaceId: actor.workspace.id,
      listId: input.listId,
      name: input.name ?? current.name,
      description: input.description === undefined ? current.description : input.description
    });

    return readShoppingList(actor, input.listId);
  }
);

export const deleteShoppingListImplementation = implementOperation(
  deleteShoppingListOperation,
  async (actor, input) => {
    await deleteShoppingList({ workspaceId: actor.workspace.id, listId: input.listId });

    return { listId: input.listId };
  }
);

export const addShoppingListItemImplementation = implementOperation(
  addShoppingListItemOperation,
  async (actor, input) => {
    const item = await addShoppingListItem({
      workspaceId: actor.workspace.id,
      listId: input.listId,
      partId: input.partId,
      quantity: input.quantity,
      description: input.description
    });

    return readShoppingListItem(actor, input.listId, item.id);
  }
);

export const addShoppingListItemsImplementation = implementOperation(
  addShoppingListItemsOperation,
  async (actor, input) => {
    const result = await addShoppingListItems({
      workspaceId: actor.workspace.id,
      listId: input.listId,
      items: input.items
    });

    return { ...result, list: await readShoppingList(actor, input.listId) };
  }
);

export const updateShoppingListItemImplementation = implementOperation(
  updateShoppingListItemOperation,
  async (actor, input) => {
    const current = await readShoppingListItem(actor, input.listId, input.itemId);

    await updateShoppingListItem({
      workspaceId: actor.workspace.id,
      listId: input.listId,
      itemId: input.itemId,
      quantity: input.quantity ?? current.quantity,
      description: input.description === undefined ? current.description : input.description
    });

    return readShoppingListItem(actor, input.listId, input.itemId);
  }
);

export const removeShoppingListItemImplementation = implementOperation(
  removeShoppingListItemOperation,
  async (actor, input) => {
    await removeShoppingListItem({
      workspaceId: actor.workspace.id,
      listId: input.listId,
      itemId: input.itemId
    });

    return { itemId: input.itemId };
  }
);

export const getPartShoppingListsImplementation = implementOperation(
  getPartShoppingListsOperation,
  async (actor, input) => {
    await assertPartBelongsToWorkspace(actor.workspace.id, input.id);

    return {
      items: await getPartShoppingListMembership({ workspaceId: actor.workspace.id, partId: input.id })
    };
  }
);

export const convertShoppingListToPurchaseOrderImplementation = implementOperation(
  convertShoppingListToPurchaseOrderOperation,
  async (actor, input) => {
    const order = await convertShoppingListToOrder({
      workspaceId: actor.workspace.id,
      listId: input.listId,
      selectedItemIds: input.itemIds,
      supplierId: input.supplierId,
      existingOrderId: input.purchaseOrderId
    });

    return { purchaseOrderId: order.id };
  }
);
