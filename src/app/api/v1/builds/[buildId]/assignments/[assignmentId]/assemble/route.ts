import { restOperation } from "@/server/api/rest";
import {
  assembleBuildDesignatorImplementation
} from "@/server/builds/buildApi";

export const POST = restOperation(assembleBuildDesignatorImplementation);
