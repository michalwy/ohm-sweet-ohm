import { restOperation } from "@/server/api/rest";
import {
  getPartCategoryTreeImplementation,
  createPartCategoryImplementation
} from "@/server/parts/categoryApi";

export const GET = restOperation(getPartCategoryTreeImplementation);
export const POST = restOperation(createPartCategoryImplementation);
