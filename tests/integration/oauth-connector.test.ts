import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { describe, test } from "node:test";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

import { GET as authorizationServerGet } from "../../src/app/.well-known/oauth-authorization-server/route";
import { GET as protectedResourceMcpGet } from "../../src/app/.well-known/oauth-protected-resource/api/mcp/route";
import { GET as protectedResourceGet } from "../../src/app/.well-known/oauth-protected-resource/route";
import { POST as consentPost } from "../../src/app/api/oauth/authorize/route";
import { POST as registerPost } from "../../src/app/api/oauth/register/route";
import { POST as revokePost } from "../../src/app/api/oauth/revoke/route";
import { POST as tokenPost } from "../../src/app/api/oauth/token/route";
import { POST as mcpPost } from "../../src/app/api/mcp/route";
import { GET as meGet } from "../../src/app/api/v1/me/route";
import { prisma } from "../../src/server/db/prisma";
import {
  decideAuthorization,
  disconnectConnectedApp,
  getOAuthBaseUrl,
  listConnectedApps,
  validateAuthorizationRequest,
  type AuthorizationParams
} from "../../src/server/oauth/oauthServer";
import { oauthUrls, pkceS256Challenge } from "../../src/server/oauth/oauthValues";
import { bearer, createApiTestWorkspace, createTestToken } from "./apiFixtures";

const base = getOAuthBaseUrl();
const urls = oauthUrls(base);
const REDIRECT_URI = "https://claude.ai/api/mcp/auth_callback";

async function register(body: unknown) {
  const response = await registerPost(
    new Request(urls.registrationEndpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body)
    })
  );

  return { status: response.status, body: (await response.json()) as Record<string, string> };
}

async function token(form: Record<string, string>, headers: Record<string, string> = {}) {
  const response = await tokenPost(
    new Request(urls.tokenEndpoint, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded", ...headers },
      body: new URLSearchParams(form).toString()
    })
  );

  return { status: response.status, body: (await response.json()) as Record<string, string> };
}

function pkce() {
  const verifier = randomBytes(32).toString("base64url");
  return { verifier, challenge: pkceS256Challenge(verifier) };
}

function authorizationParams(clientId: string, challenge: string, extra: AuthorizationParams = {}) {
  return {
    response_type: "code",
    client_id: clientId,
    redirect_uri: REDIRECT_URI,
    code_challenge: challenge,
    code_challenge_method: "S256",
    state: "state-123",
    scope: "mcp",
    resource: urls.resource,
    ...extra
  } satisfies AuthorizationParams;
}

/** Registers a public client, approves it for `userId` in `workspaceId`, and returns the code. */
async function approve(
  userId: string,
  workspaceId: string,
  access: "read-only" | "read-write" = "read-only",
  clientId?: string
) {
  const id = clientId ?? (await register({ redirect_uris: [REDIRECT_URI], token_endpoint_auth_method: "none", client_name: "Claude" })).body.client_id;
  const { verifier, challenge } = pkce();
  const decided = await decideAuthorization(userId, authorizationParams(id, challenge), {
    approve: true,
    workspaceId,
    access
  });

  assert.ok(decided.ok, JSON.stringify(decided));

  const redirect = new URL(decided.redirect);

  assert.equal(`${redirect.origin}${redirect.pathname}`, REDIRECT_URI);
  assert.equal(redirect.searchParams.get("state"), "state-123");
  assert.equal(redirect.searchParams.get("iss"), urls.issuer);

  return { clientId: id, verifier, code: redirect.searchParams.get("code") ?? "" };
}

async function connectMcp(accessToken: string) {
  const transport = new StreamableHTTPClientTransport(new URL(urls.resource), {
    requestInit: { headers: bearer(accessToken) },
    fetch: async (input, init) => mcpPost(new Request(input, init))
  });
  const client = new Client({ name: "oso-oauth-test", version: "1.0.0" });

  await client.connect(transport);

  return client;
}

async function mcpStatus(accessToken: string | null) {
  const response = await mcpPost(
    new Request(urls.resource, {
      method: "POST",
      headers: {
        ...(accessToken ? bearer(accessToken) : {}),
        "content-type": "application/json",
        accept: "application/json, text/event-stream"
      },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" })
    })
  );

  return response;
}

