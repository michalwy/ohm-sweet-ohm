import { restOperation } from "@/server/api/rest";
import { addShoppingListItemsImplementation } from "@/server/shopping-lists/shoppingListApi";

export const POST = restOperation(addShoppingListItemsImplementation);
