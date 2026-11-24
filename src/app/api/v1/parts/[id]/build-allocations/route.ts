import { restOperation } from "@/server/api/rest";
import {
  getPartBuildAllocationsImplementation
} from "@/server/builds/buildApi";

export const GET = restOperation(getPartBuildAllocationsImplementation);
