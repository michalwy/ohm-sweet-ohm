import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * The pure pieces of the OAuth 2.1 authorization server (#322, ADR 0031): credential values, PKCE,
 * redirect URI rules and the discovery metadata. No Prisma and no server infrastructure, so unit
 * tests can load it.
 *
 * Every credential is 32 random bytes in base64url behind a prefix that says what it is; the
 * database keeps only its SHA-256 hash, as for personal API tokens (#273). A slow hash is not
 * needed: the values are 256 random bits, not guessable secrets.
 */

export const OAUTH_ACCESS_TOKEN_PREFIX = "osoat_";
export const OAUTH_REFRESH_TOKEN_PREFIX = "osort_";
export const OAUTH_CODE_PREFIX = "osoac_";
export const OAUTH_CLIENT_ID_PREFIX = "osoci_";
export const OAUTH_CLIENT_SECRET_PREFIX = "osocs_";

/** The one scope: use the MCP server as the approving user, in the workspace they chose. */
export const OAUTH_SCOPE = "mcp";

export const OAUTH_CODE_TTL_SECONDS = 5 * 60;
export const OAUTH_ACCESS_TOKEN_TTL_SECONDS = 60 * 60;
export const OAUTH_REFRESH_TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60;

/** The access a connected app may be given at consent: the two API token presets (#273). */
export const OAUTH_GRANT_ACCESS_LEVELS = ["read-only", "read-write"] as const;

export type OAuthGrantAccess = (typeof OAUTH_GRANT_ACCESS_LEVELS)[number];

export function isOAuthGrantAccess(value: unknown): value is OAuthGrantAccess {
  return typeof value === "string" && (OAUTH_GRANT_ACCESS_LEVELS as readonly string[]).includes(value);
}

export const OAUTH_TOKEN_ENDPOINT_AUTH_METHODS = [
  "none",
  "client_secret_post",
  "client_secret_basic"
] as const;

export type OAuthTokenEndpointAuthMethod = (typeof OAUTH_TOKEN_ENDPOINT_AUTH_METHODS)[number];

const VALUE_BODY_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export function generateOAuthValue(prefix: string) {
  return `${prefix}${randomBytes(32).toString("base64url")}`;
}

/** Whether a string has the shape of a value with `prefix`; a malformed one is refused without a lookup. */
export function isWellFormedOAuthValue(value: string, prefix: string) {
  return value.startsWith(prefix) && VALUE_BODY_PATTERN.test(value.slice(prefix.length));
}

export function hashOAuthValue(value: string) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

export function constantTimeEqualHex(a: string, b: string) {
  const left = Buffer.from(a, "hex");
  const right = Buffer.from(b, "hex");

  return left.length === right.length && left.length > 0 && timingSafeEqual(left, right);
}

/** PKCE (RFC 7636): only S256 is accepted; `plain` never. */
export const PKCE_CHALLENGE_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const PKCE_VERIFIER_PATTERN = /^[A-Za-z0-9._~-]{43,128}$/;

export function pkceS256Challenge(verifier: string) {
  return createHash("sha256").update(verifier, "ascii").digest("base64url");
}

export function verifyPkce(verifier: string, challenge: string) {
  if (!PKCE_VERIFIER_PATTERN.test(verifier)) {
    return false;
  }

  const computed = Buffer.from(pkceS256Challenge(verifier));
  const expected = Buffer.from(challenge);

  return computed.length === expected.length && timingSafeEqual(computed, expected);
}

const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

export const MAX_REDIRECT_URIS = 10;
export const MAX_REDIRECT_URI_LENGTH = 2000;

/**
 * A redirect URI a client may register (OAuth 2.1 § 2.3.1, RFC 8252): an absolute `https` URL, or
 * `http` on a loopback address for a native client; never a fragment, never userinfo.
 */
export function isAllowedRedirectUri(value: string) {
  if (value.length === 0 || value.length > MAX_REDIRECT_URI_LENGTH) {
    return false;
  }

  let url: URL;

  try {
    url = new URL(value);
  } catch {
    return false;
  }

  if (url.hash || url.username || url.password || value.includes("#")) {
    return false;
  }

  if (url.protocol === "https:") {
    return true;
  }

  return url.protocol === "http:" && LOOPBACK_HOSTS.has(url.hostname);
}

/** The app's public origin, from `BETTER_AUTH_URL` (the one public URL setting), without a trailing slash. */
export function normalizeBaseUrl(raw: string) {
  const url = new URL(raw);

  return `${url.origin}${url.pathname.replace(/\/+$/, "")}`;
}

export function oauthUrls(baseUrl: string) {
  const base = normalizeBaseUrl(baseUrl);

  return {
    issuer: base,
    resource: `${base}/api/mcp`,
    authorizationEndpoint: `${base}/oauth/authorize`,
    tokenEndpoint: `${base}/api/oauth/token`,
    registrationEndpoint: `${base}/api/oauth/register`,
    revocationEndpoint: `${base}/api/oauth/revoke`,
    protectedResourceMetadata: `${base}/.well-known/oauth-protected-resource/api/mcp`
  };
}

/** Authorization server metadata (RFC 8414). */
export function authorizationServerMetadata(baseUrl: string) {
  const urls = oauthUrls(baseUrl);

  return {
    issuer: urls.issuer,
    authorization_endpoint: urls.authorizationEndpoint,
    token_endpoint: urls.tokenEndpoint,
    registration_endpoint: urls.registrationEndpoint,
    revocation_endpoint: urls.revocationEndpoint,
    scopes_supported: [OAUTH_SCOPE],
    response_types_supported: ["code"],
    response_modes_supported: ["query"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    token_endpoint_auth_methods_supported: [...OAUTH_TOKEN_ENDPOINT_AUTH_METHODS],
    revocation_endpoint_auth_methods_supported: [...OAUTH_TOKEN_ENDPOINT_AUTH_METHODS],
    code_challenge_methods_supported: ["S256"],
    authorization_response_iss_parameter_supported: true
  };
}

/** Protected resource metadata (RFC 9728) for the MCP server. */
export function protectedResourceMetadata(baseUrl: string) {
  const urls = oauthUrls(baseUrl);

  return {
    resource: urls.resource,
    authorization_servers: [urls.issuer],
    scopes_supported: [OAUTH_SCOPE],
    bearer_methods_supported: ["header"],
    resource_name: "OhmSweetOhm"
  };
}

/**
 * Whether an RFC 8707 `resource` parameter names this MCP server. Absent is fine; the origin alone
 * is accepted too, since some clients send it.
 */
export function isAcceptedResource(resource: string | null | undefined, baseUrl: string) {
  if (!resource) {
    return true;
  }

  const urls = oauthUrls(baseUrl);
  const trimmed = resource.replace(/\/+$/, "");

  return trimmed === urls.resource || trimmed === urls.issuer;
}

/** The redirect back to the client: `code` or `error`, plus `state` and `iss` (RFC 9207). */
export function buildClientRedirect(
  redirectUri: string,
  params: Record<string, string | null | undefined>
) {
  const url = new URL(redirectUri);

  for (const [key, value] of Object.entries(params)) {
    if (value !== null && value !== undefined && value !== "") {
      url.searchParams.set(key, value);
    }
  }

  return url.toString();
}

/**
 * The sign-in page's `next` target, when it is an OAuth authorization request of this app; anything
 * else is dropped, so `next` can never be an open redirect.
 */
export function safeOAuthNextPath(value: unknown) {
  if (typeof value !== "string" || !value.startsWith("/oauth/authorize?") || value.length > 4000) {
    return null;
  }

  if (value.includes("\\") || /[\u0000-\u001f]/.test(value)) {
    return null;
  }

  return value;
}
