import { restOperation } from "@/server/api/rest";
import {
  receivePurchaseOrderItemsImplementation
} from "@/server/purchase-orders/purchaseOrderApi";

export const POST = restOperation(receivePurchaseOrderItemsImplementation);
