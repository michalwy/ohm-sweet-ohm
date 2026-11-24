import { restOperation } from "@/server/api/rest";
import {
  getWorkspaceImplementation,
  updateWorkspaceSettingsImplementation
} from "@/server/workspaces/workspaceApi";

export const GET = restOperation(getWorkspaceImplementation);
export const PATCH = restOperation(updateWorkspaceSettingsImplementation);
