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
- closed public registration by default;
- a seeded local/e2e owner account for development and browser tests.

The existing `User` model remains the global application identity. Workspace
authorization continues to be enforced through `WorkspaceMember`, roles, and
permissions. The current workspace is resolved from the signed-in user's first
workspace membership until a workspace switcher or onboarding flow is explicitly
designed.

## Consequences

- Server-side code must resolve the current user from the Better Auth session,
  not from development constants.
- Public sign-up UI is not added. Account creation remains a seed or future
  invitation/onboarding decision.
- Production deployments must set `BETTER_AUTH_SECRET` and `BETTER_AUTH_URL`.
- Future open registration, invitations, password reset email, OAuth, or
  workspace switching should be handled as explicit product decisions.
