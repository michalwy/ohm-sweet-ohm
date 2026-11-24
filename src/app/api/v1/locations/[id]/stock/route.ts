import { restOperation } from "@/server/api/rest";
import { getLocationStockImplementation } from "@/server/inventory/inventoryApi";

export const GET = restOperation(getLocationStockImplementation);
