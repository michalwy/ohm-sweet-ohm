import "server-only";

import type { WorkspaceActor } from "@/server/access-control/actor";
import { resolveMemberActor } from "@/server/access-control/actor";
import { resolveApiTokenPermissions } from "@/server/api-tokens/apiTokenPermissions";
import { prisma } from "@/server/db/prisma";
import {
  MAX_REDIRECT_URIS,
  OAUTH_ACCESS_TOKEN_PREFIX,
  OAUTH_ACCESS_TOKEN_TTL_SECONDS,
  OAUTH_CLIENT_ID_PREFIX,
  OAUTH_CLIENT_SECRET_PREFIX,
  OAUTH_CODE_PREFIX,
  OAUTH_CODE_TTL_SECONDS,
  OAUTH_REFRESH_TOKEN_PREFIX,
  OAUTH_REFRESH_TOKEN_TTL_SECONDS,
  OAUTH_SCOPE,
  OAUTH_TOKEN_ENDPOINT_AUTH_METHODS,
  PKCE_CHALLENGE_PATTERN,
  buildClientRedirect,
  constantTimeEqualHex,
  generateOAuthValue,
  hashOAuthValue,
  isAcceptedResource,
  isAllowedRedirectUri,
  isOAuthGrantAccess,
  isWellFormedOAuthValue,
  normalizeBaseUrl,
  oauthUrls,
  verifyPkce,
  type OAuthGrantAccess,
  type OAuthTokenEndpointAuthMethod
} from "@/server/oauth/oauthValues";

/**
 * The OAuth 2.1 authorization server for the remote MCP connector (#322, ADR 0031): dynamic client
 * registration, the authorization code flow with PKCE (S256, always), refresh token rotation and
 * revocation, tied to the app's existing user accounts.
 *
 * A **grant** (a "connected app") is one user's approval of one client, bound to one of the user's
 * workspaces and an access preset. An access token acts exactly as a personal API token with that
 * preset would: as its user, in that workspace, with the preset ∩ the user's roles, re-checked on
 * every request through `resolveMemberActor`.
 */

export function getOAuthBaseUrl() {
  return normalizeBaseUrl(process.env.BETTER_AUTH_URL ?? "http://localhost:3000");
}

/** An OAuth error answer: `{ error, error_description }` with its HTTP status. */
export type OAuthResult = { status: number; body: Record<string, unknown> };

function oauthError(status: number, error: string, description: string): OAuthResult {
  return { status, body: { error, error_description: description } };
}

const CLIENT_NAME_MAX_LENGTH = 200;
/** A registered client nobody approved within a day is removed at the next registration. */
const UNUSED_CLIENT_TTL_MS = 24 * 60 * 60 * 1000;
const LAST_USED_RESOLUTION_MS = 60_000;

// --- Dynamic client registration (RFC 7591) -------------------------------------------------

export async function registerOAuthClient(raw: unknown, now: Date = new Date()): Promise<OAuthResult> {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return oauthError(400, "invalid_client_metadata", "The body must be a JSON object.");
  }

  const body = raw as Record<string, unknown>;
  const redirectUris = body.redirect_uris;

  if (
    !Array.isArray(redirectUris) ||
    redirectUris.length === 0 ||
    redirectUris.length > MAX_REDIRECT_URIS ||
    !redirectUris.every((uri) => typeof uri === "string" && isAllowedRedirectUri(uri))
  ) {
    return oauthError(
      400,
      "invalid_redirect_uri",
      `redirect_uris must list 1 to ${MAX_REDIRECT_URIS} https URLs (http only on a loopback address), without fragments.`
    );
  }

  const authMethod = body.token_endpoint_auth_method ?? "client_secret_basic";

  if (!(OAUTH_TOKEN_ENDPOINT_AUTH_METHODS as readonly unknown[]).includes(authMethod)) {
    return oauthError(
      400,
      "invalid_client_metadata",
      `token_endpoint_auth_method must be one of ${OAUTH_TOKEN_ENDPOINT_AUTH_METHODS.join(", ")}.`
    );
  }

  const grantTypes = body.grant_types ?? ["authorization_code"];

  if (
    !Array.isArray(grantTypes) ||
    !grantTypes.every((type) => type === "authorization_code" || type === "refresh_token")
  ) {
    return oauthError(
      400,
      "invalid_client_metadata",
      "grant_types may hold only authorization_code and refresh_token."
    );
  }

  const responseTypes = body.response_types ?? ["code"];

  if (!Array.isArray(responseTypes) || !responseTypes.every((type) => type === "code")) {
    return oauthError(400, "invalid_client_metadata", "response_types may hold only code.");
  }

  const rawName = typeof body.client_name === "string" ? body.client_name.trim() : "";
  const name = (rawName || "Unnamed app").slice(0, CLIENT_NAME_MAX_LENGTH);
  const method = authMethod as OAuthTokenEndpointAuthMethod;
  const clientId = generateOAuthValue(OAUTH_CLIENT_ID_PREFIX);
  const clientSecret = method === "none" ? null : generateOAuthValue(OAUTH_CLIENT_SECRET_PREFIX);

  await prisma.oAuthClient.deleteMany({
    where: { createdAt: { lt: new Date(now.getTime() - UNUSED_CLIENT_TTL_MS) }, grants: { none: {} } }
  });

  const created = await prisma.oAuthClient.create({
    data: {
      clientId,
      clientSecretHash: clientSecret ? hashOAuthValue(clientSecret) : null,
      tokenEndpointAuthMethod: method,
      name,
      redirectUris: redirectUris as string[]
    }
  });

  return {
    status: 201,
    body: {
      client_id: clientId,
      ...(clientSecret ? { client_secret: clientSecret, client_secret_expires_at: 0 } : {}),
      client_id_issued_at: Math.floor(created.createdAt.getTime() / 1000),
      client_name: name,
      redirect_uris: created.redirectUris,
      token_endpoint_auth_method: method,
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      scope: OAUTH_SCOPE
    }
  };
}

