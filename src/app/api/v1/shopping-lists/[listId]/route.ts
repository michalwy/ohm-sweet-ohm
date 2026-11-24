import { restOperation } from "@/server/api/rest";
import {
  deleteShoppingListImplementation,
  getShoppingListImplementation,
  updateShoppingListImplementation
} from "@/server/shopping-lists/shoppingListApi";

export const GET = restOperation(getShoppingListImplementation);
export const PATCH = restOperation(updateShoppingListImplementation);
export const DELETE = restOperation(deleteShoppingListImplementation);
