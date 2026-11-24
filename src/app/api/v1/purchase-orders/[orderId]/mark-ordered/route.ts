import { restOperation } from "@/server/api/rest";
import {
  markPurchaseOrderOrderedImplementation
} from "@/server/purchase-orders/purchaseOrderApi";

export const POST = restOperation(markPurchaseOrderOrderedImplementation);
