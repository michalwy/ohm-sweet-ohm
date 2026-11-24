import { restOperation } from "@/server/api/rest";
import {
  getCategoryAttributesImplementation,
  saveCategoryAttributeConfigurationImplementation
} from "@/server/parts/attributeApi";

export const GET = restOperation(getCategoryAttributesImplementation);
export const PUT = restOperation(saveCategoryAttributeConfigurationImplementation);
