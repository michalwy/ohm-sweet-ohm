import { restOperation } from "@/server/api/rest";
import {
  updateChoiceOptionImplementation,
  deleteChoiceOptionImplementation
} from "@/server/parts/attributeApi";

export const PATCH = restOperation(updateChoiceOptionImplementation);
export const DELETE = restOperation(deleteChoiceOptionImplementation);
