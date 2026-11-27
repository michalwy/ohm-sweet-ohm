import "server-only";

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
  type CallToolResult,
  type Tool,
  type ToolAnnotations
} from "@modelcontextprotocol/sdk/types.js";

import type { WorkspaceActor } from "@/server/access-control/actor";
import { executeOperation } from "@/server/api/execute";
import { getOperationJsonSchemas } from "@/server/api/operations";
import { readBearerToken } from "@/server/api/bearer";
import { jsonResponse, unauthorizedFailure } from "@/server/api/rest";
import { resolveWorkspaceActor } from "@/server/auth/currentActor";
import { getOAuthBaseUrl, isOAuthAccessToken } from "@/server/oauth/oauthServer";
import { oauthUrls } from "@/server/oauth/oauthValues";
import { mcpTools, type McpTool, type McpToolBehavior } from "@/server/mcp/tools";

/**
 * The MCP server at `/api/mcp` (#275): Streamable HTTP, inside the app (ADR 0030).
 *
 * **Stateless**: every HTTP request is authenticated by its own bearer token and served by a fresh
 * server and transport bound to that token's actor, answering with plain JSON (no SSE stream, no
 * MCP session id). Nothing outlives a request, so a revoked token or a lost role takes effect on the
 * next call, and the app needs no session store.
 */

const SERVER_INFO = { name: "ohm-sweet-ohm", title: "OhmSweetOhm", version: "1" };

const INSTRUCTIONS =
  "OhmSweetOhm manages a home electronics workshop: parts, stock in storage locations, suppliers, purchase orders, designs and builds. You act as the token's user, in the one workspace the token is bound to; call whoami to see which, and which permissions you hold. A tool needing a permission you lack returns a permission-denied error.";

export async function handleMcpRequest(
  request: Request,
  { tools = mcpTools }: { tools?: readonly McpTool[] } = {}
): Promise<Response> {
  if (request.method !== "POST") {
    return Response.json(
      {
        jsonrpc: "2.0",
        error: {
          code: -32000,
          message: "Method not allowed: this MCP server is stateless and answers POST only."
        },
        id: null
      },
      { status: 405, headers: { allow: "POST" } }
    );
  }

  const actor = await authenticateMcpRequest(request);

  if (!actor) {
    return mcpUnauthorizedResponse(readBearerToken(request.headers) !== null);
  }

  const server = createMcpServer(actor, tools);
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true
  });

  await server.connect(transport);

  try {
    return await transport.handleRequest(request);
  } finally {
    await server.close();
  }
}

/**
 * The actor for an MCP request: a personal API token (#273) or, from a connected app such as a
 * claude.ai custom connector, an OAuth access token (#322) — both through `resolveWorkspaceActor`.
 * Cookies are never read.
 */
async function authenticateMcpRequest(request: Request): Promise<WorkspaceActor | null> {
  const token = readBearerToken(request.headers);

  if (!token) {
    return null;
  }

  return resolveWorkspaceActor({ kind: isOAuthAccessToken(token) ? "oauth" : "token", token });
}

/**
 * 401 with the challenge an OAuth client needs to discover the authorization server from the MCP
 * URL alone (RFC 9728 § 5.1): `resource_metadata` names the protected-resource metadata.
 */
export function mcpUnauthorizedResponse(tokenPresented: boolean) {
  const metadataUrl = oauthUrls(getOAuthBaseUrl()).protectedResourceMetadata;
  const challenge = [
    'Bearer realm="OhmSweetOhm"',
    `resource_metadata="${metadataUrl}"`,
    ...(tokenPresented ? ['error="invalid_token"'] : [])
  ].join(", ");

  return jsonResponse({ error: unauthorizedFailure.error }, 401, {
    "www-authenticate": challenge,
    "access-control-expose-headers": "WWW-Authenticate"
  });
}

/** An MCP server whose tools all run as `actor`. */
export function createMcpServer(actor: WorkspaceActor, tools: readonly McpTool[]) {
  const server = new Server(SERVER_INFO, {
    capabilities: { tools: {} },
    instructions: INSTRUCTIONS
  });
  const toolsByName = new Map(tools.map((tool) => [tool.implementation.operation.name, tool]));

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: tools.map(describeTool)
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request): Promise<CallToolResult> => {
    const tool = toolsByName.get(request.params.name);

    if (!tool) {
      throw new McpError(ErrorCode.InvalidParams, `Unknown tool: ${request.params.name}`);
    }

    const result = await executeOperation(
      actor,
      tool.implementation,
      request.params.arguments ?? {}
    );

    if (!result.ok) {
      return {
        isError: true,
        content: [{ type: "text", text: JSON.stringify({ error: result.error }) }]
      };
    }

    const data = result.data as Record<string, unknown>;

    return {
      content: [{ type: "text", text: JSON.stringify(data) }],
      structuredContent: data
    };
  });

  return server;
}

function describeTool(tool: McpTool): Tool {
  const { operation } = tool.implementation;
  const schemas = getOperationJsonSchemas(operation);
  const description = operation.permission
    ? `${operation.description} Requires the ${operation.permission} permission.`
    : operation.description;

  return {
    name: operation.name,
    title: tool.title,
    description,
    inputSchema: withoutDialect(schemas.input) as Tool["inputSchema"],
    outputSchema: withoutDialect(schemas.output) as Tool["outputSchema"],
    annotations: toAnnotations(tool.title, tool.behavior)
  };
}

export function toAnnotations(title: string, behavior: McpToolBehavior): ToolAnnotations {
  if (behavior.readOnly) {
    return { title, readOnlyHint: true, openWorldHint: behavior.openWorld ?? false };
  }

  return {
    title,
    readOnlyHint: false,
    destructiveHint: behavior.destructive,
    idempotentHint: behavior.idempotent ?? false,
    openWorldHint: behavior.openWorld ?? false
  };
}

function withoutDialect(schema: object) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { $schema, ...rest } = schema as Record<string, unknown>;
  return rest;
}
