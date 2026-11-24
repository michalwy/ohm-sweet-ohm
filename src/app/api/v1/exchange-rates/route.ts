import { restOperation } from "@/server/api/rest";
import {
  getExchangeRateImplementation,
  saveExchangeRateImplementation
} from "@/server/purchase-orders/purchaseOrderApi";

export const GET = restOperation(getExchangeRateImplementation);
export const PUT = restOperation(saveExchangeRateImplementation);
