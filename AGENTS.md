# Agent Instructions

This project is intentionally vibe-coded. Future agents must preserve product intent, avoid invented requirements, and ask clarifying questions when the next step is not clear.

## Product Context

- Product name: OhmSweetOhm
- Short name: OSO
- Repository/package name: ohm-sweet-ohm
- Purpose: a web app for managing a home electronics workshop
- Application language: English first, additional languages later
- First feature: a parts list
- Current part definition: real purchasable electronic parts identified by manufacturer name and catalog number

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
- When creating commits, use Conventional Commits, for example `feat: add inventory overview` or `docs: update agent guidance`.
- When a commit title alone would omit useful context, include an extended commit message body with concise details about motivation, scope, or notable tradeoffs.

## Agent Collaboration

Use specialized roles only when the task benefits from them:

- Architect for architectural decisions, ADRs, schema boundaries, and major patterns.
- Designer for meaningful UI flows, dialogs, tables, and interaction design.
- Developer for scoped implementation once behavior is clear.
- Tester/Reviewer for browser flows, regressions, and verification.

Do not use multiple roles to invent product behavior. Product decisions still require clarification.

## Technical Direction

- Use TypeScript throughout application code.
- Use Next.js App Router conventions.
- Use the workspace-scoped access control model documented in `docs/decisions/0005-workspace-access-control.md`: users are global, workspace data carries `workspaceId`, roles belong to workspaces, and the `admin` permission is a wildcard in authorization logic.
- Treat new domain resources as workspace-scoped by default. Add `workspaceId` and scope server-side queries/mutations to the current workspace unless an explicit product decision says the resource is global.
- Keep authorization checks in server-side application/domain code, not UI components.
- When adding workspace-scoped functionality, protect every server-side read or mutation with the appropriate permission. If no suitable permission exists yet, introduce an explicit permission key for that resource/action before exposing the behavior.
- Keep Next.js, React, and TypeScript as the frontend direction unless a future ADR documents a specific reason to migrate.
- Add browser interactivity with focused client components; do not make the whole app client-rendered by default.
- Prefer established React ecosystem libraries for complex tables, dialogs, forms, validation, and accessible UI primitives when those needs become concrete.
- Keep domain logic out of UI components as the app grows.
- Prefer explicit module boundaries under `src/`.
- Treat database schema changes as product decisions, not incidental implementation details.
- Keep Docker Compose suitable for local development, not as the only deployment path.
- Keep dependencies reasonably current; avoid leaving generated scaffolds pinned to old major versions without a documented compatibility reason.

## UI Direction

- Use modal dialogs for list actions such as adding, editing, and similar focused workflows.
- Prefer in-place editing on lists for fields where inline edits are practical and clear.

## Testing Direction

- Use `pnpm typecheck` for TypeScript verification.
- Use `pnpm test:e2e` for browser-level verification of interactive UI changes.
- Keep e2e tests pointed at the isolated PostgreSQL service in `docker-compose.e2e.yml`, not the normal development database.
- Add or update e2e coverage when changing dynamic tables, dialogs, forms, or user flows.
- When starting a local Next.js dev server manually for browser verification, use webpack mode, for example `pnpm exec next dev --webpack -p 3002`. Avoid Turbopack for local verification in this project because it has repeatedly produced unstable dev-server failures.

## Before Implementing Features

If a request would require defining product behavior, ask targeted questions first. Good questions are concrete and bounded, for example:

- What is the first workflow we want to support?
- Should parts be tracked by exact manufacturer part number, generic category, or both?
- Should storage locations be hierarchical?
- Should inventory quantity support fractional values?
