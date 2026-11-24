import { restOperation } from "@/server/api/rest";
import {
  removeShoppingListItemImplementation,
  updateShoppingListItemImplementation
} from "@/server/shopping-lists/shoppingListApi";

export const PATCH = restOperation(updateShoppingListItemImplementation);
export const DELETE = restOperation(removeShoppingListItemImplementation);
