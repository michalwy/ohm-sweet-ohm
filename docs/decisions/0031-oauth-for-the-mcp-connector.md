# ADR 0031 — OAuth 2.1 for the remote MCP connector

**Status:** Accepted
**Date:** 2026-11-27

The owner asked for this on 2026-11-27 (#322): the MCP server works as a claude.ai custom connector
over Streamable HTTP at `<public URL>/api/mcp`, with OAuth 2.1 — dynamic client registration, PKCE,
protected-resource and authorization-server metadata — tied to existing user accounts; users see and
disconnect connected apps in Settings; existing API tokens keep working. It is modelled on the
owner's other apps (Darkroom, Stamporama). This ADR amends ADR 0030, whose milestone left OAuth out
of scope. Everything else below is #322's reading, not the owner's.

## Decision

### An authorization server inside the app

The app is its own OAuth 2.1 authorization server and the MCP server its only protected resource,
both on the public URL (`BETTER_AUTH_URL`, the one public URL setting); there is no new secret and
no new setting.

| What | Where |
| --- | --- |
| Protected resource metadata (RFC 9728) | `/.well-known/oauth-protected-resource` and `/.well-known/oauth-protected-resource/api/mcp` |
| Authorization server metadata (RFC 8414) | `/.well-known/oauth-authorization-server` (issuer = the public URL) |
| Dynamic client registration (RFC 7591) | `POST /api/oauth/register` — anonymous |
| Authorization endpoint and consent | `GET /oauth/authorize` (a page); the answer is `POST /api/oauth/authorize` |
| Token endpoint | `POST /api/oauth/token` — `authorization_code`, `refresh_token` |
| Revocation (RFC 7009) | `POST /api/oauth/revoke` |

A 401 from `/api/mcp` carries `WWW-Authenticate: Bearer resource_metadata="…"`, so a client finds
everything from the MCP URL alone.

### Rules

- **PKCE with S256 is always required**, for public and confidential clients; `plain` is refused.
  Redirect URIs match exactly and must be `https`, or `http` on a loopback address.
- **A user always consents.** No code is issued without the signed-in user approving on the consent
  screen; the answer is a POST that must come from the app's own origin. A request whose client or
  redirect URI is unknown is shown as an error and never redirected.
- **A grant is bound to one workspace and an access preset** — read-only or read-write, the API
  token presets (#273) — chosen at consent. MCP tools act in one workspace (ADR 0030), so the grant
  needs one; the preset ∩ the user's roles is re-checked on every call through `resolveMemberActor`,
  exactly as for an API token. `admin` is never granted.
- **One grant per user and client**; approving again replaces it and ends the tokens issued under the
  earlier approval. **Disconnecting deletes the grant** with its codes and tokens.
- **Codes are single use and live 5 minutes; access tokens live 1 hour; refresh tokens 30 days and
  rotate** — a refresh token works once. Every credential (code, access and refresh token, client
  secret) is 256 random bits behind a prefix (`osoac_`, `osoat_`, `osort_`, `osocs_`; client ids
  `osoci_`), stored only as its SHA-256 hash.
- **OAuth access tokens open only `/api/mcp`**, the resource they were issued for; the REST API keeps
  accepting only personal API tokens. Personal API tokens keep working on both, unchanged.
- **Registration is open**, as claude.ai needs; a registered client can do nothing until a user
  approves it, and a client nobody approved within a day is removed at the next registration.

### Not adopted

- **Better Auth's `mcp` plugin** (built on its deprecated `oidc-provider`). It issues a code without
  asking the user unless the client sends `prompt=consent` — any site could then send a signed-in
  user through a client it registered and obtain a token — stores tokens in clear text, does not
  rotate refresh tokens, and has no notion of a workspace. Its replacement, `@better-auth/oauth-provider`,
  would be a new dependency built around OpenID Connect and JWTs this server does not need.
  The flow here is small enough to own and test in full.
- **Tools that take a workspace** (Darkroom's tools take a studio slug). That would change every
  tool of ADR 0030; binding the grant to one workspace keeps the tools as they are.
- **OpenID Connect** (ID tokens, userinfo). claude.ai's connector needs OAuth only.

## Consequences

- Four tables (`OAuthClient`, `OAuthGrant`, `OAuthAuthorizationCode`, `OAuthToken`); deleting a
  user, a workspace or a client deletes its grants and tokens.
- The connector needs the instance reachable from the internet over HTTPS with `BETTER_AUTH_URL`
  set to that address (`docs/user-guide/deployment.md`).
- Anonymous registration is a new unauthenticated write; there is no rate limiting yet (ADR 0030).
- Settings gains **Connected apps** (session-only, like API tokens).
