import { restOperation } from "@/server/api/rest";
import {
  createChoiceOptionImplementation
} from "@/server/parts/attributeApi";

export const POST = restOperation(createChoiceOptionImplementation);
