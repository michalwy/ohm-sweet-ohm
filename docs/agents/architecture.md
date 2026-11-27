# Architecture and domain model

The rules below are the working summary; the ADRs in `docs/decisions/` carry the decisions and
`docs/architecture/overview.md` the overall picture. When a rule here and an ADR disagree, the ADR is
the decision — fix this file.

## Stack

- TypeScript throughout application code.
- Next.js App Router conventions, with Next.js, React and TypeScript as the frontend direction unless
  a future ADR documents a reason to migrate (ADR 0002).
- Use the SPA-like workspace interaction model (ADR 0010): the App Router is the route/auth shell;
  prefer client-side queries and mutations for rich workspace lists, dialogs, inline editing and
  repeated list actions once those screens need responsive behavior. The stack for it is TanStack
  Query and TanStack Table; when adding or upgrading them, check the latest stable npm versions and do
  not pin older ones without a documented compatibility reason.
- Add browser interactivity with focused client components; do not make the whole app client-rendered
  by default.
- Prefer established React ecosystem libraries for complex tables, dialogs, forms, validation and
  accessible UI primitives when those needs become concrete.
- Keep domain logic out of UI components as the app grows, and prefer explicit module boundaries
  under `src/`.

## Access control and workspaces

- Workspace-scoped access control (ADR 0005): users are global, workspace data carries `workspaceId`,
  roles belong to workspaces, and the `admin` permission is a wildcard in authorization logic.
- Treat new domain resources as workspace-scoped by default: add `workspaceId` and scope server-side
  queries and mutations to the current workspace unless an explicit product decision says the
  resource is global.
- Keep authorization checks in server-side application/domain code, never in UI components. Protect
  every workspace-scoped server-side read and mutation with the appropriate permission; if no suitable
  permission exists, introduce an explicit permission key for that resource/action before exposing
  the behavior.
