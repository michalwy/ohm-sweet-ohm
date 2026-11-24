import { restOperation } from "@/server/api/rest";
import {
  updatePartCategoryImplementation,
  deletePartCategoryImplementation
} from "@/server/parts/categoryApi";

export const PATCH = restOperation(updatePartCategoryImplementation);
export const DELETE = restOperation(deletePartCategoryImplementation);
