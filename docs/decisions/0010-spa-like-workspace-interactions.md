# ADR 0010: SPA-like workspace interactions

## Status

Accepted.

## Context

OhmSweetOhm is expected to grow from the initial parts and categories screens
into a larger desktop workshop application with many authenticated workspace
sections. Expected UI needs include:

- dynamic lists with advanced filtering, searching, sorting, pagination or
  infinite scrolling, expandable rows, and inline editing;
- increasingly advanced add/edit dialogs, plus action-specific dialogs on some
  screens;
- more workspace modules, including parts, categories, locations, inventory,
  purchasing or shopping lists, projects, and BOMs;
- integrations with external electronic part distributors such as TME and
  Octopart.

The current early implementation uses Next.js App Router, server-rendered pages,
server actions, and redirects after successful mutations. That model is simple
and predictable, but list-heavy workflows need more responsive interactions than
full page reloads after common actions. Redirect-based success feedback also
creates avoidable plumbing for transient UI state such as toast messages.

## Decision

Keep Next.js App Router, React, and TypeScript as the application framework, but
move authenticated workspace screens toward an SPA-like interaction model.

Workspace routes under `/w/[workspaceSlug]/...` should keep server-side entry
points for routing, authentication, workspace resolution, and initial permission
gates. Inside those routes, rich workspace screens should prefer focused client
components for interactive list and dialog workflows.

For dynamic workspace data, prefer client-side queries and mutations over
redirect-after-action flows once a screen needs rich table behavior, inline
editing, advanced dialogs, or repeated list actions. Successful mutations should
update or invalidate client-side data and show local toast feedback without
changing the URL. Validation and authorization failures should stay close to the
form or action that caused them.

URL state should be reserved for navigational or shareable state, such as the
active workspace section, search terms, filters, sort order, pagination cursor,
selected record, or an intentionally deep-linkable dialog. Ephemeral state such
as "created successfully" should not be encoded in query parameters.

Use boring, well-supported React ecosystem libraries for the data and UI layers:

- TanStack Query for client-side server-state, mutations, cache invalidation,
  background refresh, and infinite queries;
- TanStack Table for complex grids, including sorting, filtering, pagination,
  column state, row expansion, and inline-editing foundations;
- accessible dialog/form primitives and validation helpers when local code stops
  being enough.

Adopt these libraries through small migrations that establish one screen as a
pattern before applying it broadly. When adding or upgrading these libraries,
verify the current latest stable npm versions and avoid intentionally pinning to
older majors or minors without a documented compatibility reason.

## Rationale

This keeps the current deployment and routing model while improving the parts of
the application that will feel most like a desktop tool. A full separate SPA
would add API, routing, deployment, and authentication boundaries before the
product needs them. A purely server-action-plus-redirect model would make future
tables, inline editing, and distributor-backed workflows feel slower and harder
to maintain.

A hybrid model lets server-side code remain the authority for authentication,
workspace scoping, permissions, and domain validation. Client-side code owns the
interactive experience: local pending states, dialog errors, cache refresh,
optimistic updates where appropriate, and toast feedback.

## Consequences

- Existing server-rendered screens do not need to be rewritten immediately.
- New rich workspace screens should avoid redirect-based success flows when
  client-side mutations would provide a clearer user experience.
- Server-side reads and mutations must still enforce workspace scoping and
  permissions. Client-side checks are only presentation aids.
- Future list state should be split intentionally between URL state and local UI
  state.
- TanStack Query and TanStack Table are the default choices for future
  workspace data grids and client-side mutations.
- Dependency additions and upgrades for the workspace interaction stack should
  use the latest stable package versions unless an ADR or inline note documents
  why an older version is required.
- E2E tests for interactive screens should assert responsive behavior without
  relying on full page reloads unless navigation is the behavior being tested.
