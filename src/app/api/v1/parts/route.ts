import { restOperation } from "@/server/api/rest";
import { createPartImplementation, listPartsImplementation } from "@/server/parts/partsApi";

export const GET = restOperation(listPartsImplementation);
export const POST = restOperation(createPartImplementation);
