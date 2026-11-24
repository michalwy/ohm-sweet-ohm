import { restOperation } from "@/server/api/rest";
import {
  setBuildLineAllocationsImplementation
} from "@/server/builds/buildApi";

export const PUT = restOperation(setBuildLineAllocationsImplementation);
