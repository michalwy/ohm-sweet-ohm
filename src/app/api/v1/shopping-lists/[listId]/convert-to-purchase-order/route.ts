import { restOperation } from "@/server/api/rest";
import { convertShoppingListToPurchaseOrderImplementation } from "@/server/shopping-lists/shoppingListApi";

export const POST = restOperation(convertShoppingListToPurchaseOrderImplementation);
