import { restOperation } from "@/server/api/rest";
import {
  cancelBuildImplementation
} from "@/server/builds/buildApi";

export const POST = restOperation(cancelBuildImplementation);
