import { restOperation } from "@/server/api/rest";
import {
  deleteBomLineItemImplementation,
  updateBomLineItemImplementation
} from "@/server/designs/designApi";

export const PUT = restOperation(updateBomLineItemImplementation);
export const DELETE = restOperation(deleteBomLineItemImplementation);
