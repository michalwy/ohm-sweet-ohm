import { z } from "zod";

import { listPageInputShape, listPageOutputSchema } from "@/server/api/listSchemas";
import { defineOperation } from "@/server/api/operations";

/**
 * Shopping lists in the API and MCP (#281). Pure, so unit tests and the OpenAPI document can load
 * it; the implementations are in `shoppingListApi.ts`, over the same domain functions
 * (`shoppingListMutations.ts`) as the server actions in `shoppingListActions.ts`.
 *
 * Converting a list to a purchase order answers only the order's id: reading and changing purchase
 * orders is the purchase-order area's (#282).
 */

/** A positive decimal, as a string so no precision is lost (e.g. "10" or "2.5"). */
const QUANTITY_PATTERN = /^\s*\d+(\.\d+)?\s*$/;

const listIdSchema = z.string().min(1).describe("The shopping list's id.");
const itemIdSchema = z.string().min(1).describe("The shopping list item's id.");
const partIdSchema = z.string().min(1).describe("The part's id.");

const quantitySchema = z
  .string()
  .regex(QUANTITY_PATTERN)
  .describe("How many to buy: a positive decimal string, e.g. \"10\" or \"2.5\".");

const descriptionSchema = z
  .string()
  .nullable()
  .describe("Free-text note; surrounding spaces are trimmed, and empty or null clears it.");

export const shoppingListSummarySchema = z.object({
  id: z.string().describe("The shopping list's id."),
  name: z.string().describe("The list's name."),
  description: z.string().nullable().describe("The list's description; null when unset."),
  itemCount: z.number().int().describe("How many items (lines) the list has."),
  createdAt: z.iso.datetime().describe("When the list was created (ISO 8601, UTC)."),
  updatedAt: z.iso.datetime().describe("When the list last changed (ISO 8601, UTC)."),
  createdByName: z
    .string()
    .nullable()
    .describe("Name of the user who created the list; null when unknown.")
});

export const shoppingListItemSchema = z.object({
  id: z.string().describe("The item's id."),
  partId: z.string().describe("The part to buy."),
  partCatalogNumber: z.string().describe("The part's catalog number."),
  partDescription: z.string().nullable().describe("The part's description."),
  manufacturerName: z.string().describe("The part's manufacturer."),
  quantity: z.string().describe("How many to buy, as a decimal string."),
  description: z.string().nullable().describe("The item's note; null when unset."),
  orderedInPurchaseOrderId: z
    .string()
    .nullable()
    .describe(
      "The purchase order this item was converted to; null while it is not on an order. An item on an order no longer counts towards the part's planned quantity."
    ),
  orderedInPurchaseOrderNumber: z
    .string()
    .nullable()
    .describe("That purchase order's number; null when it has none yet."),
  orderedInPurchaseOrderSupplierName: z
    .string()
    .nullable()
    .describe("That purchase order's supplier.")
});

export const shoppingListSchema = z.object({
  id: z.string().describe("The shopping list's id."),
  name: z.string().describe("The list's name."),
  description: z.string().nullable().describe("The list's description; null when unset."),
  createdAt: z.iso.datetime().describe("When the list was created (ISO 8601, UTC)."),
  updatedAt: z.iso.datetime().describe("When the list last changed (ISO 8601, UTC)."),
  items: z.array(shoppingListItemSchema).describe("The list's items, oldest first.")
});

export const listShoppingListsOperation = defineOperation({
  name: "list_shopping_lists",
  description:
    "List the workspace's shopping lists, one page at a time, optionally filtered by a name search. Each entry has its item count; get_shopping_list returns the items.",
  permission: "shopping-lists:read",
  input: z.object({
    ...listPageInputShape,
    sortBy: z
      .enum(["createdAt", "name", "itemCount"])
      .optional()
      .describe("Sort key; createdAt when omitted."),
    sortDir: z
      .enum(["asc", "desc"])
      .optional()
      .describe("Sort direction; newest first for createdAt and ascending otherwise when omitted."),
    searchQuery: z
      .string()
      .nullish()
      .describe("Only lists whose name contains this text, ignoring case.")
  }),
  output: listPageOutputSchema(shoppingListSummarySchema)
});

export const getShoppingListOperation = defineOperation({
  name: "get_shopping_list",
  description: "One shopping list of the workspace, by id, with all its items.",
  permission: "shopping-lists:read",
  input: z.object({ listId: listIdSchema }),
  output: shoppingListSchema
});

export const createShoppingListOperation = defineOperation({
  name: "create_shopping_list",
  description: "Create an empty shopping list. Names need not be unique.",
  permission: "shopping-lists:write",
  input: z.object({
    name: z.string().describe("The list's name; surrounding spaces are trimmed, and it must not be empty."),
    description: descriptionSchema.optional()
  }),
  output: shoppingListSchema
});

