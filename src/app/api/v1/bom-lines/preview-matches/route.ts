import { restOperation } from "@/server/api/rest";
import {
  previewBomLineItemMatchesImplementation
} from "@/server/designs/designApi";

export const POST = restOperation(previewBomLineItemMatchesImplementation);
