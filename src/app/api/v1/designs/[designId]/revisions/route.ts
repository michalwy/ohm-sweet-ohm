import { restOperation } from "@/server/api/rest";
import {
  addDesignRevisionImplementation
} from "@/server/designs/designApi";

export const POST = restOperation(addDesignRevisionImplementation);