export const updateShoppingListOperation = defineOperation({
  name: "update_shopping_list",
  description:
    "Rename a shopping list or change its description. Only the fields sent change; send description null to clear it.",
  permission: "shopping-lists:write",
  input: z.object({
    listId: listIdSchema,
    name: z
      .string()
      .optional()
      .describe("The new name; must not be empty. Unchanged when omitted."),
    description: descriptionSchema.optional()
  }),
  output: shoppingListSchema
});

export const deleteShoppingListOperation = defineOperation({
  name: "delete_shopping_list",
  description:
    "Delete a shopping list and its items. The parts' planned quantities drop by the items not yet on a purchase order; purchase orders made from the list stay.",
  permission: "shopping-lists:write",
  input: z.object({ listId: listIdSchema }),
  output: z.object({ listId: z.string().describe("The deleted list's id.") })
});

export const addShoppingListItemOperation = defineOperation({
  name: "add_shopping_list_item",
  description:
    "Add one part to a shopping list as a new item, even if the part is already on the list, and raise the part's planned quantity by it. To add several parts, merging into the lines already there, use add_shopping_list_items.",
  permission: "shopping-lists:write",
  input: z.object({
    listId: listIdSchema,
    partId: partIdSchema,
    quantity: quantitySchema,
    description: descriptionSchema.optional()
  }),
  output: shoppingListItemSchema
});

export const addShoppingListItemsOperation = defineOperation({
  name: "add_shopping_list_items",
  description:
    "Add several parts to a shopping list at once, as the UI's bulk add does: a part already on the list gets its quantity added to that item; any other part becomes a new item. Each part's planned quantity rises accordingly. Answers the whole list.",
  permission: "shopping-lists:write",
  input: z.object({
    listId: listIdSchema,
    items: z
      .array(z.object({ partId: partIdSchema, quantity: quantitySchema }))
      .min(1)
      .describe("The parts to add, with how many of each.")
  }),
  output: z.object({
    addedCount: z.number().int().describe("How many entries of items were added."),
    list: shoppingListSchema
  })
});

export const updateShoppingListItemOperation = defineOperation({
  name: "update_shopping_list_item",
  description:
    "Change an item's quantity or note. Only the fields sent change; send description null to clear it. While the item is not on a purchase order, the part's planned quantity follows the new quantity.",
  permission: "shopping-lists:write",
  input: z.object({
    listId: listIdSchema,
    itemId: itemIdSchema,
    quantity: quantitySchema.optional(),
    description: descriptionSchema.optional()
  }),
  output: shoppingListItemSchema
});

export const removeShoppingListItemOperation = defineOperation({
  name: "remove_shopping_list_item",
  description:
    "Remove an item from a shopping list. While it was not on a purchase order, the part's planned quantity drops by its quantity.",
  permission: "shopping-lists:write",
  input: z.object({ listId: listIdSchema, itemId: itemIdSchema }),
  output: z.object({ itemId: z.string().describe("The removed item's id.") })
});

export const getPartShoppingListsOperation = defineOperation({
  name: "get_part_shopping_lists",
  description: "The shopping lists a part is on, by list name, with the quantity and note on each.",
  permission: "shopping-lists:read",
  input: z.object({ id: partIdSchema }),
  output: z.object({
    items: z
      .array(
        z.object({
          shoppingListId: z.string().describe("The shopping list's id."),
          shoppingListName: z.string().describe("The shopping list's name."),
          quantity: z.string().describe("How many of the part the list holds, as a decimal string."),
          notes: z.string().nullable().describe("The item's note; null when unset.")
        })
      )
      .describe("One entry per item of the part, ordered by list name.")
  })
});

export const convertShoppingListToPurchaseOrderOperation = defineOperation({
  name: "convert_shopping_list_to_purchase_order",
  description:
    "Put items of a shopping list on a purchase order: a new draft order for supplierId, or the existing draft order purchaseOrderId (which wins when both are sent). Items already on an order are refused (items-already-on-order). The items stay on the list, marked as ordered.",
  permission: "shopping-lists:write",
  input: z.object({
    listId: listIdSchema,
    itemIds: z
      .array(itemIdSchema)
      .min(1)
      .describe("The items of this list to put on the order; ids of other lists are ignored."),
    supplierId: z
      .string()
      .nullish()
      .describe("The supplier organization of a new draft purchase order."),
    purchaseOrderId: z
      .string()
      .nullish()
      .describe("An existing purchase order of the workspace, still a draft, to add the items to.")
  }),
  output: z.object({
    purchaseOrderId: z.string().describe("The purchase order the items are now on.")
  })
});
