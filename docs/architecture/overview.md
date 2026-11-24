# Architecture Overview

## Current State

This repository contains a Next.js App Router application with TypeScript, Tailwind CSS, Prisma, PostgreSQL, Better Auth authentication, workspace routing, workspace-scoped access control, parts, part categories, attributes, units, storage locations, stock movements, supplier integration settings, shopping lists, and purchase orders.

The project is no longer only a scaffold. Core architecture now includes:

- Global users with workspace memberships.
- Workspace-scoped domain data using internal `workspaceId` values.
- Public workspace routes under `/w/[workspaceSlug]/...`.
- Permission-based server-side authorization with an `admin` wildcard permission.
- Prisma migrations for authentication, workspace access control, parts, categories, attributes, units, locations, inventory entries, supplier settings, and purchases workflow.
- Transaction-safe inventory stock validation for issue, transfer, and negative adjustment writes.
- Storage-location lifecycle guard that blocks archiving locations with non-zero stock balances.
- Storage-location generator (#127): `src/lib/locationGenerator.ts` expands per-level counter definitions into a plan and matches it against existing locations by normalized sibling name; the dialog uses it for a live preview and `generateStorageLocations` (`src/server/inventory/locationMutations.ts`) re-runs it inside one transaction, reusing existing locations and inserting the new ones one level at a time (at most 1,000 per run).
- Per-location stock read (`src/server/inventory/locationStock.ts`): non-zero balances per part at a location, optionally across its whole subtree, computed from `InventoryEntry` history with the same movement semantics as the per-part balances, and available = balance − hard reservations held at that location.
- Purchases workflow: shopping lists (informal, no supplier, no status) and purchase orders (per-supplier, DRAFT → ORDERED → RECEIVED, with automatic RECEIPT inventory entry on receive).
- Designs: workspace-scoped entities that represent build recipes. Each Design owns an output Part linked via `Design.outputPartId`; the output part is created under a per-workspace internal manufacturer organization (`Organization.isInternal = true`) that is hidden from user-facing queries. Designs maintain an immutable revision history (`DesignRevision`); revision notes are editable. Each revision holds a bill of materials of `BomLineItem` specs (designator range + derived quantity, optional category scope, optional pinned part) with `BomMatcher` attribute matchers; parts are resolved against live inventory by attribute comparison rather than fixed references (see ADR 0020).
- Builds: workspace-scoped production runs of a `DesignRevision` for a target quantity (see ADR 0021, ADR 0023, ADR 0024, ADR 0025). A `Build` freezes the revision's BOM into `BuildLineItem` snapshots; each line's editable allocation plan is a set of `BuildLineAllocation` entries (part + source location + quantity, possibly split across several parts). An entry's `sourceLocationId` may be null, meaning it plans against incoming stock (`onOrderQty`/`inProductionQty`) rather than on-hand stock (ADR 0025, #185) — such an entry always keeps its line from being start-ready. At `startBuild` the plan is distributed into `BuildDesignatorAssignment` rows at a per-(designator × physical unit) grain — one row per unit of the build's target quantity per designator, each naming a concrete part/location and an `assembled` boolean. The build advances through `allocating → started → in_progress → completed`, plus `cancelled` — `allocating` merges the old `created`/`allocated` states into one continuously-editable phase (ADR 0025); there is no separate "allocate"/"reopen" transition. Stock side-effects are denormalized onto `Part.allocatedQty` (soft) and `Part.reservedQty` (hard; `available = currentStock − reservedQty`); `allocatedQty` is maintained live as allocation entries are saved, not applied in bulk. Assembling a unit's designator issues stock from its source location via the shared inventory primitive, and completion receives the output part once every unit's every designator is assembled. The output part's `Part.inProductionQty` (ADR 0021, #184) is likewise denormalized: it holds the sum of `targetQuantity` across that part's builds currently in `started`/`in_progress`, purely informational like `onOrderQty`/`plannedQty`. An `allocating` build (not yet a hard reservation) contributes its `targetQuantity` to the output part's existing `plannedQty` instead, live from creation, moving over to `inProductionQty` once the build starts. `Part.balanceQty` (ADR 0026, #186) is a Postgres `GENERATED ALWAYS ... STORED` column — `(currentStock − reservedQty) + onOrderQty + inProductionQty − allocatedQty` — combining every one of those signals into one at-a-glance figure, same pattern as `availableQty` (#173): no independent write path, so no application code maintains it.
- Self-hosted deployment path (ADR 0022): CI publishes a multi-arch image (amd64 + arm64) to `ghcr.io/michalwy/ohm-sweet-ohm` on release tags (`v*`); `docker-compose.prod.yml` runs that prebuilt image against an operator-provided external PostgreSQL database; `scripts/install.sh` is a curl-able interactive installer. The release version is baked into the image via `OSO_VERSION` and exposed at runtime through `src/lib/version.ts`. **The owner's instance on the Raspberry Pi is deployed by a release** (ADR 0028): `.github/workflows/release.yml` tags, runs CI on the tag, publishes the Release and dispatches `.github/workflows/deploy.yml`, which runs `scripts/deploy.sh` on a self-hosted runner on the Pi in the existing installation — pull by digest, no-downgrade guard, pre-deploy `pg_dump`, `docker compose up -d` moving `app` and `worker` to the same digest, `app`'s health check plus `worker` running, and a rollback of both together. It is the only workflow allowed onto a self-hosted runner (`scripts/check-self-hosted-runners.mjs`, in `Unit tests`), and the runner's job-started hook refuses every other job. Runbook: `docs/deployment/pi-deploy.md`.
- E2E (browser-level) tests are currently paused; unit and integration tests are the active test layers.

## Public API and MCP

A public REST API under `/api/v1` (OpenAPI 3.1, generated from zod schemas) and an MCP server over
Streamable HTTP at `/api/mcp` are being added as two adapters over the same service layer the server
actions use, authenticated by per-user personal access tokens bound to one workspace and a permission
set. The design, what is exposed and what is not, is in
[ADR 0030](../decisions/0030-public-api-and-mcp.md) (milestone tracked in #79).

Personal API tokens (#273) are the `ApiToken` model: one user, one workspace, an access level
(`read-only`, `read-write` — resolved to permission keys when used — or `custom` with its own keys;
never `admin`), an optional expiry and a last-used time. Only the SHA-256 hash of a token value
(`oso_` + 32 random bytes, base64url) is stored, and revoking deletes the row. The domain code is
`src/server/api-tokens/`; `resolveTokenActor` turns a token into a `WorkspaceActor` and always
denies an archived workspace. Users manage their tokens at **Settings → API tokens**.

The foundations (#274, #275) are in `src/server/api/` and `src/server/mcp/`. An operation (zod
schemas plus permission, `*Operations.ts`) is bound to its service function by `implementOperation`;
`executeOperation` checks the permission on the actor, validates the input, runs it and checks the
output against its schema, for both adapters. The REST adapter (`restOperation`, route files under
`src/app/api/v1/`) authenticates the bearer token, reads a `GET` input from the query string and
other methods' from a JSON body, and answers `{ "error": { code, message, issues? } }` on failure
(401 token, 403 permission, 404 not in the workspace, 400 input, 409 state). `restEndpoints.ts`
lists the endpoints, and `/api/v1/openapi.json` is generated from it. The MCP server
(`src/app/api/mcp/route.ts`) is stateless: each POST is authenticated by its token and served by a
fresh SDK server whose tools — the registry in `src/server/mcp/tools.ts` — run as that token's actor;
a failure is a tool error carrying the same error object. The first endpoints are `GET /api/v1/me`,
`GET /api/v1/workspace` and the `whoami` tool.

MCP coverage (#276): `src/server/mcp/coverage.ts` maps every server action to its MCP tool, to an
exclusion with a reason, or to the area issue still pending; a unit test reads the `"use server"`
modules and fails on an action without an entry.

## Intended Shape

- `src/app`: Next.js App Router entry points and route-level UI.
- `src/lib`: shared application utilities.
- `src/server`: server-side application, authorization, workspace, authentication, and domain code.
- `prisma`: database schema and migrations.
- `docs`: product, architecture, development, and decision records.

## Boundaries To Preserve

- UI components should not accumulate domain rules.
- Database schema and permission changes should follow explicit product decisions and ADR-documented architecture.
- Workspace-scoped reads and mutations should authorize by internal workspace identity, not by public slug alone.
- User-facing strings should remain easy to localize.
- Local development and cloud deployment should both remain viable.
