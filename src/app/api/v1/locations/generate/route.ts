import { restOperation } from "@/server/api/rest";
import { generateLocationsImplementation } from "@/server/inventory/locationApi";

export const POST = restOperation(generateLocationsImplementation);
