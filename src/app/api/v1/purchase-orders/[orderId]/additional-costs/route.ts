import { restOperation } from "@/server/api/rest";
import {
  addAdditionalCostImplementation
} from "@/server/purchase-orders/purchaseOrderApi";

export const POST = restOperation(addAdditionalCostImplementation);
