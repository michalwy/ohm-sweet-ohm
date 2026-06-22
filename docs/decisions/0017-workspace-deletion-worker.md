# ADR 0017 — Workspace Deletion Worker

## Status

Accepted

## Context

Permanent deletion of a workspace requires cascading through all workspace-scoped data (parts, inventory entries, purchase orders, shopping lists, organizations, attributes, storage locations, roles, and integration configuration). Running this inline in an HTTP request handler risks timeouts and keeps the UI blocked for the duration.

Two future callers need the same deletion path:
- Issue #55: manual permanent deletion triggered by an admin
- Issue #72: automatic retention-based deletion after an archived workspace ages past a configurable threshold

A shared background worker provides a single authoritative implementation of the cascade logic and decouples the callers from the execution.

## Decision

Use **pg-boss** as the job queue for workspace deletion jobs, backed by PostgreSQL.

The worker runs as a **separate Docker Compose service** (`worker`) that shares the same image as the application service. It polls pg-boss for pending `workspace-deletion` jobs and executes each one by calling `prisma.workspace.delete()`, which cascades all workspace-scoped entities at the database level via the existing `ON DELETE CASCADE` foreign key constraints.

A `deletionScheduledAt` timestamp is added to the `Workspace` model. Setting this field signals that a workspace is queued for deletion; the UI reflects this as "Deletion in progress" and hides the Restore button.

### Why pg-boss over a raw polling table

- PostgreSQL-native: no additional infrastructure (no Redis, no broker)
- Handles advisory locking, at-least-once delivery, retries, and job visibility out of the box
- Minimal dependency footprint — `pg` is already in the project

### Cascade deletion approach

`prisma.workspace.delete()` issues a single `DELETE FROM "Workspace" WHERE id = $1`. All 24+ workspace-scoped tables carry `ON DELETE CASCADE` on their `workspaceId` foreign key, so the database cascades the deletion automatically and atomically.

### Enqueue-first ordering

`enqueueWorkspaceDeletion` enqueues the pg-boss job before stamping `deletionScheduledAt`. This ensures that if the stamp fails, the worker's safety guard (it checks `deletionScheduledAt != null` before deleting) prevents execution. If the enqueue fails, no visible state change occurs.

### Idempotency

- `enqueueWorkspaceDeletion`: returns early if `deletionScheduledAt` is already set — does not enqueue a second job.
- `executeWorkspaceDeletion`: returns early if the workspace no longer exists, or if `deletionScheduledAt` is null.

## Consequences

- **New npm dependency**: `pg-boss` is added as a production dependency. pg-boss creates its own schema tables in the application's PostgreSQL database on first start.
- **New Docker Compose service**: the `worker` service runs alongside `app` in `docker-compose.yml` and `docker-compose.dev.yml`. Both services build from the same Dockerfile.
- **New Prisma field**: `Workspace.deletionScheduledAt DateTime?` with a corresponding migration.
- **Schema for new entities**: when adding new workspace-scoped entity types, include them in the cascade by ensuring their `workspaceId` FK carries `onDelete: Cascade` in the Prisma schema. The worker needs no code changes as long as the DB constraint is correct.
- **Queue must be created before use**: callers must call `boss.createQueue(WORKSPACE_DELETION_JOB)` (idempotent) before `boss.send()`. This is done in `enqueueWorkspaceDeletion` and in the worker startup.

## References

- ADR 0016 — Workspace Archiving (prerequisite: workspaces must be archived before deletion)
- Issue #55 — Manual permanent deletion of archived workspaces
- Issue #72 — Automatic retention-based deletion
- Issue #74 — This worker (the issue being closed by this ADR)
