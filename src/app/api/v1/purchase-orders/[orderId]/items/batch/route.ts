import { restOperation } from "@/server/api/rest";
import {
  addPurchaseOrderItemsImplementation
} from "@/server/purchase-orders/purchaseOrderApi";

export const POST = restOperation(addPurchaseOrderItemsImplementation);
