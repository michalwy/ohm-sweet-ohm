import { restOperation } from "@/server/api/rest";
import {
  startBuildImplementation
} from "@/server/builds/buildApi";

export const POST = restOperation(startBuildImplementation);
