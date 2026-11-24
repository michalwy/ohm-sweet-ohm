import { restOperation } from "@/server/api/rest";
import {
  createBuildImplementation,
  listBuildsImplementation
} from "@/server/builds/buildApi";

export const GET = restOperation(listBuildsImplementation);
export const POST = restOperation(createBuildImplementation);
