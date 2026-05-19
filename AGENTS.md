# Agent Instructions

This project is intentionally vibe-coded. Future agents must preserve product intent, avoid invented requirements, and ask clarifying questions when the next step is not clear.

## Product Context

- Product name: OhmSweetOhm
- Short name: OSO
- Repository/package name: ohm-sweet-ohm
- Purpose: a web app for managing a home electronics workshop
- Application language: English first, additional languages later

## Working Rules

- Do not assume domain behavior. Ask before defining inventory rules, labels, part states, suppliers, purchase orders, storage hierarchy, import formats, or pricing behavior.
- Do not add user-facing functionality unless the current task explicitly asks for it.
- Keep user-facing copy in English.
- Structure new user-facing strings so future localization is possible.
- Prefer small, reversible changes with clear documentation.
- When introducing a framework, library, or major pattern, add or update an ADR in `docs/decisions`.
- Keep the project runnable locally and deployable to cloud infrastructure.
- Favor boring, well-supported tools over novelty.
- Preserve existing user changes. Do not rewrite unrelated files.

## Technical Direction

- Use TypeScript throughout application code.
- Use Next.js App Router conventions.
- Keep domain logic out of UI components as the app grows.
- Prefer explicit module boundaries under `src/`.
- Treat database schema changes as product decisions, not incidental implementation details.
- Keep Docker Compose suitable for local development, not as the only deployment path.

## Before Implementing Features

If a request would require defining product behavior, ask targeted questions first. Good questions are concrete and bounded, for example:

- What is the first workflow we want to support?
- Should parts be tracked by exact manufacturer part number, generic category, or both?
- Should storage locations be hierarchical?
- Should inventory quantity support fractional values?