// --- Authorization request ------------------------------------------------------------------

export type AuthorizationParams = {
  response_type?: string;
  client_id?: string;
  redirect_uri?: string;
  code_challenge?: string;
  code_challenge_method?: string;
  state?: string;
  scope?: string;
  resource?: string;
};

export const AUTHORIZATION_PARAM_NAMES = [
  "response_type",
  "client_id",
  "redirect_uri",
  "code_challenge",
  "code_challenge_method",
  "state",
  "scope",
  "resource"
] as const;

export function readAuthorizationParams(
  get: (name: string) => string | null | undefined
): AuthorizationParams {
  const params: AuthorizationParams = {};

  for (const name of AUTHORIZATION_PARAM_NAMES) {
    const value = get(name);

    if (typeof value === "string") {
      params[name] = value;
    }
  }

  return params;
}

export type ValidatedAuthorization = {
  client: { id: string; clientId: string; name: string };
  redirectUri: string;
  codeChallenge: string;
  state: string | null;
};

/**
 * Checks an authorization request. A request whose client or redirect URI cannot be trusted is
 * shown as an error page (`show`) — never redirected; any other fault is sent back to the client's
 * registered redirect URI (`redirect`), as OAuth requires.
 */
export async function validateAuthorizationRequest(
  params: AuthorizationParams
): Promise<
  | { ok: true; request: ValidatedAuthorization }
  | { ok: false; show: string }
  | { ok: false; redirect: string }
> {
  const client = params.client_id
    ? await prisma.oAuthClient.findUnique({
        where: { clientId: params.client_id },
        select: { id: true, clientId: true, name: true, redirectUris: true }
      })
    : null;

  if (!client) {
    return { ok: false, show: "unknown-client" };
  }

  const redirectUri = params.redirect_uri;

  if (!redirectUri || !client.redirectUris.includes(redirectUri)) {
    return { ok: false, show: "invalid-redirect-uri" };
  }

  const state = params.state || null;
  const fail = (error: string, description: string) => ({
    ok: false as const,
    redirect: buildClientRedirect(redirectUri, {
      error,
      error_description: description,
      state,
      iss: oauthUrls(getOAuthBaseUrl()).issuer
    })
  });

  if (params.response_type !== "code") {
    return fail("unsupported_response_type", "Only response_type=code is supported.");
  }

  if (params.code_challenge_method !== "S256" || !params.code_challenge) {
    return fail("invalid_request", "PKCE with code_challenge_method=S256 is required.");
  }

  if (!PKCE_CHALLENGE_PATTERN.test(params.code_challenge)) {
    return fail("invalid_request", "code_challenge is not a valid S256 challenge.");
  }

  if (!isAcceptedResource(params.resource, getOAuthBaseUrl())) {
    return fail("invalid_target", "resource must be this app's MCP server.");
  }

  return {
    ok: true,
    request: {
      client: { id: client.id, clientId: client.clientId, name: client.name },
      redirectUri,
      codeChallenge: params.code_challenge,
      state
    }
  };
}

