import { restOperation } from "@/server/api/rest";
import {
  deletePartImplementation,
  getPartImplementation,
  updatePartImplementation
} from "@/server/parts/partsApi";

export const GET = restOperation(getPartImplementation);
export const PATCH = restOperation(updatePartImplementation);
export const DELETE = restOperation(deletePartImplementation);
