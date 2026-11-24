import { restOperation } from "@/server/api/rest";
import {
  setCategoryValueAttributeImplementation
} from "@/server/parts/attributeApi";

export const PUT = restOperation(setCategoryValueAttributeImplementation);
