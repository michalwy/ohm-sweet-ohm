import { restOperation } from "@/server/api/rest";
import {
  createLocationImplementation,
  listLocationsImplementation
} from "@/server/inventory/locationApi";

export const GET = restOperation(listLocationsImplementation);
export const POST = restOperation(createLocationImplementation);
