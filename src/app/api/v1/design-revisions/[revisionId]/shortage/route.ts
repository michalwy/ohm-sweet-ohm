import { restOperation } from "@/server/api/rest";
import {
  analyzeShortageImplementation
} from "@/server/designs/designApi";

export const GET = restOperation(analyzeShortageImplementation);
