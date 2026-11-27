import { registerOAuthClient } from "@/server/oauth/oauthServer";
import { oauthJson, oauthResultResponse, preflight } from "@/server/oauth/oauthHttp";

/** Dynamic client registration (RFC 7591) for the MCP connector (#322). */
export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return oauthJson(
      { error: "invalid_client_metadata", error_description: "The body must be JSON." },
      400
    );
  }

  return oauthResultResponse(await registerOAuthClient(body));
}

export { preflight as OPTIONS };
