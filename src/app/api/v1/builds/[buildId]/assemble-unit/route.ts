import { restOperation } from "@/server/api/rest";
import {
  assembleBuildUnitImplementation
} from "@/server/builds/buildApi";

export const POST = restOperation(assembleBuildUnitImplementation);
