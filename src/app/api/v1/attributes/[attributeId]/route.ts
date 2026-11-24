import { restOperation } from "@/server/api/rest";
import {
  updateAttributeImplementation,
  deleteAttributeImplementation
} from "@/server/parts/attributeApi";

export const PATCH = restOperation(updateAttributeImplementation);
export const DELETE = restOperation(deleteAttributeImplementation);
