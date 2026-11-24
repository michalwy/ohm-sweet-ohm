import { restOperation } from "@/server/api/rest";
import {
  getPartProductionBuildsImplementation
} from "@/server/builds/buildApi";

export const GET = restOperation(getPartProductionBuildsImplementation);
