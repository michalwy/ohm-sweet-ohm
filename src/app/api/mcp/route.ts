import { handleMcpRequest } from "@/server/mcp/server";

/** The MCP server, over Streamable HTTP (#275, ADR 0030). */
function handle(request: Request) {
  return handleMcpRequest(request);
}

export { handle as DELETE, handle as GET, handle as POST };
