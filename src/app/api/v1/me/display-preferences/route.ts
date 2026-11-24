import { restOperation } from "@/server/api/rest";
import {
  getDisplayPreferencesImplementation,
  updateDisplayPreferencesImplementation
} from "@/server/workspaces/workspaceApi";

export const GET = restOperation(getDisplayPreferencesImplementation);
export const PATCH = restOperation(updateDisplayPreferencesImplementation);
