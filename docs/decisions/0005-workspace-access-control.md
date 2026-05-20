# 0005 Workspace access control

## Status

Accepted

## Context

OhmSweetOhm needs access control across users, workspaces, roles, and
permissions. Users can belong to multiple workspaces, workspaces can contain
multiple users, and each user can have different roles per workspace.

The first protected resource is the parts list. Existing parts must become
workspace-scoped without losing local development data during migration.

## Decision

Use a workspace-scoped role-based access control model:

- `User` is a global identity.
- `Workspace` owns workspace-scoped data.
- `WorkspaceMember` connects a user to a workspace.
- `Role` belongs to exactly one workspace.
- `Permission` is a stable key such as `parts:read` or `parts:write`.
- `RolePermission` connects roles to one or more permissions.
- `WorkspaceMemberRole` assigns one or more roles to a workspace member.
- Workspace-owned entities, starting with `Part`, store `workspaceId`.

The special `admin` permission acts as a wildcard in authorization logic. It is
not expanded into every concrete permission in storage.

New workspaces receive three system roles:

- `owner` with `admin`.
- `reader` with read permissions for all current resources.
- `editor` with both read and write permissions for all current resources.

`write` does not implicitly grant `read`; roles receive both permissions when
both behaviors are intended.

System roles cannot be deleted. Role and member-role changes must preserve at
least one owner/admin-capable member in every workspace.

Workspace routing and registration are documented separately in
`0007-workspace-registration-and-routing.md`.

## Consequences

- Server-side data access must resolve a workspace context before reading or
  mutating workspace-owned data.
- New domain resources are workspace-scoped by default. They should store
  `workspaceId` and scope server-side queries and mutations to the current
  workspace unless a separate product decision defines them as global.
- Every new workspace-scoped feature must be protected by explicit permissions
  for its server-side reads and mutations.
- If a feature does not fit an existing permission, add a new stable permission
  key for that resource/action before exposing the behavior.
- UI components should not contain authorization rules.
- Future resources should add explicit permission keys before exposing
  workspace-scoped behavior.
- Introducing real login should replace current-user resolution without
  changing the workspace permission checker.
