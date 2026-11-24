import { restOperation } from "@/server/api/rest";
import {
  removePurchaseOrderItemImplementation,
  updatePurchaseOrderItemImplementation
} from "@/server/purchase-orders/purchaseOrderApi";

export const PATCH = restOperation(updatePurchaseOrderItemImplementation);
export const DELETE = restOperation(removePurchaseOrderItemImplementation);
