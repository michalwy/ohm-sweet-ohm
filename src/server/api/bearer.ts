/**
 * The API token in a request's `Authorization: Bearer <token>` header (#274, #275), or `null`. Pure.
 *
 * The REST API and the MCP server accept **only** this credential: browser cookies are never read,
 * so a signed-in browser cannot be made to call the API on its user's behalf (no CSRF surface).
 */
export function readBearerToken(headers: Headers): string | null {
  const header = headers.get("authorization");

  if (!header) {
    return null;
  }

  const match = /^Bearer[ \t]+(\S+)[ \t]*$/i.exec(header);

  return match ? match[1] : null;
}
