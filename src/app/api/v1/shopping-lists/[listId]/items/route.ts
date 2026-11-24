import { restOperation } from "@/server/api/rest";
import { addShoppingListItemImplementation } from "@/server/shopping-lists/shoppingListApi";

export const POST = restOperation(addShoppingListItemImplementation);
