import { restOperation } from "@/server/api/rest";
import {
  getWorkspaceAttributesImplementation,
  saveWorkspaceAttributeConfigurationImplementation
} from "@/server/parts/attributeApi";

export const GET = restOperation(getWorkspaceAttributesImplementation);
export const PUT = restOperation(saveWorkspaceAttributeConfigurationImplementation);
