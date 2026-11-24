import { restOperation } from "@/server/api/rest";
import {
  getPartPurchaseHistoryImplementation
} from "@/server/purchase-orders/purchaseOrderApi";

export const GET = restOperation(getPartPurchaseHistoryImplementation);
