# Agent Instructions

This project is intentionally vibe-coded. Preserve product intent and avoid invented requirements.

**It is worked through a Claude Code Project** (since 2026-11-23, #247): the owner talks to one
**project conversation**, which turns his ideas into issues and starts one **cloud thread** per ready
issue. If you are a thread, the issue you were given is your whole brief, and **you ask the owner
nothing**. → [`collaboration.md`](docs/agents/collaboration.md) § *One router*

**This file is the always-loaded core: rules, invariants, and a map.** The reasoning behind each area
lives in `docs/agents/*.md` — read the file for the area you are touching before you change it. Do
not restate that reasoning here; add it to the topic file instead.

## Product Context

- Product name: OhmSweetOhm. Short name: OSO. Repository/package name: `ohm-sweet-ohm`.
- Purpose: a web app for managing a home electronics workshop.
- Target platform: desktop browsers only; do not design, implement, or test mobile-specific behavior.
- Application language: English first, additional languages later.
- First feature: a parts list. A part is a real purchasable electronic part, identified by its
  manufacturer organization and catalog number, and unique within a workspace by that pair.

## Working Rules

- Do not assume domain behavior. Inventory rules, labels, part states, suppliers, purchase orders,
  storage hierarchy, import formats and pricing are decided **with the owner in the project
  conversation, before the issue is written**, and recorded in it: **the backlog manager asks;
  threads do not.** A thread that meets an undecided point takes the most reasonable reading, records
  it in the pull request under **Decisions taken without the owner**, and carries on — and a domain
  rule is never one it settles alone. → [`collaboration.md`](docs/agents/collaboration.md),
  [`backlog-manager.md`](docs/agents/backlog-manager.md)
- Do not add user-facing functionality the task did not ask for. Small, reversible changes. Preserve
  existing user changes; do not rewrite unrelated files.
- User-facing copy is English and structured so it can be localized later.
- User-visible behavior change → update `docs/user-guide/` in the same task (feature pages: index, workspaces,
  organizations, parts, inventory, purchasing, integrations, settings; add a page when a topic fits
  none). Behavior, data model, setup or architecture change →
  update every affected doc in the same task (`README.md`, `docs/product/brief.md`,
  `docs/architecture/overview.md`, the ADRs, `docs/user-guide/`), and before finishing check that they
  still match what was built.
- A framework, library or major pattern needs an ADR in `docs/decisions/`.
- New project knowledge goes in the matching `docs/agents/` topic file. Edit this file only for a rule
  that applies to every task, or to add a topic to the map.
- **A fact this repository can carry goes in this repository, never only in a session's memory**, and
  **if the tree contradicts a memory you were given, say so in your report**.
- GitHub Issues are the backlog; no local `TODO.md`. Issues are always labelled: `backlog` + a type
  (`enhancement`, `bug`, `documentation`, `question`) + `priority: low` / `priority: high` when known.
  **All GitHub content is in English**: issues, comments, PR titles and bodies, commit messages.
- **Once a task is verified, commit it, push it and open the pull request without asking.** A commit
  is pushed in the same breath: until it is pushed, CI cannot see it and the thread can be reclaimed
  with it.
- **There are no reviewer threads: the author merges its own pull request** (rebase merge) when CI
  is green — waited for with **one call**, `scripts/ci/wait-for-checks.sh <PR>` — and the guardrail
  checklist is clear and **recorded in the pull request** (the owner, 2026-11-23, #247); the owner
  does not review pull requests. **It never merges one that goes beyond its issue, or that crosses a
  hard guardrail** — removes, skips or weakens tests or checks; touches secrets, the deploy or CI
  triggers, or the ruleset; adds a migration that drops or rewrites data; changes what is sent to
  DigiKey or TME — **unless its issue records the owner's decision to do it**; it reports to the
  project conversation instead. After the merge it reads `main`'s run and closes the issue.
  → [`merge-checklist.md`](docs/agents/merge-checklist.md)
- **A thread's final reply to the project conversation is at most 5 lines** — the result, the link,
  a question if there is one; details go in the pull request. **At most 3 threads run at once**, and
  small related issues from one area share a thread (the owner, 2026-11-23, #247).
- **A release is a deploy to the owner's instance on the Pi**, so it is cut **only on the owner's
  explicit word** in the project conversation. **No thread ever deploys**, and no thread can reach
  the Pi. → [`release-versioning.md`](docs/agents/release-versioning.md)
- **GraphQL is blocked in a cloud thread**: `gh issue`, `gh pr`, `gh run`, `gh release` and
  GitHub's auto-merge all fail. Use `gh api` (REST) or the built-in GitHub tools.
  → [`collaboration.md`](docs/agents/collaboration.md) § *GitHub from a cloud thread*
- **`main` takes no direct pushes**, for anyone, the owner included: pull request only, rebase
  merge, linear history, required checks, no bypass — but **not** the branch up to date with `main`
  (the owner, 2026-11-24, #256, ADR 0029). Work on
  `task/<issue>-<slug>` cut from `main` — in a cloud thread, the branch the platform gave it; **the
  thread that opens the pull request owns it until it merges, merges it, and closes the issue by
  hand**; if it is gone, the project conversation starts a new thread on the same pull request.
  → [`collaboration.md`](docs/agents/collaboration.md)
- **A branch behind `main` may merge as it is**: the ruleset does not require it to be up to date.
  It is rebased (never merged) only when it conflicts with `main`, and then re-verified, in that
  order. `--force-with-lease`, never bare `--force`. **`main`'s run after each merge is read** by the
  thread that merged — it is the first run of that combination — and a red `main` goes to the
  project conversation at once and is fixed forward in its own issue.
- Conventional Commits for commit and PR titles; reference issues as `Refs #NNN`. **Never a closing
  keyword** (`close`, `fix`, `resolve` in any form) in front of an issue reference, anywhere in a
  commit message or PR body — the required `Closing reference check` fails the PR.
- **A task starts from a fresh `main`**: `git fetch origin main`, cut the branch, `pnpm install`,
  `pnpm prisma:generate` — each step alone, each exit status read, before reading any file in the
  worktree. → [`collaboration.md`](docs/agents/collaboration.md) § *Starting a task*
- *(Local-only.)* **A local session works in its own git worktree**; the main checkout stays the
  owner's. Stage only your own task's paths (never `git add -A`); the stash stack is shared across
  worktrees. A cloud thread has a fresh clone of its own. Either way more than one session runs at
  once, so **treat `main` as moving underneath you**.
- Keep the project runnable locally and deployable to cloud infrastructure. Favor boring,
  well-supported tools. Keep dependencies reasonably current; do not leave scaffolds pinned to old
  major versions without a documented reason.

## Topic Map

| Touching… | Read |
| --- | --- |
| The Project model, cloud threads, branches, pull requests, verification, memory | [`collaboration.md`](docs/agents/collaboration.md) |
| Why those rules are as they are, and their history (read only when changing one) | [`collaboration-rationale.md`](docs/agents/collaboration-rationale.md) |
| Starting threads for ready issues (the project conversation) | [`backlog-review.md`](docs/agents/backlog-review.md) |
| Turning ideas and bug reports into issues (the project conversation) | [`backlog-manager.md`](docs/agents/backlog-manager.md) |
| Waiting for CI, the guardrail checklist, merging your own pull request, closing the issue | [`merge-checklist.md`](docs/agents/merge-checklist.md) |
| Renovate pull requests, the Monday dependency-review thread | [`dependency-review.md`](docs/agents/dependency-review.md) |
| Releases (= deploys) | [`release-versioning.md`](docs/agents/release-versioning.md) |
| The Project's standing instructions, as pasted into Project settings | [`project-instructions.md`](docs/project-instructions.md) |
| The `main` ruleset, its artifact, the drift check, required CI checks | [`branch-protection.md`](docs/agents/branch-protection.md) |
| Test suites, migrations, browser checks | [`testing.md`](docs/agents/testing.md) |
| Stack, access control, workspaces, domain model rules | [`architecture.md`](docs/agents/architecture.md) |
| UI, dialogs, lists | [`ui.md`](docs/agents/ui.md) |
| Docker Compose, self-hosted deployment, the container image | [`deployment.md`](docs/agents/deployment.md) |
| DigiKey and TME payloads | [`integrations.md`](docs/agents/integrations.md) |
| The cloud environment: setup script, versions, running the suites in a thread | [`cloud-environment.md`](docs/agents/cloud-environment.md) |

## Invariants

- Desktop browsers only. → `ui.md`
- New domain resources are workspace-scoped: they carry `workspaceId`, and every server-side read and
  mutation is scoped to the current workspace and permission-checked in server-side domain code, never
  in UI components. → `architecture.md`, ADR 0005
- Authentication is Better Auth; no development current-user shortcuts. Slug resolution authorizes by
  internal `workspaceId`. → ADR 0006, ADR 0007
- Database schema changes are product decisions. Migrations are generated with
  `pnpm exec prisma migrate dev --create-only --name <name>`; never run `prisma migrate dev`,
  `prisma migrate reset` or `prisma db push`. → `testing.md`
- Part attribute values survive category changes. → `architecture.md`
- Dialogs are built on `src/app/dialog-shell.tsx`, and nothing inside one uses React `autoFocus` — it
  freezes the browser. → `ui.md`
- The version is the git tag; there is no version-bump commit. → `release-versioning.md`

## Agent Collaboration

**One thread owns one issue end to end** — it decides, implements, tests, opens the pull request,
merges it after the guardrail checklist, and closes the issue. Nothing is handed to a second agent
halfway. A thread may hold several issues when they share a file, or when they are small and related
in one area, each with its own `Refs #NNN`, verification and closing comment.

**The project conversation routes everything, by issue, and threads do not talk to each other.**
Findings and new backlog ideas go into the thread's reply, not into new issues. **The *Done when* is
the issue body plus its comments**, and the two diverge silently: read both
(`gh api repos/michalwy/ohm-sweet-ohm/issues/<n>` and `…/issues/<n>/comments`).
→ [`collaboration.md`](docs/agents/collaboration.md) — read it before opening a pull request.

## Testing Direction

- A suite runs when it could see the change — a documentation-only change runs none. The report says
  which ran, which did not, and why.
- `pnpm lint` for any source change (errors fixed, warnings may stay); `pnpm typecheck` for
  TypeScript or schema changes; `pnpm test:unit` for pure logic (no Prisma, no server
  infrastructure); `pnpm test:integration` after any change to server-side mutations or domain logic,
  against the isolated database in `docker-compose.e2e.yml`. → `testing.md`
- E2E browser testing is paused; do not add e2e test files.
- If required tooling is missing, report it and stop.
- **A session does not start a dev server or drive a browser** unless the owner asks — deliberately.
  A change a person looks at is checked by the owner, locally or on the live instance after a
  release; the pull request says so. → [`collaboration.md`](docs/agents/collaboration.md) § *No browser verification*