- **Authorize against the workspace actor** (ADR 0030, #271). `resolveWorkspaceActor`
  (`src/server/auth/currentActor.ts`) is the one entry point that says who is acting, in which
  workspace, with which permissions — from a Better Auth session plus a workspace slug, or from an
  API token bound to its workspace — and returns a `WorkspaceActor`
  (`src/server/access-control/actor.ts`). Its permissions are the user's roles for a session, and the
  token's set intersected with those roles for a token (`effectivePermissions.ts`). Every server
  action, and every REST endpoint and MCP tool after it, resolves the actor and checks the permission
  of the operation on it (`getAuthorizedSessionActor`, `requireActorPermission`,
  `actorHasPermission`) **before** calling a domain function; never read the session directly for
  authorization. Archived workspaces resolve to no actor unless the caller manages the workspace's
  own lifecycle (`allowArchived`). The `{ userId, workspaceId }` checks inside domain functions
  (`authorizeWorkspacePermission`, `hasWorkspacePermission`) are role-only defence in depth: they
  cannot see a token's narrower set, so they never replace the actor check.
- **A `"use server"` module exports only server actions.** Next.js publishes every exported async
  function of such a module as an action the browser can call directly, past any authorization its
  caller performs. An internal helper that a server action calls — one that takes a transaction or a
  `workspaceId` the caller has already authorized — lives in a module without the directive,
  marked `import "server-only"` (#291: `learnSupplierMatching` moved from
  `src/server/integrations/matching.ts` to `matchingLearning.ts`, its pure key helpers to
  `matchingKeys.ts`; #295: `updatePartValueSortNumber` moved from `createPart.ts` to
  `src/server/parts/partValueSort.ts`). `tests/unit/serverActionModules.test.ts` fails when a
  `"use server"` module exports a function that takes a transaction client.
- Authentication is Better Auth (ADR 0006); do not reintroduce development current-user shortcuts.
- Registration is closed by default (#323): `src/server/auth/registration.ts` is the one place that
  answers it (config default `OSO_AUTH_ALLOW_SIGN_UP=1` to open; the first account on an empty
  instance is always allowed; the admin panel's runtime setting, `InstanceSettings.registrationOpen`
  (#324), overrides the default when set). Enforced in a Better Auth
  `databaseHooks.user.create.before` hook, so the sign-up API refuses too, not only the page.
- **Instance administration (#324)** lives in `src/server/admin/`. The instance administrator is
  not a workspace role: `isInstanceAdmin` (`instanceAdmin.ts`) answers it — a user with
  `User.isInstanceAdmin`, or, while no account carries the flag, the oldest account
  (`instanceAdminPolicy.ts`; there is no UI to set the flag yet). Every admin page
  (`src/app/admin/`, `notFound()` otherwise), server action (`adminActionCore.ts`) and admin MCP tool
  checks it server-side before doing anything. The admin MCP tools (`adminMcpTools` in `tools.ts`)
  are listed only to an administrator, and each implementation checks again
  (`requireInstanceAdminActor`), plus `workspace:write` on the token for a tool that changes
  anything; their operations have `permission: null` because no workspace key describes them. No
  REST endpoints. Deletion is immediate and reuses `deleteWorkspaceRows`
  (`src/server/workspaces/deletionMutations.ts`), the scheduled deletion's own row order; "the
  user's data" is the workspaces they **solely own** (owner role, no other owner). Storage is
  measured in PostgreSQL (`adminStorage.ts`): row bytes per workspace across every table with
  `workspaceId` plus the listed child tables — a new child table without `workspaceId` must be added
  to `CHILD_TABLES` to be counted.
- Registration and routing (ADR 0007): sign-up creates only a global user; sign-in returns users to
  their last accessible workspace when remembered; users choose or create workspaces at
  `/workspaces`; workspace URLs use `/w/[workspaceSlug]/...`; slug resolution must still authorize by
  internal `workspaceId`.
- Archived workspaces (ADR 0016): workspaces have an `archivedAt` timestamp;
  `getCurrentUserWorkspaces()` returns only active ones; the shared layout at
  `src/app/w/[workspaceSlug]/layout.tsx` redirects archived workspace URLs to
  `/workspaces?notice=workspace-archived`; only admins may archive or restore, from Settings →
  General, the workspace picker or the API (#286); a workspace whose deletion is scheduled is not
  restored.

## Public API and MCP

[ADR 0030](../decisions/0030-public-api-and-mcp.md) is the design: REST + JSON under `/api/v1`
with an OpenAPI 3.1 document generated from zod schemas, and MCP over Streamable HTTP at `/api/mcp`
inside the app, both over **one service layer** shared with the server actions, both authenticated
by per-user personal access tokens bound to one workspace and a permission set (effective rights =
the token's set ∩ the user's roles). Each area issue delivers its REST endpoints and its MCP tools
together. Read the ADR's *What is exposed* list before exposing an operation: demo reset, scheduled
workspace deletion, sign-up/in/out and DigiKey/TME credentials are never exposed.

### Personal API tokens

`src/server/api-tokens/` (#273). `verifyApiToken` checks only the token — shape, SHA-256 hash,
expiry; the workspace checks (membership, archived workspace, intersection with the roles) are
`resolveTokenActor`'s, through the same `resolveMemberActor` sessions use, so there is one place that
says what a member may do. Rules:

- **The value exists once**, in `createApiToken`'s answer; nothing reads it back, and no listing or
  log carries it or its hash.
- **`admin` is never a token permission**: presets and custom sets hold named keys only;
  `resolveTokenActor` also ignores `allowArchived`, so a token of an archived workspace is refused.
  The `admin`-gated workspace operations the owner opened to the API (#286: settings, starter
  dictionaries, create, archive, restore — never demo reset or deletion) take the token's
  `workspace:write` **and** the user's `admin` role in the workspace acted on, read from the roles
  by `requireUserWorkspaceAdmin` (`src/server/workspaces/workspaceLifecycle.ts`); archive and
  restore act on any workspace of the user, by id, while the token stays bound to its own.
- **Presets are stored by name** (`read-only`, `read-write`) and resolved on use
  (`apiTokenPermissions.ts`), so a permission key added for a new area reaches existing tokens of
  that preset; a custom set is stored as keys.
- **Token management is session-only**: the actions in `apiTokenActions.ts` act for the signed-in
  user and are never exposed to token callers.

### Connected apps (OAuth, #322)

`src/server/oauth/`, [ADR 0031](../decisions/0031-oauth-for-the-mcp-connector.md). The app is the
OAuth 2.1 authorization server for its MCP server, so a claude.ai custom connector connects with a
sign-in instead of a pasted token. Rules:

- **A grant is an API token the user never sees**: bound to one workspace and the `read-only` or
  `read-write` preset, chosen on the consent screen; `resolveOAuthActor` resolves it through the same
  `resolveMemberActor`, reached from `resolveWorkspaceActor({ kind: "oauth" })`. MCP picks the kind
  by the token's prefix (`osoat_`); **REST never accepts an OAuth token**.
- **Consent is always asked**, and its answer (`POST /api/oauth/authorize`) must come from the app's
  own origin; `decideAuthorization` re-validates the whole request — never trust the form.
- **PKCE S256 always; exact redirect URIs; single-use codes; rotating refresh tokens**; every
  credential stored as a SHA-256 hash. Do not relax one of these to fit a client without an ADR.
- **The public URL is `BETTER_AUTH_URL`** (`getOAuthBaseUrl`); metadata and redirects are built from
  it, never from the request's `Host`.
- Connected apps are managed by the session's user only (`connectedAppActions.ts`, excluded from MCP
  coverage like API tokens).

### Operation schemas

Every operation the API and MCP expose is defined **once**, with zod (#272), in a pure module next to
its domain code (`src/server/<area>/<area>Operations.ts`; no `server-only`, no Prisma, so unit tests
can load it). `defineOperation` (`src/server/api/operations.ts`) takes:

- `name` — the MCP tool name: snake_case, verb first (`list_units`, `receive_purchase_order`);
  stable once released (ADR 0030), so a replacement is a new name;
- `description` — one sentence an agent can act on;
- `permission` — the permission key the operation needs, checked on the actor;
- `input` — a `z.object` of what the caller sends, **never the workspace** (it comes from the actor);
  list operations spread `listPageInputShape` and return `listPageOutputSchema(item)`
  (`src/server/api/listSchemas.ts`);
- `output` — what the operation returns.

Every field carries `.describe()`. Schemas stay within what JSON Schema can say — no transforms or
refinements whose meaning the generated schema would lose. From the definition:

- `parseOperationInput(operation, raw)` validates input and returns the data or the shared
  `OperationError` — `{ code: "invalid-input", message, issues: [{ path, code, message }] }` — the one
  error shape REST and MCP both return; other failures use the same shape with the domain's
  kebab-case error code;
- `getOperationJsonSchemas(operation)` gives the input and output JSON Schemas (draft 2020-12, the
  dialect of OpenAPI 3.1 and of MCP tool definitions), via zod 4's native `z.toJSONSchema`.

The server action for the same operation validates its input through the same schema (worked
example: `listUnitsOperation` and `getUnitsPageForWorkspace`), so the UI, REST and MCP accept the same
shapes. Each area issue converts its own operations; `parseActionInput(operation, raw)`
(`src/server/api/actionInput.ts`, #280) does it in one line and throws the `invalid-input` code as
the actions' domain errors are thrown. An action whose fields are named differently from the
operation's (`locationId` for `id`) maps them in the call; the schema strips the workspace slug.

`permission` is `null` only for an operation any authenticated actor may call — `whoami`, which
describes the caller — and for the instance administrator's `admin_…` operations (#324), whose
implementations check the administrator themselves. Everything else names a key.

### REST endpoints and MCP tools

An area exposes an operation in six steps (#274, #275, #276, #287):

1. **Implement it**: `implementOperation(operation, (actor, input) => …)` in a `server-only` module
   (`src/server/<area>/<area>Api.ts`; example `workspaceApi.ts`). The function scopes every read and
   write to `actor.workspace.id` and calls the same domain functions as the server action; it throws
   the domain's kebab-case error codes. Never check the permission there: `executeOperation`
   (`src/server/api/execute.ts`) does it, then validates the input, runs the function, and checks the
   result against the output schema (a mismatch is a 500, never a half-checked answer). The one
   exception is a second permission beyond the operation's own, which the function checks with
   `actorHasPermission` and throws as `permission-denied` (#283: `add_shortage_to_shopping_list`
   is `shopping-lists:write` and also reads the shortage, `designs:read`).
2. **REST**: a route file under `src/app/api/v1/<path>/route.ts` exporting
   `GET = restOperation(implementation)` (or `POST`, `PATCH`, `DELETE`), and an entry in
   `restEndpoints` (`src/server/api/restEndpoints.ts`), from which the OpenAPI document is built; a
   unit test checks every entry has its route file. `GET` input comes from the query string
   (`queryInput.ts` converts numbers and booleans where the schema expects them, and repeated keys
   for arrays); other methods take a JSON body. List endpoints are `GET` with
   `listPageInputShape` / `listPageOutputSchema`: `?cursor=<nextCursor>&pageSize=<n>`. A record is
   addressed by a path parameter (#279): the entry's path is `/organizations/{id}`, the route file
   `src/app/api/v1/organizations/[id]/route.ts`, and `restOperation` merges the route's params into
   the input (they win over a query or body field of the same name), so `id` stays an ordinary
   field of the operation's input — the MCP tool takes it as an argument — while the OpenAPI
   document describes it as a path parameter and leaves it out of the body. Updates are `PATCH`
   with every field but the id optional: an omitted field keeps its value, `null` clears it.
   A record the UI's dialog saves as a whole, and whose stored form cannot be turned back into
   the input (a BOM line's matchers keep parsed values, not what was typed), is replaced with
   `PUT` instead, every omitted field cleared (#283: `PUT /bom-lines/{lineItemId}`).
   Next.js needs one slug name per directory level, so a sub-resource of another area's record
   uses that area's segment name (#281: `GET /parts/{id}/shopping-lists` lives under
   `src/app/api/v1/parts/[id]/`, beside the parts area's own `[id]` route); a batch variant of a
   create is a static `…/batch` segment beside the dynamic one.
   A database constraint error is turned into the domain's code by `withDomainErrors`
   (`src/server/api/domainErrors.ts`, #278), never left as an `internal-error`.
3. **MCP**: `defineMcpTool(title, implementation, behavior)` appended to `mcpTools`
   (`src/server/mcp/tools.ts`). `behavior` is explicit — `{ readOnly: true }`, or
   `{ readOnly: false, destructive, idempotent? }` — and becomes the tool's annotations; a delete or
   overwrite is `destructive: true`. A tool that reaches outside the app (the supplier lookup, #285)
   adds `openWorld: true`.
4. **Integration tests** for the area's endpoints and tools.
5. **User guide**: add the area's row — or its endpoints and tools to an existing row — to the
   table under *What is available* in `docs/user-guide/api-and-mcp.md` (#287), with REST paths
   relative to `/api/v1`.
6. **Coverage** (#276): every exported function of a `"use server"` module has an entry in
   `src/server/mcp/coverage.ts` — `{ tool }` (the MCP tool doing the same thing), `{ excluded }` with
   a reason (the owner's exclusions of #79, or a UI-only helper no agent needs), or, until its area
   issue lands, `{ pending: "#NNN" }`. **A new server action needs an MCP tool or an exclusion
   entry**: `tests/unit/mcpCoverage.test.ts` fails on an action without an entry and on an entry
   without an action, and `tests/integration/api-mcp.test.ts` on a `tool` the registry does not
   offer. An area issue replaces its `pending` entries; the milestone is complete when none is left.
   Server actions are declared in modules, never inline (the check reports an inline `"use server"`).

Errors are one shape everywhere, `{ code, message, issues?, details? }` — `details` carries the
facts a caller needs to recover, from an error object's `details` (#282: `exchange-rate-unavailable`
names `from`, `to`, `date`): REST answers
`{ "error": … }` with the status from `errorStatus.ts` — 401 `unauthorized` (missing, malformed,
unknown, revoked or expired token, or archived workspace), 403 `permission-denied`, 404
`…-not-found` (a record of another workspace is *not found*, never *forbidden*), 400 `invalid-input`
/ `invalid-json` / `invalid-…` / `missing-…` / `…-required`, 502 `…-request-failed` (a supplier did not answer, #285), 409 any other domain code, 500
`internal-error` for anything that is not a domain code (its message is logged, never sent). MCP
returns the same object as a tool error (`isError`, JSON text). Both authenticate **only** a
`Authorization: Bearer` token (`bearer.ts`) through `resolveWorkspaceActor`; cookies are never read.
The MCP endpoint is stateless (ADR 0030): one SDK `Server` and transport per POST, bound to that
request's actor.

## Parts, organizations, categories, locations

- Manufacturers are workspace-scoped organizations with a `manufacturer` role, not a
  manufacturer-only table (ADR 0009). Do not infer supplier, buyer, purchase or pricing behavior from
  this model.
- Category attributes (ADR 0011): attributes are workspace-scoped dictionary records; category
  attachments/overrides define defaults, sort order and `isPrimary`; a category's `valueAttributeId`
  controls the parts-list Value column; all attributes are optional.
- A part form's effective attribute set is the primary category's attributes plus the secondary
  category's, deduplicated by attribute id. When an attribute appears in both, the primary category's
  configuration always wins. The parts-list Value column comes only from the primary category's
  effective `valueAttributeId`.
- Part attribute values survive category changes. Removing a local attribute attachment or changing a
  part's primary or secondary category must not delete existing `PartAttributeValue` records; if the
  attribute becomes effective for that part again, reuse the saved value.
- When a local category attribute attachment overrides an inherited one, detaching the local
  attachment reveals the inherited effective attribute instead of removing that attribute from the
  category.
- Archived locations (ADR 0013): a location can be archived only when stock is zero for every part;
  archived locations stay visible in stock read views and cannot be used in new stock movements.
- Default locations (#37, #39): a part's own `defaultLocationId` wins; a part with none falls back to
  the workspace's `Workspace.defaultLocationId` (Settings → Inventory). Both must name a non-archived
  location of the same workspace when set, and a location that either names cannot be deleted
  (`location-in-use`). Pickers resolve the preselection with `resolvePreselectedLocationId`
  (`src/lib/defaultLocation.ts`): the receive-order dialog and a build's output location.

## Lists at scale

Large workspace lists are expected to outgrow client-side full loading. Prefer cursor-backed endless
scrolling for parts and future large lists, built on shared list primitives rather than per-screen
endless-scroll code (see `ui.md`).
