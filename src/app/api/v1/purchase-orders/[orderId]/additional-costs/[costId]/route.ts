import { restOperation } from "@/server/api/rest";
import {
  deleteAdditionalCostImplementation,
  updateAdditionalCostImplementation
} from "@/server/purchase-orders/purchaseOrderApi";

export const PATCH = restOperation(updateAdditionalCostImplementation);
export const DELETE = restOperation(deleteAdditionalCostImplementation);
