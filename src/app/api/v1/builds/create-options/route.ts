import { restOperation } from "@/server/api/rest";
import {
  getBuildCreateOptionsImplementation
} from "@/server/builds/buildApi";

export const GET = restOperation(getBuildCreateOptionsImplementation);
