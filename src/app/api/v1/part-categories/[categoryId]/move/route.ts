import { restOperation } from "@/server/api/rest";
import {
  movePartCategoryImplementation
} from "@/server/parts/categoryApi";

export const POST = restOperation(movePartCategoryImplementation);
