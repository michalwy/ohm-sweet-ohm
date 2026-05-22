# Agent Instructions

This project is intentionally vibe-coded. Future agents must preserve product intent, avoid invented requirements, and ask clarifying questions when the next step is not clear.

## Product Context

- Product name: OhmSweetOhm
- Short name: OSO
- Repository/package name: ohm-sweet-ohm
- Purpose: a web app for managing a home electronics workshop
- Target platform: desktop browsers only; do not design, implement, or test mobile-specific behavior.
- Application language: English first, additional languages later
- First feature: a parts list
- Current part definition: real purchasable electronic parts identified by manufacturer organization and catalog number
- Parts must be unique within a workspace by manufacturer organization and catalog number.

## Working Rules

- Do not assume domain behavior. Ask before defining inventory rules, labels, part states, suppliers, purchase orders, storage hierarchy, import formats, or pricing behavior.
- Do not add user-facing functionality unless the current task explicitly asks for it.
- Keep user-facing copy in English.
- Structure new user-facing strings so future localization is possible.
- Prefer small, reversible changes with clear documentation.
- When introducing a framework, library, or major pattern, add or update an ADR in `docs/decisions`.
- Update this `AGENTS.md` file when new project knowledge, workflow rules, or collaboration preferences would help future agents work better.
- Keep the project runnable locally and deployable to cloud infrastructure.
- Favor boring, well-supported tools over novelty.
- Preserve existing user changes. Do not rewrite unrelated files.
- Do not create git commits unless the user explicitly asks for a commit.
- This is currently a solo project. When the user asks for a commit, commit directly to `main` by default after appropriate local verification.
- When pushing to `main`, try `git push origin main` first. If the push is rejected because the remote has new work, then fetch the remote, rebase local commits onto `origin/main`, rerun appropriate verification if the rebase changes the tested code, and push again.
- Create a feature branch and pull request only when the user explicitly asks for a PR, when keeping work separate is useful, or when the change is intentionally experimental or incomplete.
- Use a separate git worktree only when the user explicitly asks for one. Do not create worktrees based on an agent's own risk assessment.
- Do not push broken or unverified work unless the user explicitly asks to checkpoint it.
- When creating commits, use Conventional Commits, for example `feat: add inventory overview` or `docs: update agent guidance`.
- When a commit title alone would omit useful context, include an extended commit message body with concise details about motivation, scope, or notable tradeoffs.

## Agent Collaboration

Use specialized roles only when the task benefits from them. Small, localized documentation, copy, styling, or bug-fix tasks can be handled by one careful agent.

Use specialized roles for larger or riskier changes that cross domain, data, authorization, or user-flow boundaries:

- Architect for architectural decisions, ADRs, schema boundaries, and major patterns.
- Designer for meaningful UI flows, dialogs, tables, and interaction design.
- Developer for scoped implementation once behavior is clear.
- Tester/Reviewer for browser flows, regressions, and verification.

Prefer involving Architect before changing Prisma schema, permissions, workspace scoping, authentication, routing conventions, or ADR-documented patterns.

Prefer involving Tester/Reviewer after changing forms, dynamic tables, dialogs, workspace routing, authentication, permissions, migrations, or e2e-covered flows.

Do not use multiple roles to invent product behavior. Product decisions still require clarification.

## Technical Direction

- Use TypeScript throughout application code.
- Use Next.js App Router conventions.
- Use the workspace-scoped access control model documented in `docs/decisions/0005-workspace-access-control.md`: users are global, workspace data carries `workspaceId`, roles belong to workspaces, and the `admin` permission is a wildcard in authorization logic.
- Use Better Auth for application authentication as documented in `docs/decisions/0006-authentication-provider.md`; do not reintroduce development current-user shortcuts.
- Use the registration and workspace routing flow documented in `docs/decisions/0007-workspace-registration-and-routing.md`: sign-up creates only a global user, sign-in returns users to their last accessible workspace when remembered, users choose or create workspaces at `/workspaces`, workspace URLs use `/w/[workspaceSlug]/...`, and slug resolution must still authorize by internal `workspaceId`.
- Use the organization model documented in `docs/decisions/0009-organizations-for-part-manufacturers.md`: manufacturers are workspace-scoped organizations with a `manufacturer` role, not a manufacturer-only table. Do not infer supplier, buyer, purchase, or pricing behavior from this model.
- Treat new domain resources as workspace-scoped by default. Add `workspaceId` and scope server-side queries/mutations to the current workspace unless an explicit product decision says the resource is global.
- Keep authorization checks in server-side application/domain code, not UI components.
- When adding workspace-scoped functionality, protect every server-side read or mutation with the appropriate permission. If no suitable permission exists yet, introduce an explicit permission key for that resource/action before exposing the behavior.
- Keep Next.js, React, and TypeScript as the frontend direction unless a future ADR documents a specific reason to migrate.
- Use the SPA-like workspace interaction model documented in `docs/decisions/0010-spa-like-workspace-interactions.md`: keep Next.js App Router as the route/auth shell, but prefer client-side queries and mutations for rich workspace lists, dialogs, inline editing, and repeated list actions once those screens need responsive behavior.
- Add browser interactivity with focused client components; do not make the whole app client-rendered by default.
- Prefer established React ecosystem libraries for complex tables, dialogs, forms, validation, and accessible UI primitives when those needs become concrete.
- Keep domain logic out of UI components as the app grows.
- Prefer explicit module boundaries under `src/`.
- Treat database schema changes as product decisions, not incidental implementation details.
- Keep Docker Compose suitable for local use and development, not as the only deployment path.
- Treat `docker compose up` as the user's normal local-use stack: it should run the built app with `next start` against the persistent development database.
- Use `docker compose -f docker-compose.yml -f docker-compose.dev.yml up` for containerized development with hot reload.
- Keep dependencies reasonably current; avoid leaving generated scaffolds pinned to old major versions without a documented compatibility reason.

## UI Direction

- Treat OSO as a desktop-only application. Do not add mobile layouts, responsive mobile breakpoints, mobile navigation patterns, or mobile-specific fallbacks unless a future product decision explicitly reverses this.
- Use modal dialogs for list actions such as adding, editing, and similar focused workflows.
- Prefer in-place editing on lists for fields where inline edits are practical and clear.
- For rich workspace screens, reserve URL state for navigation, filters, sorting, pagination, selected records, and deep-linkable UI. Do not put ephemeral success feedback in URL parameters; use local toast feedback instead.

## Testing Direction

- Use `pnpm typecheck` for TypeScript verification.
- Use `pnpm test:e2e` for browser-level verification of interactive UI changes.
- Run browser verification against desktop browser projects only; do not add mobile viewport projects or mobile-specific assertions.
- Keep e2e tests pointed at the isolated PostgreSQL service in `docker-compose.e2e.yml`, not the normal development database.
- Add or update e2e coverage when changing dynamic tables, dialogs, forms, or user flows.
- The user tests the app through Docker Compose. Do not leave manually started dev servers running for handoff.
- If an agent starts a manual local dev server for verification, it must stop that server before finishing the turn.
- When starting a local Next.js dev server manually for browser verification, use webpack mode, for example `pnpm exec next dev --webpack -p 3002`. Avoid Turbopack for local verification in this project because it has repeatedly produced unstable dev-server failures.

## Before Implementing Features

If a request would require defining product behavior, ask targeted questions first. Good questions are concrete and bounded, for example:

- What is the first workflow we want to support?
- Should parts be tracked by exact manufacturer part number, generic category, or both?
- Should storage locations be hierarchical?
- Should inventory quantity support fractional values?
