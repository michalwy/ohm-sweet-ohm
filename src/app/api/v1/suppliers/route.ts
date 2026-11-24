import { restOperation } from "@/server/api/rest";
import {
  searchSuppliersImplementation
} from "@/server/purchase-orders/purchaseOrderApi";

export const GET = restOperation(searchSuppliersImplementation);
