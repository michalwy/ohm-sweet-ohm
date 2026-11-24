import { restOperation } from "@/server/api/rest";
import {
  deleteBuildImplementation,
  getBuildImplementation
} from "@/server/builds/buildApi";

export const GET = restOperation(getBuildImplementation);
export const DELETE = restOperation(deleteBuildImplementation);
