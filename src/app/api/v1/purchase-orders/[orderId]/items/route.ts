import { restOperation } from "@/server/api/rest";
import {
  addPurchaseOrderItemImplementation
} from "@/server/purchase-orders/purchaseOrderApi";

export const POST = restOperation(addPurchaseOrderItemImplementation);
