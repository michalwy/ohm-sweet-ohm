# ADR 0016 — Workspace Archiving

**Status:** Accepted  
**Date:** 2026-06-22

## Context

Users can accumulate workspaces over time. A hard delete would be irreversible and potentially destructive. A soft "hide" mechanism — archiving — lets users remove a workspace from the active list while keeping all data intact until they explicitly choose to delete it permanently (issue #55).

## Decision

Add an `archivedAt DateTime?` timestamp to the `Workspace` model. A null value means the workspace is active; a non-null value means it has been archived.

### Key choices

**`archivedAt DateTime?` over a boolean `isArchived`.**  
The timestamp is intrinsically useful for display ("Archived Jun 15, 2026") and avoids a separate `archivedDate` column that would always be added anyway.

**Active-only semantics for `getCurrentUserWorkspaces()`.**  
The function now filters `archivedAt: null`. All existing callers silently stop seeing archived workspaces in the workspace picker, which is the desired behavior. Callers that need archived workspaces use the new `getCurrentUserArchivedWorkspaces()`.

**Redirect (not 404) for archived workspace URL access.**  
ADR 0007 says "unknown workspace → 404." Archived workspaces are a distinct state: the user is a legitimate member but the workspace is temporarily inaccessible. A redirect to `/workspaces?notice=workspace-archived` is more informative and actionable than a 404, and avoids leaking information only to people who are already members.

**Route guard in a shared layout, not per-page.**  
A single `src/app/w/[workspaceSlug]/layout.tsx` enforces the archived check for all pages under `/w/[slug]/...`, including any pages added in the future. This is safer and avoids duplicating the guard across ~10 page files.

**Admin-only archive/restore, no membership requirement.**  
Only workspace admins (the `admin` permission wildcard) may archive or restore. No requirement to remove other members before archiving — they simply lose active access until the workspace is restored.

**Client-side redirect after archiving.**  
The `archiveWorkspace` server action returns `{ ok: true, redirectTo: "/workspaces" }` instead of calling `redirect()` directly. The client `GeneralSettingsClient` calls `window.location.assign(redirectTo)` after receiving the success response. This allows the client component to close the confirmation dialog cleanly before navigating.

**Restore and permanent-delete actions in a client component on `/workspaces`.**  
The restore form (`<form action={restoreWorkspaceFromPicker}>`) and the permanent-delete button both live in the `ArchivedWorkspaceActions` client component (`src/app/workspaces/archived-workspace-actions.tsx`). The restore action is still a plain form POST server action; the delete action uses `useMutation` to call `scheduleWorkspaceDeletion` and reloads the page on success.

## Consequences

- `getCurrentUserWorkspaces()` now returns only active workspaces. Any future code that needs to enumerate all workspaces (active + archived) must use `getCurrentUserArchivedWorkspaces()` or a direct Prisma query.
- The workspace layout (`src/app/w/[workspaceSlug]/layout.tsx`) adds two DB calls (session + workspace context) for every workspace page request. These duplicate calls exist with the per-page calls as well; a future optimization could wrap them in `React.cache()` to deduplicate within a render.
- The `lastWorkspace` cookie redirect filters out archived workspaces so users are not sent back to an archived workspace after sign-in.
- Workspace deletion (permanent, issue #55) builds on top of this — archived workspaces are the input set for deletion. The **Permanently delete** button appears next to the **Restore** button in the **Archived workspaces** section of the Workspaces page (`/workspaces`). It is not in workspace settings. Clicking it opens a typed-name confirmation dialog; on confirm, the server action `scheduleWorkspaceDeletion` calls `enqueueWorkspaceDeletion("manual", ...)` which sets `deletionScheduledAt` and enqueues a pg-boss job (see ADR 0017). Restoration is no longer possible once `deletionScheduledAt` is set.
- Archived workspaces are automatically scheduled for permanent deletion after the configured retention period (default: 30 days). A daily cron sweep in the deletion worker discovers expired archived workspaces and enqueues a `"retention-expiry"` deletion job for each. The Workspaces page shows the scheduled deletion deadline for each archived workspace. Restoration remains possible until `deletionScheduledAt` is set by either the retention sweep or a manual delete action. See ADR 0018 for the full retention policy.
