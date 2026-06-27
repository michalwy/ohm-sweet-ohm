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
- Designs: workspace-scoped entities that represent build recipes. Each Design owns an output Part linked via `Design.outputPartId`; the output part is created under a per-workspace internal manufacturer organization (`Organization.isInternal = true`) that is hidden from user-facing queries. Designs maintain an immutable revision history (`DesignRevision`); revision notes are editable.
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
