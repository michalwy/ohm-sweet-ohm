import { exchangeOAuthToken } from "@/server/oauth/oauthServer";
import { oauthJson, oauthResultResponse, preflight, readFormBody } from "@/server/oauth/oauthHttp";

/** The OAuth token endpoint (#322): authorization code with PKCE, and refresh token rotation. */
export async function POST(request: Request) {
  const form = await readFormBody(request);

  if (!form) {
    return oauthJson({ error: "invalid_request", error_description: "Unreadable body." }, 400);
  }

  return oauthResultResponse(await exchangeOAuthToken(form, request.headers.get("authorization")));
}

export { preflight as OPTIONS };
