import "server-only";

import type { OAuthResult } from "@/server/oauth/oauthServer";

/**
 * HTTP glue for the OAuth endpoints (#322). They carry no cookies, so they answer any origin
 * (browser-based MCP clients register and exchange tokens from their own page); nothing is cached.
 */

export const corsHeaders = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, POST, OPTIONS",
  "access-control-allow-headers": "authorization, content-type, mcp-protocol-version",
  "access-control-max-age": "86400"
};

export function oauthJson(body: unknown, status = 200) {
  return Response.json(body, {
    status,
    headers: { ...corsHeaders, "cache-control": "no-store", pragma: "no-cache" }
  });
}

export function oauthResultResponse(result: OAuthResult) {
  const response = oauthJson(result.body, result.status);

  if (result.status === 401) {
    response.headers.set("www-authenticate", 'Basic realm="OhmSweetOhm"');
  }

  return response;
}

export function preflight() {
  return new Response(null, { status: 204, headers: corsHeaders });
}

/** A token or revocation request's parameters: `application/x-www-form-urlencoded`, or JSON. */
export async function readFormBody(request: Request): Promise<Record<string, string> | null> {
  const contentType = request.headers.get("content-type") ?? "";

  try {
    if (contentType.includes("application/json")) {
      const json = (await request.json()) as unknown;

      if (typeof json !== "object" || json === null || Array.isArray(json)) {
        return null;
      }

      return Object.fromEntries(
        Object.entries(json).filter((entry): entry is [string, string] => typeof entry[1] === "string")
      );
    }

    const params = new URLSearchParams(await request.text());

    return Object.fromEntries(params.entries());
  } catch {
    return null;
  }
}