export type AuthorizationDecision =
  | { approve: false }
  | { approve: true; workspaceId: string; access: OAuthGrantAccess };

/**
 * The signed-in user's answer on the consent screen. Approving creates (or replaces) the user's
 * grant for this client — the workspace and access of the latest approval win, and tokens issued
 * under an earlier approval stop working — and returns the redirect carrying a single-use code.
 * Denying returns the `access_denied` redirect. The request is re-validated here: the consent
 * form's fields are never trusted.
 */
export async function decideAuthorization(
  userId: string,
  params: AuthorizationParams,
  decision: AuthorizationDecision,
  now: Date = new Date()
): Promise<{ ok: true; redirect: string } | { ok: false; show: string }> {
  const validated = await validateAuthorizationRequest(params);

  if (!validated.ok) {
    return "show" in validated ? validated : { ok: true, redirect: validated.redirect };
  }

  const { request } = validated;
  const issuer = oauthUrls(getOAuthBaseUrl()).issuer;

  if (!decision.approve) {
    return {
      ok: true,
      redirect: buildClientRedirect(request.redirectUri, {
        error: "access_denied",
        error_description: "The user did not approve the request.",
        state: request.state,
        iss: issuer
      })
    };
  }

  if (!isOAuthGrantAccess(decision.access)) {
    return { ok: false, show: "invalid-access" };
  }

  const membership = await prisma.workspaceMember.findFirst({
    where: { userId, workspaceId: decision.workspaceId, workspace: { archivedAt: null } },
    select: { id: true }
  });

  if (!membership) {
    return { ok: false, show: "workspace-not-found" };
  }

  const code = generateOAuthValue(OAUTH_CODE_PREFIX);

  await prisma.$transaction(async (tx) => {
    const existing = await tx.oAuthGrant.findUnique({
      where: { clientId_userId: { clientId: request.client.id, userId } },
      select: { id: true }
    });

    const grant = existing
      ? await tx.oAuthGrant.update({
          where: { id: existing.id },
          data: { workspaceId: decision.workspaceId, access: decision.access },
          select: { id: true }
        })
      : await tx.oAuthGrant.create({
          data: {
            clientId: request.client.id,
            userId,
            workspaceId: decision.workspaceId,
            access: decision.access
          },
          select: { id: true }
        });

    if (existing) {
      await tx.oAuthToken.deleteMany({ where: { grantId: grant.id } });
      await tx.oAuthAuthorizationCode.deleteMany({ where: { grantId: grant.id } });
    }

    await tx.oAuthAuthorizationCode.create({
      data: {
        grantId: grant.id,
        codeHash: hashOAuthValue(code),
        redirectUri: request.redirectUri,
        codeChallenge: request.codeChallenge,
        expiresAt: new Date(now.getTime() + OAUTH_CODE_TTL_SECONDS * 1000)
      }
    });
  });

  return {
    ok: true,
    redirect: buildClientRedirect(request.redirectUri, {
      code,
      state: request.state,
      iss: issuer
    })
  };
}

// --- Token endpoint ---------------------------------------------------------------------------

type ClientCredentials = { clientId: string | null; clientSecret: string | null; basic: boolean };

/** Client credentials from HTTP Basic (RFC 6749 § 2.3.1) or from the form body. */
export function readClientCredentials(
  form: Record<string, string>,
  authorizationHeader: string | null
): ClientCredentials | null {
  if (authorizationHeader && /^Basic\s+/i.test(authorizationHeader)) {
    try {
      const decoded = Buffer.from(authorizationHeader.replace(/^Basic\s+/i, ""), "base64").toString("utf8");
      const colon = decoded.indexOf(":");

      if (colon < 0) {
        return null;
      }

      const clientId = decodeURIComponent(decoded.slice(0, colon));
      const clientSecret = decodeURIComponent(decoded.slice(colon + 1));

      if (form.client_id && form.client_id !== clientId) {
        return null;
      }

      return { clientId, clientSecret, basic: true };
    } catch {
      return null;
    }
  }

  return {
    clientId: form.client_id || null,
    clientSecret: form.client_secret || null,
    basic: false
  };
}

async function authenticateClient(
  form: Record<string, string>,
  authorizationHeader: string | null
) {
  const credentials = readClientCredentials(form, authorizationHeader);

  if (!credentials?.clientId) {
    return null;
  }

  const client = await prisma.oAuthClient.findUnique({
    where: { clientId: credentials.clientId },
    select: { id: true, clientId: true, clientSecretHash: true, tokenEndpointAuthMethod: true }
  });

  if (!client) {
    return null;
  }

  if (client.tokenEndpointAuthMethod === "none") {
    return credentials.clientSecret ? null : client;
  }

  if (!credentials.clientSecret || !client.clientSecretHash) {
    return null;
  }

  return constantTimeEqualHex(hashOAuthValue(credentials.clientSecret), client.clientSecretHash)
    ? client
    : null;
}

