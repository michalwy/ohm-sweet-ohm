import { restOperation } from "@/server/api/rest";
import {
  deleteDesignImplementation,
  getDesignImplementation,
  updateDesignImplementation
} from "@/server/designs/designApi";

export const GET = restOperation(getDesignImplementation);
export const PATCH = restOperation(updateDesignImplementation);
export const DELETE = restOperation(deleteDesignImplementation);
