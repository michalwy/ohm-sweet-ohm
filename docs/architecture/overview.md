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
- Purchases workflow: shopping lists (informal, no supplier, no status) and purchase orders (per-supplier, DRAFT → ORDERED → RECEIVED, with automatic RECEIPT inventory entry on receive).
- Designs: workspace-scoped entities that represent build recipes. Each Design owns an output Part linked via `Design.outputPartId`; the output part is created under a per-workspace internal manufacturer organization (`Organization.isInternal = true`) that is hidden from user-facing queries. Designs maintain an immutable revision history (`DesignRevision`); revision notes are editable. Each revision holds a bill of materials of `BomLineItem` specs (designator range + derived quantity, optional category scope, optional pinned part) with `BomMatcher` attribute matchers; parts are resolved against live inventory by attribute comparison rather than fixed references (see ADR 0020).
- Builds: workspace-scoped production runs of a `DesignRevision` for a target quantity (see ADR 0021, ADR 0023, ADR 0024, ADR 0025). A `Build` freezes the revision's BOM into `BuildLineItem` snapshots; each line's editable allocation plan is a set of `BuildLineAllocation` entries (part + source location + quantity, possibly split across several parts). An entry's `sourceLocationId` may be null, meaning it plans against incoming stock (`onOrderQty`/`inProductionQty`) rather than on-hand stock (ADR 0025, #185) — such an entry always keeps its line from being start-ready. At `startBuild` the plan is distributed into `BuildDesignatorAssignment` rows at a per-(designator × physical unit) grain — one row per unit of the build's target quantity per designator, each naming a concrete part/location and an `assembled` boolean. The build advances through `allocating → started → in_progress → completed`, plus `cancelled` — `allocating` merges the old `created`/`allocated` states into one continuously-editable phase (ADR 0025); there is no separate "allocate"/"reopen" transition. Stock side-effects are denormalized onto `Part.allocatedQty` (soft) and `Part.reservedQty` (hard; `available = currentStock − reservedQty`); `allocatedQty` is maintained live as allocation entries are saved, not applied in bulk. Assembling a unit's designator issues stock from its source location via the shared inventory primitive, and completion receives the output part once every unit's every designator is assembled. The output part's `Part.inProductionQty` (ADR 0021, #184) is likewise denormalized: it holds the sum of `targetQuantity` across that part's builds currently in `started`/`in_progress`, purely informational like `onOrderQty`/`plannedQty`. An `allocating` build (not yet a hard reservation) contributes its `targetQuantity` to the output part's existing `plannedQty` instead, live from creation, moving over to `inProductionQty` once the build starts.
- Browser-level e2e coverage for authentication and core workspace/parts/category flows.

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
