import { restOperation } from "@/server/api/rest";
import { getWorkspaceImplementation } from "@/server/workspaces/workspaceApi";

export const GET = restOperation(getWorkspaceImplementation);
