# 0006 Authentication provider

## Status

Accepted

## Context

OhmSweetOhm previously resolved a seeded development user as the current user.
That preserved the workspace authorization boundary, but it did not provide real
login, sessions, or password-based access.

The app should keep the existing workspace-scoped access-control model. Real
authentication should replace current-user resolution without redefining
inventory, workspace ownership, invitation, or open registration behavior.

## Decision

Use Better Auth for application authentication with the existing PostgreSQL and
Prisma stack.

Configure Better Auth with:

- email and password authentication;
- Prisma-backed `User`, `Session`, `Account`, and `Verification` models;
- a seeded local/e2e owner account for development and browser tests.

The existing `User` model remains the global application identity. Workspace
authorization continues to be enforced through `WorkspaceMember`, roles, and
permissions. Public registration and workspace selection are documented in
`0007-workspace-registration-and-routing.md`.

## Consequences

- Server-side code must resolve the current user from the Better Auth session,
  not from development constants.
- Production deployments must set `BETTER_AUTH_SECRET` and `BETTER_AUTH_URL`.
- Future invitations, password reset email, OAuth, or member management should
  be handled as explicit product decisions.
