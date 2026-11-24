import { restOperation } from "@/server/api/rest";
import { getPartStockBalancesImplementation } from "@/server/inventory/inventoryApi";

export const GET = restOperation(getPartStockBalancesImplementation);
