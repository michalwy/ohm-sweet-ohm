import { restOperation } from "@/server/api/rest";
import {
  deletePurchaseOrderImplementation,
  getPurchaseOrderImplementation,
  updatePurchaseOrderImplementation
} from "@/server/purchase-orders/purchaseOrderApi";

export const GET = restOperation(getPurchaseOrderImplementation);
export const PATCH = restOperation(updatePurchaseOrderImplementation);
export const DELETE = restOperation(deletePurchaseOrderImplementation);
