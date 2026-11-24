import { restOperation } from "@/server/api/rest";
import {
  revertPurchaseOrderToDraftImplementation
} from "@/server/purchase-orders/purchaseOrderApi";

export const POST = restOperation(revertPurchaseOrderToDraftImplementation);
