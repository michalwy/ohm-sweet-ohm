import { restOperation } from "@/server/api/rest";
import {
  createWorkspaceImplementation,
  listWorkspacesImplementation
} from "@/server/workspaces/workspaceApi";

export const GET = restOperation(listWorkspacesImplementation);
export const POST = restOperation(createWorkspaceImplementation);
