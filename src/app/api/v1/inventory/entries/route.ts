import { restOperation } from "@/server/api/rest";
import {
  createInventoryEntryImplementation,
  listInventoryEntriesImplementation
} from "@/server/inventory/inventoryApi";

export const GET = restOperation(listInventoryEntriesImplementation);
export const POST = restOperation(createInventoryEntryImplementation);
