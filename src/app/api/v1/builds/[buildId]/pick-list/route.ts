import { restOperation } from "@/server/api/rest";
import {
  getBuildPickListImplementation
} from "@/server/builds/buildApi";

export const GET = restOperation(getBuildPickListImplementation);
