import { restOperation } from "@/server/api/rest";
import {
  createDesignImplementation,
  listDesignsImplementation
} from "@/server/designs/designApi";

export const GET = restOperation(listDesignsImplementation);
export const POST = restOperation(createDesignImplementation);
