import { restOperation } from "@/server/api/rest";
import {
  updateDesignRevisionImplementation
} from "@/server/designs/designApi";

export const PATCH = restOperation(updateDesignRevisionImplementation);
