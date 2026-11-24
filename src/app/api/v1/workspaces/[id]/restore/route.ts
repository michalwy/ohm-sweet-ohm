import { restOperation } from "@/server/api/rest";
import { restoreWorkspaceImplementation } from "@/server/workspaces/workspaceApi";

export const POST = restOperation(restoreWorkspaceImplementation);
