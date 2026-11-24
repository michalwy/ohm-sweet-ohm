import { restOperation } from "@/server/api/rest";
import { getPartShoppingListsImplementation } from "@/server/shopping-lists/shoppingListApi";

export const GET = restOperation(getPartShoppingListsImplementation);
