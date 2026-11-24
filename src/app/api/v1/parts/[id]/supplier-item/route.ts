import { restOperation } from "@/server/api/rest";
import {
  lookupSupplierItemImplementation
} from "@/server/purchase-orders/purchaseOrderApi";

export const GET = restOperation(lookupSupplierItemImplementation);
