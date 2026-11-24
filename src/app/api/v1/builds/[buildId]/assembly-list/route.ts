import { restOperation } from "@/server/api/rest";
import {
  getBuildAssemblyListImplementation
} from "@/server/builds/buildApi";

export const GET = restOperation(getBuildAssemblyListImplementation);
