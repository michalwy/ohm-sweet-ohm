import { restOperation } from "@/server/api/rest";
import {
  createPurchaseOrderImplementation,
  listPurchaseOrdersImplementation
} from "@/server/purchase-orders/purchaseOrderApi";

export const GET = restOperation(listPurchaseOrdersImplementation);
export const POST = restOperation(createPurchaseOrderImplementation);
