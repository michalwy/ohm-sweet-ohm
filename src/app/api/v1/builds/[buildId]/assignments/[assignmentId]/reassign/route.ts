import { restOperation } from "@/server/api/rest";
import {
  reassignBuildDesignatorImplementation
} from "@/server/builds/buildApi";

export const POST = restOperation(reassignBuildDesignatorImplementation);
