import "server-only";

import type { OperationImplementation } from "@/server/api/execute";
import {
  createOrganizationImplementation,
  deleteOrganizationImplementation,
  getOrganizationImplementation,
  listOrganizationsImplementation,
  updateOrganizationImplementation
} from "@/server/organizations/organizationApi";
import { whoamiImplementation } from "@/server/workspaces/workspaceApi";

/**
 * How a tool behaves, as MCP annotations tell clients (#275). Every tool says whether it only
 * reads; a tool that writes also says whether it can destroy data (delete, overwrite) — clients ask
 * the user before calling a destructive tool. Declared explicitly, never left to the client's
 * defaults (which assume the worst).
 */
export type McpToolBehavior =
  | { readOnly: true }
  | { readOnly: false; destructive: boolean; idempotent?: boolean };

export type McpTool = {
  title: string;
  implementation: OperationImplementation;
  behavior: McpToolBehavior;
};

/**
 * Declares an MCP tool over an operation implementation — the same one the REST endpoint serves.
 * The tool's name, description, input and output schemas come from the operation.
 */
export function defineMcpTool(
  title: string,
  implementation: OperationImplementation,
  behavior: McpToolBehavior
): McpTool {
  return { title, implementation, behavior };
}

/**
 * The registry: every tool the MCP server at `/api/mcp` offers. Each area issue appends its tools
 * here. Tool names are stable once released (ADR 0030).
 */
export const mcpTools: McpTool[] = [
  defineMcpTool("Who am I", whoamiImplementation, { readOnly: true }),
  defineMcpTool("List organizations", listOrganizationsImplementation, { readOnly: true }),
  defineMcpTool("Get an organization", getOrganizationImplementation, { readOnly: true }),
  defineMcpTool("Create an organization", createOrganizationImplementation, {
    readOnly: false,
    destructive: false
  }),
  defineMcpTool("Update an organization", updateOrganizationImplementation, {
    readOnly: false,
    destructive: true,
    idempotent: true
  }),
  defineMcpTool("Delete an organization", deleteOrganizationImplementation, {
    readOnly: false,
    destructive: true
  })
];
