# ADR 0018 — Workspace Retention Policy

**Status:** Accepted  
**Date:** 2026-06-23

## Context

Archived workspaces accumulate indefinitely without automatic cleanup. Issue #72 requests that archived workspaces be permanently deleted after a configurable retention window, while still allowing the admin to restore them within that window.

The workspace deletion worker (ADR 0017) and its pg-boss queue infrastructure are already in place. The `enqueueWorkspaceDeletion` function already accepts a `"retention-expiry"` trigger. The missing piece is the mechanism that discovers expired archived workspaces and enqueues them.

## Decision

### Retention period

A single system-wide retention period configured via the `WORKSPACE_RETENTION_DAYS` environment variable (default: 30 days). Read at runtime by `src/server/workspaces/retentionConfig.ts`.

**Per-workspace or per-user configurability was considered and rejected.** This is a solo-operated app and a system-wide default is sufficient. Adding a per-workspace DB field would require a settings UI and schema migration with no immediate benefit.

### Retention sweep

A new function `enqueueExpiredArchivedWorkspaces(boss)` in `src/server/workspaces/retentionSweep.ts` queries for workspaces where:
- `archivedAt IS NOT NULL AND archivedAt <= now - retentionDays`
- `deletionScheduledAt IS NULL` (not already enqueued)

For each matching workspace it calls `enqueueWorkspaceDeletion(id, "retention-expiry", boss)`, which sets `deletionScheduledAt` and sends a pg-boss job to the existing `workspace-deletion` queue.

### Scheduling

The sweep is scheduled as a daily pg-boss cron job (`"0 2 * * *"`, 02:00 UTC) registered in the existing deletion worker process (`scripts/workspace-deletion-worker.ts`). No separate cron container is needed — pg-boss persists the schedule in the database and fires it automatically.

### Safety invariants

The existing safety guards remain untouched:
- `enqueueWorkspaceDeletion` is idempotent: it exits early if `deletionScheduledAt` is already set.
- `executeWorkspaceDeletion` is a no-op if `deletionScheduledAt` is null, preventing accidental execution.

### Restoration window

A workspace can be restored at any time before the retention period expires (i.e., before the daily sweep sets `deletionScheduledAt`). Once `deletionScheduledAt` is set — either by the retention sweep or by a manual delete action — restoration is no longer possible, consistent with the behavior documented in ADR 0016.

### UI

The Workspaces page (`/workspaces`) shows the scheduled deletion deadline for each archived workspace as long as `deletionScheduledAt` is null. The deadline is computed client-side as `archivedAt + retentionDays`. The server passes `retentionDays` to the `ArchivedWorkspaceActions` client component via the page props.

## Consequences

- All workspaces share the same retention window. Per-workspace overrides are out of scope.
- Changing `WORKSPACE_RETENTION_DAYS` takes effect on the next daily sweep. Already-enqueued deletions are not affected.
- The displayed deletion deadline is approximate: the sweep runs once daily, so the actual deletion may happen up to ~24 hours after the displayed date.
- Adding the `retention-check` schedule to the worker is idempotent — `boss.schedule()` updates the cron expression if it already exists.
