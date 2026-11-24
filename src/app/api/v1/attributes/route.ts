import { restOperation } from "@/server/api/rest";
import {
  listAttributesImplementation,
  createAttributeImplementation
} from "@/server/parts/attributeApi";

export const GET = restOperation(listAttributesImplementation);
export const POST = restOperation(createAttributeImplementation);
