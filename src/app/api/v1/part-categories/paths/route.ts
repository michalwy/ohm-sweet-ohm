import { restOperation } from "@/server/api/rest";
import {
  createPartCategoryPathImplementation
} from "@/server/parts/categoryApi";

export const POST = restOperation(createPartCategoryPathImplementation);
