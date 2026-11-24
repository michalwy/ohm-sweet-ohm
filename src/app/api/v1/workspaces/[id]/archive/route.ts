import { restOperation } from "@/server/api/rest";
import { archiveWorkspaceImplementation } from "@/server/workspaces/workspaceApi";

export const POST = restOperation(archiveWorkspaceImplementation);
