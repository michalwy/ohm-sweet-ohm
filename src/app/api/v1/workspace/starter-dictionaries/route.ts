import { restOperation } from "@/server/api/rest";
import { loadStarterDictionariesImplementation } from "@/server/workspaces/workspaceApi";

export const POST = restOperation(loadStarterDictionariesImplementation);
