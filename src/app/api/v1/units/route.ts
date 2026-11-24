import { restOperation } from "@/server/api/rest";
import {
  listUnitsImplementation,
  createUnitImplementation
} from "@/server/units/unitApi";

export const GET = restOperation(listUnitsImplementation);
export const POST = restOperation(createUnitImplementation);
