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

**Restore as a plain form action on `/workspaces`.**  
The `/workspaces` page uses server-rendered forms throughout (`createWorkspace` is a form action). Restore uses the same pattern: a small `<form action={restoreWorkspaceFromPicker}>` with a hidden slug field. No client component needed.

## Consequences

- `getCurrentUserWorkspaces()` now returns only active workspaces. Any future code that needs to enumerate all workspaces (active + archived) must use `getCurrentUserArchivedWorkspaces()` or a direct Prisma query.
- The workspace layout (`src/app/w/[workspaceSlug]/layout.tsx`) adds two DB calls (session + workspace context) for every workspace page request. These duplicate calls exist with the per-page calls as well; a future optimization could wrap them in `React.cache()` to deduplicate within a render.
- The `lastWorkspace` cookie redirect filters out archived workspaces so users are not sent back to an archived workspace after sign-in.
- Workspace deletion (permanent, issue #55) will build on top of this — archived workspaces are the input set for deletion.
