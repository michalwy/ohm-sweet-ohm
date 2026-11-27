import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { isWellFormedApiToken } from "../../src/server/api-tokens/apiTokenValue";
import {
  OAUTH_ACCESS_TOKEN_PREFIX,
  OAUTH_REFRESH_TOKEN_PREFIX,
  authorizationServerMetadata,
  buildClientRedirect,
  generateOAuthValue,
  isAcceptedResource,
  isAllowedRedirectUri,
  isWellFormedOAuthValue,
  oauthUrls,
  pkceS256Challenge,
  protectedResourceMetadata,
  safeOAuthNextPath,
  verifyPkce
} from "../../src/server/oauth/oauthValues";

describe("OAuth values (#322)", () => {
  test("generated values are well formed for their own prefix only, and never API tokens", () => {
    const access = generateOAuthValue(OAUTH_ACCESS_TOKEN_PREFIX);

    assert.ok(isWellFormedOAuthValue(access, OAUTH_ACCESS_TOKEN_PREFIX));
    assert.ok(!isWellFormedOAuthValue(access, OAUTH_REFRESH_TOKEN_PREFIX));
    assert.ok(!isWellFormedApiToken(access));
    assert.ok(!isWellFormedOAuthValue(`${access}x`, OAUTH_ACCESS_TOKEN_PREFIX));
    assert.notEqual(access, generateOAuthValue(OAUTH_ACCESS_TOKEN_PREFIX));
  });

  test("PKCE S256 matches the RFC 7636 example and refuses anything else", () => {
    const verifier = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk";
    const challenge = "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM";

    assert.equal(pkceS256Challenge(verifier), challenge);
    assert.ok(verifyPkce(verifier, challenge));
    assert.ok(!verifyPkce(`${verifier.slice(0, -1)}Y`, challenge));
    assert.ok(!verifyPkce(challenge, challenge), "plain is not accepted");
    assert.ok(!verifyPkce("short", pkceS256Challenge("short")), "a verifier under 43 characters is refused");
  });

  test("redirect URIs: https, or http on loopback; no fragments or userinfo", () => {
    assert.ok(isAllowedRedirectUri("https://claude.ai/api/mcp/auth_callback"));
    assert.ok(isAllowedRedirectUri("http://localhost:6274/oauth/callback"));
    assert.ok(isAllowedRedirectUri("http://127.0.0.1:33418/callback"));
    assert.ok(!isAllowedRedirectUri("http://claude.ai/callback"));
    assert.ok(!isAllowedRedirectUri("https://claude.ai/callback#x"));
    assert.ok(!isAllowedRedirectUri("https://user:pw@claude.ai/callback"));
    assert.ok(!isAllowedRedirectUri("javascript:alert(1)"));
    assert.ok(!isAllowedRedirectUri("not a url"));
  });

  test("metadata is built from the public URL", () => {
    const base = "https://oso.example.com/";
    const urls = oauthUrls(base);
    const server = authorizationServerMetadata(base);
    const resource = protectedResourceMetadata(base);

    assert.equal(urls.resource, "https://oso.example.com/api/mcp");
    assert.equal(server.issuer, "https://oso.example.com");
    assert.equal(server.authorization_endpoint, "https://oso.example.com/oauth/authorize");
    assert.equal(server.registration_endpoint, "https://oso.example.com/api/oauth/register");
    assert.deepEqual(server.code_challenge_methods_supported, ["S256"]);
    assert.equal(resource.resource, "https://oso.example.com/api/mcp");
    assert.deepEqual(resource.authorization_servers, ["https://oso.example.com"]);
  });

  test("the resource parameter must name this MCP server", () => {
    const base = "https://oso.example.com";

    assert.ok(isAcceptedResource(undefined, base));
    assert.ok(isAcceptedResource("https://oso.example.com/api/mcp", base));
    assert.ok(isAcceptedResource("https://oso.example.com/api/mcp/", base));
    assert.ok(isAcceptedResource("https://oso.example.com", base));
    assert.ok(!isAcceptedResource("https://evil.example.com/api/mcp", base));
  });

  test("the client redirect keeps the registered URI's query and adds only set values", () => {
    const url = new URL(
      buildClientRedirect("https://app.example/cb?x=1", { code: "c", state: null, iss: "https://oso" })
    );

    assert.equal(url.searchParams.get("x"), "1");
    assert.equal(url.searchParams.get("code"), "c");
    assert.equal(url.searchParams.has("state"), false);
    assert.equal(url.searchParams.get("iss"), "https://oso");
  });

  test("the sign-in next target is only an authorization request of this app", () => {
    assert.equal(safeOAuthNextPath("/oauth/authorize?client_id=a"), "/oauth/authorize?client_id=a");
    assert.equal(safeOAuthNextPath("https://evil.example/oauth/authorize?x"), null);
    assert.equal(safeOAuthNextPath("//evil.example/oauth/authorize?x"), null);
    assert.equal(safeOAuthNextPath("/w/x/parts"), null);
    assert.equal(safeOAuthNextPath("/oauth/authorize?\\evil"), null);
    assert.equal(safeOAuthNextPath(undefined), null);
  });
});
