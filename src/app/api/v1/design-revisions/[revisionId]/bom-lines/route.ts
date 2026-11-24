import { restOperation } from "@/server/api/rest";
import {
  createBomLineItemImplementation,
  listBomLineItemsImplementation
} from "@/server/designs/designApi";

export const GET = restOperation(listBomLineItemsImplementation);
export const POST = restOperation(createBomLineItemImplementation);