async function issueTokens(grantId: string, now: Date): Promise<OAuthResult> {
  const accessToken = generateOAuthValue(OAUTH_ACCESS_TOKEN_PREFIX);
  const refreshToken = generateOAuthValue(OAUTH_REFRESH_TOKEN_PREFIX);

  await prisma.oAuthToken.create({
    data: {
      grantId,
      accessTokenHash: hashOAuthValue(accessToken),
      refreshTokenHash: hashOAuthValue(refreshToken),
      accessTokenExpiresAt: new Date(now.getTime() + OAUTH_ACCESS_TOKEN_TTL_SECONDS * 1000),
      refreshTokenExpiresAt: new Date(now.getTime() + OAUTH_REFRESH_TOKEN_TTL_SECONDS * 1000)
    }
  });

  return {
    status: 200,
    body: {
      access_token: accessToken,
      token_type: "Bearer",
      expires_in: OAUTH_ACCESS_TOKEN_TTL_SECONDS,
      refresh_token: refreshToken,
      scope: OAUTH_SCOPE
    }
  };
}

const invalidClient = () =>
  oauthError(401, "invalid_client", "Client authentication failed.");
const invalidGrant = (description: string) => oauthError(400, "invalid_grant", description);

/** The token endpoint: `authorization_code` (PKCE always) and `refresh_token` (rotated). */
export async function exchangeOAuthToken(
  form: Record<string, string>,
  authorizationHeader: string | null,
  now: Date = new Date()
): Promise<OAuthResult> {
  const client = await authenticateClient(form, authorizationHeader);

  if (!client) {
    return invalidClient();
  }

  if (form.resource && !isAcceptedResource(form.resource, getOAuthBaseUrl())) {
    return oauthError(400, "invalid_target", "resource must be this app's MCP server.");
  }

  if (form.grant_type === "authorization_code") {
    const code = form.code ?? "";

    if (!isWellFormedOAuthValue(code, OAUTH_CODE_PREFIX)) {
      return invalidGrant("The code is invalid.");
    }

    const stored = await prisma.oAuthAuthorizationCode.findUnique({
      where: { codeHash: hashOAuthValue(code) },
      select: {
        id: true,
        grantId: true,
        redirectUri: true,
        codeChallenge: true,
        expiresAt: true,
        grant: { select: { clientId: true } }
      }
    });

    if (!stored) {
      return invalidGrant("The code is invalid, expired or already used.");
    }

    // Single use: whoever deletes the row owns the code; a second exchange finds nothing.
    const { count } = await prisma.oAuthAuthorizationCode.deleteMany({ where: { id: stored.id } });

    if (count !== 1) {
      return invalidGrant("The code is invalid, expired or already used.");
    }

    if (stored.grant.clientId !== client.id) {
      return invalidGrant("The code was issued to another client.");
    }

    if (stored.expiresAt.getTime() <= now.getTime()) {
      return invalidGrant("The code is invalid, expired or already used.");
    }

    if (form.redirect_uri !== stored.redirectUri) {
      return invalidGrant("redirect_uri does not match the authorization request.");
    }

    if (!form.code_verifier || !verifyPkce(form.code_verifier, stored.codeChallenge)) {
      return invalidGrant("PKCE verification failed.");
    }

    return issueTokens(stored.grantId, now);
  }

  if (form.grant_type === "refresh_token") {
    const refreshToken = form.refresh_token ?? "";

    if (!isWellFormedOAuthValue(refreshToken, OAUTH_REFRESH_TOKEN_PREFIX)) {
      return invalidGrant("The refresh token is invalid.");
    }

    const stored = await prisma.oAuthToken.findUnique({
      where: { refreshTokenHash: hashOAuthValue(refreshToken) },
      select: { id: true, grantId: true, refreshTokenExpiresAt: true, grant: { select: { clientId: true } } }
    });

    if (!stored || stored.grant.clientId !== client.id) {
      return invalidGrant("The refresh token is invalid, expired or revoked.");
    }

    // Rotation: the old pair is gone before the new one exists, so a refresh token works once.
    const { count } = await prisma.oAuthToken.deleteMany({ where: { id: stored.id } });

    if (count !== 1 || stored.refreshTokenExpiresAt.getTime() <= now.getTime()) {
      return invalidGrant("The refresh token is invalid, expired or revoked.");
    }

    return issueTokens(stored.grantId, now);
  }

  return oauthError(
    400,
    "unsupported_grant_type",
    "grant_type must be authorization_code or refresh_token."
  );
}

