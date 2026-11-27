import { revokeOAuthToken } from "@/server/oauth/oauthServer";
import { oauthJson, oauthResultResponse, preflight, readFormBody } from "@/server/oauth/oauthHttp";

/** Token revocation (RFC 7009) for the MCP connector (#322). */
export async function POST(request: Request) {
  const form = await readFormBody(request);

  if (!form) {
    return oauthJson({ error: "invalid_request", error_description: "Unreadable body." }, 400);
  }

  return oauthResultResponse(await revokeOAuthToken(form, request.headers.get("authorization")));
}

export { preflight as OPTIONS };
