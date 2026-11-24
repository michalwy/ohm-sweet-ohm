import { restOperation } from "@/server/api/rest";
import {
  deleteLocationImplementation,
  getLocationImplementation,
  updateLocationImplementation
} from "@/server/inventory/locationApi";

export const GET = restOperation(getLocationImplementation);
export const PATCH = restOperation(updateLocationImplementation);
export const DELETE = restOperation(deleteLocationImplementation);