describe("Remote MCP connector: OAuth 2.1 (#322)", () => {
  test("discovery: protected-resource and authorization-server metadata, and the 401 challenge", async () => {
    for (const get of [protectedResourceGet, protectedResourceMcpGet]) {
      const response = get();
      const body = await response.json();

      assert.equal(response.status, 200);
      assert.equal(body.resource, urls.resource);
      assert.deepEqual(body.authorization_servers, [urls.issuer]);
    }

    const server = await authorizationServerGet().json();

    assert.equal(server.issuer, urls.issuer);
    assert.equal(server.token_endpoint, urls.tokenEndpoint);
    assert.equal(server.registration_endpoint, urls.registrationEndpoint);
    assert.deepEqual(server.code_challenge_methods_supported, ["S256"]);

    const unauthorized = await mcpStatus(null);

    assert.equal(unauthorized.status, 401);
    assert.match(
      unauthorized.headers.get("www-authenticate") ?? "",
      new RegExp(`resource_metadata="${urls.protectedResourceMetadata.replace(/[.]/g, "\\.")}"`)
    );
  });

  test("dynamic client registration validates redirect URIs and auth methods", async () => {
    assert.equal((await register({ redirect_uris: ["http://evil.example/cb"] })).status, 400);
    assert.equal((await register({ redirect_uris: [] })).status, 400);
    assert.equal(
      (await register({ redirect_uris: [REDIRECT_URI], token_endpoint_auth_method: "private_key_jwt" })).status,
      400
    );

    const publicClient = await register({
      redirect_uris: [REDIRECT_URI],
      token_endpoint_auth_method: "none",
      client_name: "Claude"
    });

    assert.equal(publicClient.status, 201);
    assert.match(publicClient.body.client_id, /^osoci_/);
    assert.equal(publicClient.body.client_secret, undefined);

    const confidential = await register({ redirect_uris: [REDIRECT_URI] });

    assert.equal(confidential.status, 201);
    assert.match(confidential.body.client_secret, /^osocs_/);
    assert.equal(confidential.body.token_endpoint_auth_method, "client_secret_basic");

    const stored = await prisma.oAuthClient.findUniqueOrThrow({
      where: { clientId: confidential.body.client_id }
    });

    assert.notEqual(stored.clientSecretHash, confidential.body.client_secret, "only the hash is stored");
  });

  test("authorization requests: untrusted client or redirect is shown, other faults go back to the app", async () => {
    const { body } = await register({ redirect_uris: [REDIRECT_URI], token_endpoint_auth_method: "none" });
    const { challenge } = pkce();

    const unknown = await validateAuthorizationRequest(authorizationParams("osoci_unknown", challenge));
    assert.deepEqual(unknown, { ok: false, show: "unknown-client" });

    const wrongRedirect = await validateAuthorizationRequest(
      authorizationParams(body.client_id, challenge, { redirect_uri: "https://evil.example/cb" })
    );
    assert.deepEqual(wrongRedirect, { ok: false, show: "invalid-redirect-uri" });

    const noPkce = await validateAuthorizationRequest(
      authorizationParams(body.client_id, challenge, { code_challenge: undefined })
    );
    assert.ok(!noPkce.ok && "redirect" in noPkce);
    assert.equal(new URL(noPkce.redirect).searchParams.get("error"), "invalid_request");

    const plain = await validateAuthorizationRequest(
      authorizationParams(body.client_id, challenge, { code_challenge_method: "plain" })
    );
    assert.ok(!plain.ok && "redirect" in plain);

    const otherResource = await validateAuthorizationRequest(
      authorizationParams(body.client_id, challenge, { resource: "https://evil.example/api/mcp" })
    );
    assert.ok(!otherResource.ok && "redirect" in otherResource);
    assert.equal(new URL(otherResource.redirect).searchParams.get("error"), "invalid_target");
  });

  test("denying sends access_denied; approving needs a workspace of the user", async () => {
    const { workspace, owner } = await createApiTestWorkspace("oauth-deny");
    const other = await createApiTestWorkspace("oauth-other");
    const { body } = await register({ redirect_uris: [REDIRECT_URI], token_endpoint_auth_method: "none" });
    const { challenge } = pkce();

    const denied = await decideAuthorization(owner.id, authorizationParams(body.client_id, challenge), {
      approve: false
    });
    assert.ok(denied.ok);
    assert.equal(new URL(denied.redirect).searchParams.get("error"), "access_denied");
    assert.equal(new URL(denied.redirect).searchParams.get("state"), "state-123");

    const foreign = await decideAuthorization(owner.id, authorizationParams(body.client_id, challenge), {
      approve: true,
      workspaceId: other.workspace.id,
      access: "read-write"
    });
    assert.deepEqual(foreign, { ok: false, show: "workspace-not-found" });
    assert.equal((await listConnectedApps(owner.id)).length, 0);

    assert.ok(workspace.id);
  });

  test("code exchange with PKCE, MCP as the user, refresh rotation and disconnect", async () => {
    const { workspace, owner } = await createApiTestWorkspace("oauth-flow");
    const { clientId, verifier, code } = await approve(owner.id, workspace.id, "read-only");

    // A wrong verifier fails — and burns the code.
    const wrong = await token({
      grant_type: "authorization_code",
      code,
      redirect_uri: REDIRECT_URI,
      client_id: clientId,
      code_verifier: pkce().verifier
    });
    assert.equal(wrong.status, 400);
    assert.equal(wrong.body.error, "invalid_grant");

    const burnt = await token({
      grant_type: "authorization_code",
      code,
      redirect_uri: REDIRECT_URI,
      client_id: clientId,
      code_verifier: verifier
    });
    assert.equal(burnt.body.error, "invalid_grant");

    const second = await approve(owner.id, workspace.id, "read-only", clientId);

    const wrongRedirect = await token({
      grant_type: "authorization_code",
      code: second.code,
      redirect_uri: "https://claude.ai/other",
      client_id: clientId,
      code_verifier: second.verifier
    });
    assert.equal(wrongRedirect.body.error, "invalid_grant");

    const third = await approve(owner.id, workspace.id, "read-only", clientId);
    const issued = await token({
      grant_type: "authorization_code",
      code: third.code,
      redirect_uri: REDIRECT_URI,
      client_id: clientId,
      code_verifier: third.verifier,
      resource: urls.resource
    });

    assert.equal(issued.status, 200, JSON.stringify(issued.body));
    assert.equal(issued.body.token_type, "Bearer");
    assert.match(issued.body.access_token, /^osoat_/);
    assert.match(issued.body.refresh_token, /^osort_/);

    const reused = await token({
      grant_type: "authorization_code",
      code: third.code,
      redirect_uri: REDIRECT_URI,
      client_id: clientId,
      code_verifier: third.verifier
    });
    assert.equal(reused.body.error, "invalid_grant", "a code works once");

    // MCP as the approving user, in the approved workspace, read-only.
    const client = await connectMcp(issued.body.access_token);
    const whoami = await client.callTool({ name: "whoami", arguments: {} });
    const structured = whoami.structuredContent as {
      user: { id: string };
      workspace: { id: string };
      permissions: string[];
    };

    assert.equal(structured.user.id, owner.id);
    assert.equal(structured.workspace.id, workspace.id);
    assert.ok(structured.permissions.length > 0);
    assert.ok(structured.permissions.every((key) => key.endsWith(":read")));
    await client.close();

    // The REST API does not take connector tokens.
    const rest = await meGet(new Request(`${base}/api/v1/me`, { headers: bearer(issued.body.access_token) }));
    assert.equal(rest.status, 401);

    // Refresh rotates: the new pair works, the old pair does not.
    const refreshed = await token({
      grant_type: "refresh_token",
      refresh_token: issued.body.refresh_token,
      client_id: clientId
    });
    assert.equal(refreshed.status, 200, JSON.stringify(refreshed.body));
    assert.notEqual(refreshed.body.access_token, issued.body.access_token);

    const replayed = await token({
      grant_type: "refresh_token",
      refresh_token: issued.body.refresh_token,
      client_id: clientId
    });
    assert.equal(replayed.body.error, "invalid_grant");
    assert.equal((await mcpStatus(issued.body.access_token)).status, 401);
    assert.equal((await mcpStatus(refreshed.body.access_token)).status, 200);

    // Settings → Connected apps lists it; disconnecting refuses the next call.
    const apps = await listConnectedApps(owner.id);

    assert.equal(apps.length, 1);
    assert.equal(apps[0].name, "Claude");
    assert.equal(apps[0].workspace.id, workspace.id);
    assert.equal(apps[0].access, "read-only");
    assert.equal(apps[0].redirectHost, "claude.ai");
    assert.ok(apps[0].lastUsedAt, "use is recorded");

    await assert.rejects(disconnectConnectedApp(owner.id, "not-a-grant"));
    await disconnectConnectedApp(owner.id, apps[0].id);

    const after = await mcpStatus(refreshed.body.access_token);

    assert.equal(after.status, 401);
    assert.match(after.headers.get("www-authenticate") ?? "", /error="invalid_token"/);
    assert.equal(
      (await token({ grant_type: "refresh_token", refresh_token: refreshed.body.refresh_token, client_id: clientId }))
        .body.error,
      "invalid_grant"
    );
    assert.equal((await listConnectedApps(owner.id)).length, 0);
  });

  test("a confidential client must authenticate at the token endpoint", async () => {
    const { workspace, owner } = await createApiTestWorkspace("oauth-secret");
    const registered = await register({ redirect_uris: [REDIRECT_URI], client_name: "Secret app" });
    const { clientId, verifier, code } = await approve(owner.id, workspace.id, "read-write", registered.body.client_id);
    const form = {
      grant_type: "authorization_code",
      code,
      redirect_uri: REDIRECT_URI,
      code_verifier: verifier
    };

    const missing = await token({ ...form, client_id: clientId });
    assert.equal(missing.status, 401);
    assert.equal(missing.body.error, "invalid_client");

    const wrongSecret = await token({ ...form, client_id: clientId, client_secret: "osocs_wrong" });
    assert.equal(wrongSecret.status, 401);

    const basic = Buffer.from(`${clientId}:${registered.body.client_secret}`).toString("base64");
    const ok = await token(form, { authorization: `Basic ${basic}` });

    assert.equal(ok.status, 200, JSON.stringify(ok.body));

    // read-write: write permissions too, never more than the user's roles.
    const client = await connectMcp(ok.body.access_token);
    const whoami = await client.callTool({ name: "whoami", arguments: {} });
    const permissions = (whoami.structuredContent as { permissions: string[] }).permissions;

    assert.ok(permissions.some((key) => key.endsWith(":write")));
    assert.ok(!permissions.includes("admin"));
    await client.close();

    // Revocation (RFC 7009) ends the pair.
    const revoked = await revokePost(
      new Request(urls.revocationEndpoint, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded", authorization: `Basic ${basic}` },
        body: new URLSearchParams({ token: ok.body.refresh_token }).toString()
      })
    );
    assert.equal(revoked.status, 200);
    assert.equal((await mcpStatus(ok.body.access_token)).status, 401);
  });

  test("re-approval moves the grant and ends earlier tokens; archived workspaces and lost membership refuse", async () => {
    const first = await createApiTestWorkspace("oauth-move-a");
    const owner = first.owner;
    const second = await createApiTestWorkspace("oauth-move-b");
    const ownerRole = await prisma.role.findFirstOrThrow({
      where: { workspaceId: second.workspace.id, name: "owner" }
    });

    await prisma.workspaceMember.create({
      data: { userId: owner.id, workspaceId: second.workspace.id, roles: { create: { roleId: ownerRole.id } } }
    });

    const a = await approve(owner.id, first.workspace.id);
    const tokensA = await token({
      grant_type: "authorization_code",
      code: a.code,
      redirect_uri: REDIRECT_URI,
      client_id: a.clientId,
      code_verifier: a.verifier
    });
    assert.equal((await mcpStatus(tokensA.body.access_token)).status, 200);

    const b = await approve(owner.id, second.workspace.id, "read-only", a.clientId);
    assert.equal((await mcpStatus(tokensA.body.access_token)).status, 401, "earlier tokens end");

    const tokensB = await token({
      grant_type: "authorization_code",
      code: b.code,
      redirect_uri: REDIRECT_URI,
      client_id: b.clientId,
      code_verifier: b.verifier
    });
    const apps = await listConnectedApps(owner.id);

    assert.equal(apps.length, 1);
    assert.equal(apps[0].workspace.id, second.workspace.id);

    await prisma.workspace.update({ where: { id: second.workspace.id }, data: { archivedAt: new Date() } });
    assert.equal((await mcpStatus(tokensB.body.access_token)).status, 401);

    await prisma.workspace.update({ where: { id: second.workspace.id }, data: { archivedAt: null } });
    assert.equal((await mcpStatus(tokensB.body.access_token)).status, 200);

    await prisma.workspaceMember.deleteMany({ where: { userId: owner.id, workspaceId: second.workspace.id } });
    assert.equal((await mcpStatus(tokensB.body.access_token)).status, 401);
  });

  test("personal API tokens keep working on /api/mcp", async () => {
    const { workspace, owner } = await createApiTestWorkspace("oauth-pat");
    const { value } = await createTestToken(owner.id, workspace.id, { access: "read-only" });

    assert.equal((await mcpStatus(value)).status, 200);
  });

  test("the consent answer refuses a cross-site post", async () => {
    const form = new FormData();
    form.set("decision", "approve");

    const crossSite = await consentPost(
      new Request(`${base}/api/oauth/authorize`, {
        method: "POST",
        headers: { origin: "https://evil.example" },
        body: form
      })
    );
    assert.equal(crossSite.status, 403);

    const noOrigin = await consentPost(
      new Request(`${base}/api/oauth/authorize`, { method: "POST", body: form })
    );
    assert.equal(noOrigin.status, 403);
  });
});
