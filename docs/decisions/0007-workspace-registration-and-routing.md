# 0007 Workspace registration and routing

## Status

Accepted

## Context

OhmSweetOhm now supports public email/password registration. A new user should
not receive an automatic workspace because workspace creation is a product
choice, and future invitation/member management will decide how users gain
access to existing workspaces.

Workspace links should be shareable without exposing internal database IDs.

## Decision

Registration creates only the global `User`. Email verification is not required
for the initial flow.

After sign-up or sign-in, users land on `/workspaces`. The page lists
workspaces where the signed-in user has a membership and also lets the user
create a new workspace.

Creating a workspace requires a name. The system creates:

- a `Workspace` with that name;
- a globally unique URL `slug`;
- the default system roles;
- a `WorkspaceMember` for the creator;
- an `owner` role assignment for that member.

The `owner` role carries the `admin` wildcard permission. `owner` is the product
role name; `admin` remains a permission key used by authorization logic.

Workspace routes use `/w/[workspaceSlug]/...`, starting with
`/w/[workspaceSlug]/parts`. The slug is generated from the workspace name. If the
base slug is already taken, a short random suffix is added instead of a numeric
sequence. Slugs are not editable in the first implementation.

Server-side code resolves the slug to a workspace membership for the current
user, then performs authorization and data access with the internal
`workspaceId`.

## Consequences

- The root route redirects signed-in users to `/workspaces`.
- Workspace-scoped pages should live under `/w/[workspaceSlug]/...`.
- Workspace slugs are public routing identifiers, not authorization proof.
- Requests for inaccessible workspace slugs return not found rather than
  revealing workspace existence.
- Future invitation/member management can add memberships before or after user
  registration without changing the workspace routing model.
