import { restOperation } from "@/server/api/rest";
import { whoamiImplementation } from "@/server/workspaces/workspaceApi";

export const GET = restOperation(whoamiImplementation);