/**
 * Token revocation (RFC 7009): revokes the access/refresh pair the given token belongs to, when it
 * is the authenticated client's. Answers 200 whether or not the token was known.
 */
export async function revokeOAuthToken(
  form: Record<string, string>,
  authorizationHeader: string | null
): Promise<OAuthResult> {
  const client = await authenticateClient(form, authorizationHeader);

  if (!client) {
    return invalidClient();
  }

  const token = form.token ?? "";
  const hash = hashOAuthValue(token);

  await prisma.oAuthToken.deleteMany({
    where: {
      grant: { clientId: client.id },
      OR: [{ accessTokenHash: hash }, { refreshTokenHash: hash }]
    }
  });

  return { status: 200, body: {} };
}

// --- Resource server ----------------------------------------------------------------------------

export function isOAuthAccessToken(value: string) {
  return value.startsWith(OAUTH_ACCESS_TOKEN_PREFIX);
}

/**
 * The actor for an OAuth access token: the grant's user, in the grant's workspace, with the
 * grant's preset intersected with the user's roles — the same `resolveMemberActor` sessions and
 * API tokens use. `null` for a malformed, unknown, expired or revoked token, a workspace the user
 * left, or an archived workspace.
 */
export async function resolveOAuthActor(
  value: string,
  now: Date = new Date()
): Promise<WorkspaceActor | null> {
  if (!isWellFormedOAuthValue(value, OAUTH_ACCESS_TOKEN_PREFIX)) {
    return null;
  }

  const token = await prisma.oAuthToken.findUnique({
    where: { accessTokenHash: hashOAuthValue(value) },
    select: {
      accessTokenExpiresAt: true,
      grant: { select: { id: true, userId: true, workspaceId: true, access: true } }
    }
  });

  if (!token || token.accessTokenExpiresAt.getTime() <= now.getTime()) {
    return null;
  }

  const actor = await resolveMemberActor(
    {
      userId: token.grant.userId,
      workspace: { id: token.grant.workspaceId },
      tokenPermissions: isOAuthGrantAccess(token.grant.access)
        ? resolveApiTokenPermissions(token.grant.access, [])
        : []
    },
    { allowArchived: false }
  );

  if (actor) {
    await prisma.oAuthGrant.updateMany({
      where: {
        id: token.grant.id,
        OR: [
          { lastUsedAt: null },
          { lastUsedAt: { lt: new Date(now.getTime() - LAST_USED_RESOLUTION_MS) } }
        ]
      },
      data: { lastUsedAt: now }
    });
  }

  return actor;
}

// --- Connected apps (Settings) ------------------------------------------------------------------

export type ConnectedApp = {
  id: string;
  name: string;
  redirectHost: string;
  workspace: { id: string; name: string; slug: string };
  access: OAuthGrantAccess;
  connectedAt: Date;
  lastUsedAt: Date | null;
};

function hostOf(uri: string | undefined) {
  try {
    return uri ? new URL(uri).host : "";
  } catch {
    return "";
  }
}

/** The apps `userId` has connected, newest first. */
export async function listConnectedApps(userId: string): Promise<ConnectedApp[]> {
  const grants = await prisma.oAuthGrant.findMany({
    where: { userId },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: {
      id: true,
      access: true,
      createdAt: true,
      lastUsedAt: true,
      client: { select: { name: true, redirectUris: true } },
      workspace: { select: { id: true, name: true, slug: true } }
    }
  });

  return grants.map((grant) => ({
    id: grant.id,
    name: grant.client.name,
    redirectHost: hostOf(grant.client.redirectUris[0]),
    workspace: grant.workspace,
    access: isOAuthGrantAccess(grant.access) ? grant.access : "read-only",
    connectedAt: grant.createdAt,
    lastUsedAt: grant.lastUsedAt
  }));
}

/**
 * Disconnects one of `userId`'s apps: the grant, its codes and its tokens are deleted, so the next
 * call with any of its tokens is refused. Another user's grant is "not found".
 */
export async function disconnectConnectedApp(userId: string, grantId: string) {
  const { count } = await prisma.oAuthGrant.deleteMany({ where: { id: grantId, userId } });

  if (count === 0) {
    throw new Error("connected-app-not-found");
  }
}
