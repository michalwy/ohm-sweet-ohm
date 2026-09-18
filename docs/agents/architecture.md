# Architecture and domain model

The rules below are the working summary; the ADRs in `docs/decisions/` carry the decisions and
`docs/architecture/overview.md` the overall picture. When a rule here and an ADR disagree, the ADR is
the decision — fix this file.

## Stack

- TypeScript throughout application code.
- Next.js App Router conventions, with Next.js, React and TypeScript as the frontend direction unless
  a future ADR documents a reason to migrate (ADR 0002).
- Use the SPA-like workspace interaction model (ADR 0010): the App Router is the route/auth shell;
  prefer client-side queries and mutations for rich workspace lists, dialogs, inline editing and
  repeated list actions once those screens need responsive behavior. The stack for it is TanStack
  Query and TanStack Table; when adding or upgrading them, check the latest stable npm versions and do
  not pin older ones without a documented compatibility reason.
- Add browser interactivity with focused client components; do not make the whole app client-rendered
  by default.
- Prefer established React ecosystem libraries for complex tables, dialogs, forms, validation and
  accessible UI primitives when those needs become concrete.
- Keep domain logic out of UI components as the app grows, and prefer explicit module boundaries
  under `src/`.

## Access control and workspaces

- Workspace-scoped access control (ADR 0005): users are global, workspace data carries `workspaceId`,
  roles belong to workspaces, and the `admin` permission is a wildcard in authorization logic.
- Treat new domain resources as workspace-scoped by default: add `workspaceId` and scope server-side
  queries and mutations to the current workspace unless an explicit product decision says the
  resource is global.
- Keep authorization checks in server-side application/domain code, never in UI components. Protect
  every workspace-scoped server-side read and mutation with the appropriate permission; if no suitable
  permission exists, introduce an explicit permission key for that resource/action before exposing
  the behavior.
- Authentication is Better Auth (ADR 0006); do not reintroduce development current-user shortcuts.
- Registration and routing (ADR 0007): sign-up creates only a global user; sign-in returns users to
  their last accessible workspace when remembered; users choose or create workspaces at
  `/workspaces`; workspace URLs use `/w/[workspaceSlug]/...`; slug resolution must still authorize by
  internal `workspaceId`.
- Archived workspaces (ADR 0016): workspaces have an `archivedAt` timestamp;
  `getCurrentUserWorkspaces()` returns only active ones; the shared layout at
  `src/app/w/[workspaceSlug]/layout.tsx` redirects archived workspace URLs to
  `/workspaces?notice=workspace-archived`; only admins may archive or restore, from Settings →
  General.

## Parts, organizations, categories, locations

- Manufacturers are workspace-scoped organizations with a `manufacturer` role, not a
  manufacturer-only table (ADR 0009). Do not infer supplier, buyer, purchase or pricing behavior from
  this model.
- Category attributes (ADR 0011): attributes are workspace-scoped dictionary records; category
  attachments/overrides define defaults, sort order and `isPrimary`; a category's `valueAttributeId`
  controls the parts-list Value column; all attributes are optional.
- A part form's effective attribute set is the primary category's attributes plus the secondary
  category's, deduplicated by attribute id. When an attribute appears in both, the primary category's
  configuration always wins. The parts-list Value column comes only from the primary category's
  effective `valueAttributeId`.
- Part attribute values survive category changes. Removing a local attribute attachment or changing a
  part's primary or secondary category must not delete existing `PartAttributeValue` records; if the
  attribute becomes effective for that part again, reuse the saved value.
- When a local category attribute attachment overrides an inherited one, detaching the local
  attachment reveals the inherited effective attribute instead of removing that attribute from the
  category.
- Archived locations (ADR 0013): a location can be archived only when stock is zero for every part;
  archived locations stay visible in stock read views and cannot be used in new stock movements.

## Lists at scale

Large workspace lists are expected to outgrow client-side full loading. Prefer cursor-backed endless
scrolling for parts and future large lists, built on shared list primitives rather than per-screen
endless-scroll code (see `ui.md`).
