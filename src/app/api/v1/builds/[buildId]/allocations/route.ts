import { restOperation } from "@/server/api/rest";
import {
  setBuildAllocationsImplementation
} from "@/server/builds/buildApi";

export const PUT = restOperation(setBuildAllocationsImplementation);
