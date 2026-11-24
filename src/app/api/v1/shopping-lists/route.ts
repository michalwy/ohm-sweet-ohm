import { restOperation } from "@/server/api/rest";
import {
  createShoppingListImplementation,
  listShoppingListsImplementation
} from "@/server/shopping-lists/shoppingListApi";

export const GET = restOperation(listShoppingListsImplementation);
export const POST = restOperation(createShoppingListImplementation);
