import { restOperation } from "@/server/api/rest";
import {
  attachCategoryAttributeImplementation,
  detachCategoryAttributeImplementation
} from "@/server/parts/attributeApi";

export const PUT = restOperation(attachCategoryAttributeImplementation);
export const DELETE = restOperation(detachCategoryAttributeImplementation);
