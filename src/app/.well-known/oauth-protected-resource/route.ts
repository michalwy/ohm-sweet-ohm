import { getOAuthBaseUrl } from "@/server/oauth/oauthServer";
import { oauthJson, preflight } from "@/server/oauth/oauthHttp";
import { protectedResourceMetadata } from "@/server/oauth/oauthValues";

/** Protected resource metadata (RFC 9728) for the MCP server at `/api/mcp` (#322). */
export function GET() {
  return oauthJson(protectedResourceMetadata(getOAuthBaseUrl()));
}

export { preflight as OPTIONS };
