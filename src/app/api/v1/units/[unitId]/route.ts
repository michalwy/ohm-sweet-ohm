import { restOperation } from "@/server/api/rest";
import {
  updateUnitImplementation,
  deleteUnitImplementation
} from "@/server/units/unitApi";

export const PATCH = restOperation(updateUnitImplementation);
export const DELETE = restOperation(deleteUnitImplementation);
