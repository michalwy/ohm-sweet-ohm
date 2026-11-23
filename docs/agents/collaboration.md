# Agent Collaboration

The rules every thread needs on every pull request. **The reasons and the history behind them are in
[`collaboration-rationale.md`](collaboration-rationale.md)** — read it only when you are about to
change one of these rules or one of them looks wrong.

## One router: the project conversation

This repository is worked through a **Claude Code Project** (since 2026-11-23, #247). The owner
talks to one **project conversation**, the **single router**, which holds two roles:

- **Backlog manager** — turns the owner's ideas into issues; product and domain decisions are made
  with the owner there, before an issue is written. → [`backlog-manager.md`](backlog-manager.md)
- **Backlog review** — starts one cloud thread per *ready* issue (no open *Depends on*), highest
  priority first, **without asking the owner**, **at most 3 threads at once**, small related issues
  from the same area bundled into one thread; after every merge or closed issue it starts what
  became ready. → [`backlog-review.md`](backlog-review.md)

**Threads do not talk to each other**, and none directs another. The only traffic is router → thread
(the brief at the start, and later a routed event on that thread's own work — a rebase request, a
new thread taking over a pull request) and thread → router (its replies). A change that adds
messages between threads, a lead session, or a thread that starts and then waits for another is
rebuilding the retired lead/worker model: stop and take it to the owner.

**A thread does not ask the owner questions** (the owner, 2026-11-23). An undecided point gets the
most reasonable reading, recorded in the pull request under **Decisions taken without the owner**,
and work carries on. **Product and domain decisions** — inventory rules, labels, part states,
suppliers, purchase orders, storage hierarchy, import formats, pricing — are never a thread's: it
stops at what the issue settles and says so in its reply. **Product first**: process work fills the
gaps.

## The kinds of session

| Session | What it does |
| --- | --- |
| **Project conversation** | The single router: backlog manager and backlog review. Talks to the owner, in Polish. |
| **Task thread** | Holds one issue — or several small related ones from one area — end to end: implements, opens the pull request, waits for CI, runs the guardrail checklist, **merges it**, reads `main`'s run and closes the issue. → [`merge-checklist.md`](merge-checklist.md) |
| **Release thread** | Cuts a release — and so a deploy — only on the owner's explicit word. No issue, no branch, no commit. → [`release-versioning.md`](release-versioning.md) |
| **Local session** *(local-only)* | Started by the owner on his machine; same rules plus the local-only ones. |

**There are no reviewer threads** (the owner, 2026-11-23, #247).

## Cloud threads

- **A fresh clone in its own VM** with Docker. Worktrees, the shared stash and the one shared
  integration database are local-only concerns.
- **It loads only `CLAUDE.md`, `.claude/CLAUDE.md` and `.claude/rules/`** — not `.claude/agents/`,
  commands, skills, hooks, `.claude/settings.json` or `.mcp.json`. What every thread must know is in
  `AGENTS.md` or reached from it.
- **It cannot reach the Raspberry Pi** or the owner's instance. A thread never deploys.
- **It cannot show the owner a running stack.** A change a person looks at is checked by the owner
  later, locally or on the live instance after a release — the pull request says so.
- **An idle thread is reclaimed**, so a thread never starts and then waits for another task.
- **It pushes only to the branch the platform gave it** (a `claude/…` name, in place of
  `task/<issue>-<slug>`). Name the issue in the pull request title and body.

### GitHub from a cloud thread

**GraphQL is blocked**: `gh issue`, `gh pr`, `gh run`, `gh release` and GitHub's auto-merge fail.
Use `gh api` (REST) or the built-in GitHub tools.

```bash
R=repos/michalwy/ohm-sweet-ohm
gh api $R/issues/<n> --jq '"\(.state)  \(.title)\n\n\(.body)"'                    # an issue
gh api --paginate $R/issues/<n>/comments --jq '.[] | "--- \(.user.login) \(.created_at)\n\(.body)"'
gh api $R/pulls -f title='<title>' -f head='<branch>' -f base=main -f body="$(cat pr.md)"   # open a PR
gh api -X PATCH $R/pulls/<n> -f body="$(cat pr.md)"                                  # edit its body
scripts/ci/wait-for-checks.sh <n>                                                   # wait for CI, one line
```

`/issues` lists pull requests too — filter with `select(.pull_request | not)` for issues only.

## Starting a task

```bash
git fetch origin main
git checkout -b task/<issue>-<slug> origin/main     # a cloud thread: git checkout -B <its branch> origin/main
pnpm install
pnpm prisma:generate
```

- **Run each step alone and read its own exit status** — no `&&`, no pipe.
- **`pnpm prisma:generate` runs unconditionally**: a stale client compiles and passes.
- **The fetch and the cut come before you read anything**, this file included; before the cut read
  with `git show origin/main:<path>`. A release thread only fetches.
- A task with no issue (rare — the owner asked for it directly) uses `task/<slug>`.

## One session owns its issues, end to end

It decides, migrates, implements, tests, opens the pull request, **merges it and closes the issue**.
Nothing is handed to a second session halfway. It may hold **several** issues when they share a file
or are small and related in one area; each keeps its own `Refs #NNN`, its own verification against
its own *Done when*, and its own closing comment.

**The specification is the issue body plus its comments, and the two diverge silently.** Read both,
every time (the two commands above). Check its *Depends on* before starting; an open dependency is a
reason to report back, not to guess.

### Modes of attention

For larger or riskier changes that cross domain, data, authorization, or user-flow boundaries, the
session deliberately switches how it thinks — these are modes within one session, never separate
sessions:

- **Architect** — before changing the Prisma schema, permissions, workspace scoping, authentication,
  routing conventions, or an ADR-documented pattern. Writes or updates the ADR.
- **Designer** — for meaningful UI flows, dialogs, tables, and interaction design.
- **Developer** — scoped implementation once behavior is clear.
- **Tester/Reviewer** — after changing forms, dynamic tables, dialogs, workspace routing,
  authentication, permissions, or migrations. Verification here means the suites (`testing.md`), not
  a browser.

Small, localized documentation, copy, styling, or bug-fix tasks need none of this. None of these
modes invents product behavior.

## Branches and pull requests

- `main` is protected with no bypass for anyone: pull request only, **rebase merge** only, linear
  history, force-push and deletion blocked, **four required checks** (`Static checks`, `Unit tests`,
  `Integration tests`, `Closing reference check`). The branch does **not** have to be up to date with
  `main` (the owner, 2026-11-24, #256, ADR 0029) — [`branch-protection.md`](branch-protection.md).
- **Once the task is verified, commit, push and open the pull request** without asking anybody.
  A commit is pushed in the same breath. **Never push broken or unverified work.**
- **Titles and messages:** Conventional Commits (`feat: …`, `fix: …`, `docs: …`). Every commit made
  for an issue carries `Refs #NNN` (in the body, or `(#NNN)` in the title).
- **The pull request body** says what changed and why, lists what was verified and how — including
  which suites did not run and why — references the issue as `Refs #NNN`, carries **Decisions taken
  without the owner** (or "None", never left out) and, before the merge, **a *Guardrail checklist***
  ([`merge-checklist.md`](merge-checklist.md) § 2).
- **Wait for CI with one call**: `scripts/ci/wait-for-checks.sh <PR>`, in the background or with a
  long timeout. Never poll by hand.
- **The author merges** (the owner, 2026-11-23, #247): when CI is green and the guardrail checklist
  is clear and recorded, rebase merge with `sha=<the head that went green>`. **If a guardrail is
  crossed and the issue does not record the owner's decision, it does not merge** and reports to the
  project conversation instead. → [`merge-checklist.md`](merge-checklist.md)
- **A branch behind `main` merges as it is** once its own CI is green; it is rebased only when it
  conflicts with `main` (GitHub cannot rebase-merge it then). **Rebase, then re-verify, in that
  order**: fetch, rebase, run the checks again (`pnpm install` first if the lockfile changed), push
  with `--force-with-lease`, never bare `--force`, and wait for CI again. Never merge `main` into the
  branch. **`main`'s run after the merge is the first check of the combination**, so the thread that
  merged reads it (*When `main` turns red*).
- If a thread is gone before its pull request merges, the project conversation **starts a new thread
  on the same pull request** (same issue, same branch), which takes it over.

Renovate opens pull requests inside the same gate and has no bypass either; they are not an issue
thread's — the Monday dependency-review thread takes them ([`dependency-review.md`](dependency-review.md),
[`branch-protection.md`](branch-protection.md)).

### When `main` turns red

**`main`'s own CI run after each merge is read** by the thread that merged
([`merge-checklist.md`](merge-checklist.md) § 5); a red run is **reported to the project
conversation at once**, which tells the owner. It is fixed forward in an issue of its own; nobody
reverts or patches `main` around the gate. No release is tagged from a red `main`.

### Never a closing keyword

**Never `close`, `fix` or `resolve` in any form** in front of an issue reference — not in a commit
message, not in a pull request title or body, not in prose that quotes the mistake. Use `Refs #NNN`.
`Closing reference check` enforces it over the body and the commits, but it runs only when commits
are pushed, **not when the body is edited**: after editing a body, check the text yourself
([`merge-checklist.md`](merge-checklist.md) § 1). `scripts/check-closing-references.sh` runs the
commit half locally.

## Reporting

- **A thread's final reply to the project conversation is at most 5 lines**: the result, the link,
  and a question only if there is one (the owner, 2026-11-23, #247). Details go in the pull request.
- **Findings and new backlog ideas go in the reply, not into new issues.** A defect noticed in
  passing is reported, not filed; the project conversation decides with the owner. A thread opens no
  issues other than through that route, and closes only the issues its own pull request carried.

## Plans

A plan is a working note for its author, optional: a `## Progress` checkbox list of numbered steps,
each with a **Done when**, under `.claude/plans/` (gitignored), in English even when the conversation
is in Polish. The durable record is the pull request body, the closing comment and the topic file the
task updates — so do not write a plan for a reader.

## Verification, not trust

- Run the suites that **could see the change**; **say which ran, which did not, and why**
  ([`testing.md`](testing.md)).
- **Break it on purpose once it is green** (on a throwaway branch or a scratch copy): *would this
  have failed if the code were wrong*.
- **When you change a control because it missed something, prove the old one missed it.**
- **Exercise every branch of a control before relying on it** — under each credential and each
  trigger. A control that has only ever been green cannot be told from one that cannot go red.
- **Hash the file before and after a control's edit**: an unchanged hash means INCONCLUSIVE, not pass.
- **Never adjust data to make a broken check or renderer look right.**

### Sweeping for a claim

- Run the **crude** expression first and account for its count, then narrow.
- `git grep -E` silently drops `\b` and `\s`; use `-P` or `-F`.
- Sweep in **words** as well as symbols.
- **Re-run the count after your edit**; a count is true of the tree it ran against.
- Check the **scope** of a search before stating its conclusion about the whole tree.
- **Report what you measured, not what you remember.**

## If the machine is broken, report it and stop

A broken `pnpm` or `docker` is reported, not worked around — but first tell it apart from a defect in
this repository: run the same command on a **known-good input**, and check the CI job actually **ran**
rather than being skipped green. Say in the report how you told them apart.
A cloud thread whose Docker daemon is gone starts it as
[`cloud-environment.md`](cloud-environment.md) § *Running the suites in a thread* says.

## No browser verification

**A session does not start a dev server and does not drive a browser** unless the owner explicitly
asks, even when the harness suggests it (decided 2026-09-07, re-confirmed 2026-09-18 and 2026-11-23).
Verification is the test suites. A change that is only observable in a browser: the pull request says
so and what to look at, and the owner checks it later, locally or on the live instance after a
release. The exceptional case — he asked for a browser check — is in [`testing.md`](testing.md).

## Worktrees *(local-only)*

A local session works in its own git worktree; the main checkout stays the owner's. Stage only your
own task's paths (never `git add -A`). The stash stack is shared by every worktree — never bare
`git stash`/`git stash pop`.

**A stale-looking worktree is a lookup, not a judgement.** Before removing any worktree, resolve its
path to the session whose working directory it is, and remove it only if that session is finished.

## Memory

**A fact this repository can carry goes in this repository**, never only in a session's memory; keep
in memory only what the repository cannot hold, and as a pointer, not a copy. **If the tree
contradicts a memory you were given, say so in your report**, and when your change retires a claim,
sweep the memory for it in the same session.

## Editing these documents

**Do a whole-file contradiction pass, not a pass over the section you edited** — and when a rule moves
between files, over every file it touches. A new rule usually collides with an old one that shares no
vocabulary with it, so neither grep nor a diff finds it.
