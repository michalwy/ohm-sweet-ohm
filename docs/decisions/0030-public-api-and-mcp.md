# ADR 0030 — Public API and MCP Server

**Status:** Accepted
**Date:** 2026-11-24

Decided by the owner on 2026-11-24 in the project conversation, recorded in the *Public API and
MCP* milestone (tracking #79, issues #270–#287) and written down here by #270. Every decision below
is the owner's unless it is marked as this ADR's reading.

## Context

Until now everything OhmSweetOhm can do is reachable only from its own UI: the app's server-side
surface is Next.js server actions (`"use server"`), authenticated by a Better Auth cookie session and
authorized per workspace (ADR 0005, ADR 0006). The owner wants the workshop to be usable by programs
and, first of all, by AI agents through the Model Context Protocol (MCP) — reading the inventory,
planning purchases and builds, recording what happened — without going through the browser.

The existing layering already separates the parts that matter: each `*Actions.ts` file resolves the
current user and workspace from the cookie session, checks one permission key, and calls a domain
function that takes a `workspaceId`. What is missing is a way to authenticate a request without a
browser session, a machine-readable description of each operation's input and output, and the HTTP
and MCP endpoints themselves.

## Decision

### Interface

- **REST + JSON under `/api/v1`**, described by an **OpenAPI 3.1** document generated from zod
  schemas (the owner, 2026-11-24).
- **MCP over Streamable HTTP at `/api/mcp`**, served by the Next.js app itself — the same container,
  on the Pi. There is no separate stdio server (the owner, 2026-11-24); a stdio-only client reaches
  it through a bridge such as `mcp-remote`.
- **The MCP endpoint is stateless** (#275's reading): each POST carries its own bearer token and is
  answered as plain JSON by a server built for that request; there is no MCP session id and no
  server-to-client SSE stream (`GET` and `DELETE` answer 405, as the Streamable HTTP specification
  allows). Every call therefore re-checks the token, and the single app process keeps no session
  state. Server-initiated messages (progress, sampling) would need sessions and are a later issue's.
- **Both are served on the app's public HTTPS URL**, behind the operator's existing reverse proxy,
  and protected by tokens (the owner, 2026-11-24).

### One service layer

- REST endpoints and MCP tools are two adapters over **one shared service layer** — the same domain
  functions the server actions call. Each area issue delivers its REST endpoints **and** its MCP
  tools together; **MCP is the priority** (the owner, 2026-11-24).
- Authorization works the same for every caller: one server-side entry point resolves **who is
  acting, in which workspace, with which permissions**, from either a Better Auth session (with a
  workspace slug) or a verified API token (bound to its workspace), and every permission check uses
  it (#271).
- Each operation's input and output are defined **once**, as zod schemas; from them the server
  validates input and derives the JSON Schema used by the OpenAPI document and by MCP tool
  definitions. Validation errors map to one error shape usable by both REST and MCP (#272).

### Authentication and permissions

- **Personal access tokens, per user**, each bound to **one workspace** and to a **permission set**:
  read-only, read-write, or a custom subset of the workspace permission keys (the owner,
  2026-11-24).
- **Effective rights are the token's set intersected with the user's roles in that workspace**, so
  a token can never do more than its user, and losing a role takes effect on the next request (the
  owner, 2026-11-24).
- Tokens are **hashed at rest** and **revocable** (the owner, 2026-11-24). A token records its
  last-used time.
- **OAuth is out of scope** for this milestone (the owner, 2026-11-24). *Amended 2026-11-27 by
  [ADR 0031](0031-oauth-for-the-mcp-connector.md): the MCP server also accepts OAuth 2.1 access
  tokens from connected apps such as a claude.ai custom connector (#322).*

### What is exposed

- **Everything the UI can do**, reads and writes including deletes (the owner, 2026-11-24),
  **except**:
  - resetting a workspace to the demo preset;
  - scheduled workspace deletion;
  - sign-up, sign-in and sign-out;
  - DigiKey and TME credential changes.
- **DigiKey and TME credentials are never readable or settable** through the API or MCP (the owner,
  2026-11-24).
- **Supplier search through the API and MCP is allowed, with the same payloads the UI sends** (the
  owner, 2026-11-24; the guardrail decision is recorded in #285).
- **MCP tools are per resource and per domain verb**: list / get / create / update / delete, plus
  verbs such as receiving a purchase order. UI-only helpers — dialog data, filter options, "next
  number" previews — are not exposed as tools unless an agent needs them to complete a task (the
  owner, 2026-11-24).

### Versioning

- The REST API is versioned in its path: `/api/v1`. **Additive changes need no bump; a breaking
  change means `/api/v2`** (the owner, 2026-11-24).
- **MCP tool names are stable** (the owner, 2026-11-24): a tool is not renamed; a replacement is a
  new tool.

### Not in this milestone

An audit log (beyond a token's last-used time), rate limiting, members and roles management, and
webhooks (the owner, 2026-11-24).

### Libraries

- **zod** (`zod`, version 4, latest stable at adoption) for input and output schemas. Zod 4
  generates JSON Schema natively (`z.toJSONSchema`), which is the schema dialect of both OpenAPI 3.1
  and MCP tool definitions, so no separate schema-conversion library is adopted.
- **The official MCP TypeScript SDK** (`@modelcontextprotocol/sdk`, latest stable at adoption) for
  the MCP server and its Streamable HTTP transport. It accepts zod schemas for tool definitions
  directly.
- **`@seriousme/openapi-schema-validator`**, a development dependency only, validates the generated
  document against the OpenAPI 3.1 schema in a unit test (#274's reading: the *Done when* asks for
  that validation, and a hand-written check would test only what it thought of).
- Both are added by the issue that first needs them (#272 for zod, the MCP foundation issue for the
  SDK), at their latest stable versions then, and kept current by Renovate like every dependency.

## Consequences

- The cookie session stops being the only way into the server: every server-side read and mutation
  has to authorize through the shared actor entry point, so a check written against the session
  directly would be a hole for token callers. `docs/agents/architecture.md` states the rule.
- Each area's operations gain schemas and a REST and MCP adapter; the server actions stay the UI's
  path and call the same service functions, so the UI and the API cannot drift apart in behavior.
- A token is a new credential that reaches the Pi from the public URL. Its safety rests on hashing,
  revocation, the workspace binding and the intersection with the user's roles; there is no rate
  limiting yet.
- MCP clients that only speak stdio need a bridge, and clients that accept only OAuth cannot connect
  until an OAuth issue lands.

## Alternatives considered

- **tRPC.** Rejected by the owner: it suits a TypeScript client built alongside the server, not
  third-party clients and agents, and it gives no standard API description.
- **GraphQL.** Rejected by the owner: a second query layer and schema to maintain for a single-user
  workshop app, with no client that needs it.
- **OAuth 2.1 now.** Deferred by the owner: personal access tokens cover the API and MCP clients the
  owner uses; OAuth is a later issue and its own guardrail decision.
- **A separate stdio MCP server.** Rejected by the owner: one more package and process to ship and
  keep in step with the app; Streamable HTTP inside the app reuses its deployment, authentication and
  service layer.
