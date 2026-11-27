import { getOAuthBaseUrl } from "@/server/oauth/oauthServer";
import { oauthJson, preflight } from "@/server/oauth/oauthHttp";
import { authorizationServerMetadata } from "@/server/oauth/oauthValues";

/** Authorization server metadata (RFC 8414) for the MCP connector (#322). */
export function GET() {
  return oauthJson(authorizationServerMetadata(getOAuthBaseUrl()));
}

export { preflight as OPTIONS };
