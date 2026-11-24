import { restOperation } from "@/server/api/rest";
import {
  addShortageToShoppingListImplementation
} from "@/server/designs/designApi";

export const POST = restOperation(addShortageToShoppingListImplementation);
