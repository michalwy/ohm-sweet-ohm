import { restOperation } from "@/server/api/rest";
import {
  listDraftPurchaseOrdersImplementation
} from "@/server/purchase-orders/purchaseOrderApi";

export const GET = restOperation(listDraftPurchaseOrdersImplementation);
