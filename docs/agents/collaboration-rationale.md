# Agent Collaboration — rationale and history

**Read only when needed**: when you are about to change a rule in
[`collaboration.md`](collaboration.md), or one of them looks wrong. The rules themselves are there;
this file keeps *why* each one exists and what happened before it, so that the file every thread
reads stays short.

## Where these rules come from

The rules were ported on 2026-11-23 (#247) from `michalwy/stamporama` at commit `b918320`, which
comes from the same family of rules and had already moved to the Claude Code Projects model
(stamporama#2687, #2700). The owner asked for a port, not a redesign; what differs here is OSO's own
(its domain list, its four required checks, the strict up-to-date rule, DigiKey and TME).

Before that, from 2026-09-18, the owner started and routed every session by hand: task, backlog
review, backlog manager and release manager sessions, each started by him, none talking to another.
That model replaced a lead/worker model in which one long-lived session briefed and merged for task
sessions it had spawned.

## The single router

Since 2026-11-23 every issue is done by a **cloud thread** that the Project platform starts, runs in
its own VM and tracks. What one thread needs from another goes through the project conversation, the
way it used to go through the owner.

### This is not the retired lead/worker model

The lead/worker model was tried here and in a sibling project, and retired: the traffic between
sessions cost more than it produced, and most of the issues it generated were about itself rather
than about the product. **The Project model is not its return**, and the difference is the point:

- **The platform starts and tracks threads**, not a session. Nothing is briefed, polled or chased by
  message; a thread's state is the platform's, and its result is its pull request.
- **The project conversation routes the way the owner used to: by issue.** A thread is told an issue
  number, a role, a branch — and the issue is its whole brief. The specification lives on GitHub,
  not in a message, so there is nothing to relay and nothing to drift.
- **Threads still never talk to each other.** Router → thread is the brief at the start and, later,
  a routed event on that thread's own work. It carries a fact and a pull request number, never a new
  brief. No thread waits on another: only *ready* issues are started, and a thread that has gone
  idle is not kept alive for a later message.

### Threads never ask the owner

The old rule "ask before defining domain behavior, one question at a time" now reads: **the backlog
manager asks; threads do not** (the owner, 2026-11-23). A reasonable reading is fine for a naming or
a layout and wrong for a domain rule, which is why those are settled in the issue before a thread
starts.

## Why there are no reviewer threads

Stamporama ran a separate reviewer thread per pull request for a few hours and retired it to cut
Claude usage: a second thread re-read the same context, issue and diff, and the owner does not review
pull requests either way. OSO adopted the result directly (the owner, 2026-11-23). The hard
guardrails a reviewer would have enforced did not go away: the author runs them as a checklist,
records the result in the pull request, and does not merge when one is crossed without the owner's
recorded decision ([`merge-checklist.md`](merge-checklist.md)).

The same decision set the other usage rules: a thread waits for CI with one call
(`scripts/ci/wait-for-checks.sh`) instead of a model turn per poll; a final reply is at most five
lines; small related issues share a thread; at most three threads run at once.

Until #247 merged, the bootstrap rule held: a pull request merged only on the owner's word in the
project conversation.

## Cloud threads

A thread **loads only `CLAUDE.md`, `.claude/CLAUDE.md` and `.claude/rules/`**, so anything every
thread must know is in `AGENTS.md` or reached from it — `CLAUDE.md` points there. **An idle thread
is reclaimed**, which is why only ready issues are started and why an author does not sit watching
its pull request across idle time. The commands in `docs/agents/` are all REST, because `gh issue`,
`gh pr`, `gh run` and `gh release` go through GraphQL, which a cloud thread cannot reach. Endpoints:
`GET /repos/{owner}/{repo}/issues/{n}`, `…/issues/{n}/comments`, `POST /repos/{owner}/{repo}/pulls`,
`PATCH /repos/{owner}/{repo}/pulls/{n}`, `GET /repos/{owner}/{repo}/commits/{ref}/check-runs`.

## Starting a task

A cloud thread's clone is already on its branch; the `-B` re-cuts it from the `origin/main` just
fetched, which is right while the branch carries no commit of its own.

**Each step alone**: after a pipe `$?` belongs to the filter, so a failed step reports the same `0`
as a clean one.

**`pnpm prisma:generate` unconditionally**: an old worktree's install may say "Already up to date"
and skip postinstall, leaving a generated Prisma client that is **stale rather than missing** — it
compiles and passes against a schema the branch no longer declares.

**Fetch and cut first**: after the cut the worktree *is* `origin/main`; before it, read with
`git show origin/main:<path>`.

## One session owns its issues

Splitting one issue across sessions costs more context than it saves. Holding several issues that
share a file is the normal answer to file contention; holding several small related ones saves a
thread's context, which costs the same whether it carries one small issue or three. A *Done when* is
often amended in a comment while the body keeps its original wording, and an overtaken body looks
exactly like a current one — hence reading both halves every time.

## Branches and pull requests

**Verified → commit, push, open the pull request without asking**: asking costs the owner a round
trip for a step he always approves, and an unpushed commit is invisible to CI and can vanish with the
thread.

**Up to date with `main`**: unlike Stamporama (stamporama#1791), OSO's ruleset keeps
`strict_required_status_checks_policy: true`, so GitHub refuses to merge a branch that is behind.
Changing that is a ruleset change, and the ruleset is a guardrail — the owner's call.

**Rebase, then re-verify**: the re-run is the half that is easy to drop and the only half that is
interesting — a suite that was green before the rebase was green against a different `main`.

**The `sha` on the merge**: with 0 required approvals there is no approval for a later push to
invalidate, and strict status checks only force the branch to be current with `main`; nothing else
checks that the head is still the commit that was checked. Passing `sha` makes GitHub refuse the
merge if anything was pushed after it.

### Closing keywords

GitHub acts on a closing keyword the moment the change lands and closes the issue before anybody has
verified it; no repository setting turns that off, and every convention outside this repository tells
you to write it. Because `main` uses rebase merges, branch commits are replayed verbatim, so a keyword
in a commit arms the close even when the pull request body is clean. The required
`Closing reference check` checks both halves, but it runs on `pull_request` events with the default
types — opened, synchronize, reopened — so **a body edit does not re-run it**; the author re-checks
the body by hand after an edit ([`merge-checklist.md`](merge-checklist.md) § 1). Making the job
re-run on edits is a CI trigger change, and so the owner's call.

## Verification, not trust

The habits in `collaboration.md` have found more real defects than anything else. A no-op edit and a
non-discriminating test are byte-identical from an exit status, hence the hash.

**Sweeping**: a precise expression run first can exit 1 with no output — a truthful no-match over a
pattern that could never have matched, byte-identical to a clean tree. Prose says one thing where the
code says another. A search that ran and answered exactly what it was asked can still be scoped too
narrowly — and the conclusion then gets stated about the whole tree.

## A broken machine

A workaround multiplies across every session that meets it. But *report and stop* is the wrong answer
to a defect in this repository's own configuration, and at the moment a command exits non-zero the
two look identical. A command whose result depends on where it runs is a defect in the check — see the
lint story in [`testing.md`](testing.md).

## No browser verification

Decided 2026-09-07, re-confirmed 2026-09-18, and kept by the owner when the Project model was adopted
(2026-11-23) — do not "fix" it back. The owner runs the app through Docker Compose and exercises it
himself, so an agent's browser pass duplicates his work while adding a flaky, slow step; a cloud
thread could not show him a running stack anyway.

## Findings

Reporting rather than filing keeps one voice on the backlog and stops five threads filing five
versions of the same observation.

## Worktrees and memory

*(Local-only.)* An idle worktree with no branch and no pull request looks the same whether its
session is finished or waiting on the owner — hence resolving it to its session before removing it.
A cloud thread has a clone of its own and none of this applies to it.

Agent memory is outside git, in no pull request, and checked by nothing — nothing in CI can fail
because a memory entry contradicts this repository. Keep in it only the owner's working preferences,
machine-local facts and pointers outside git; store the command, not the fact the command answers.
**You are the only reader holding both halves** of a contradiction between the tree and a memory, and
the one who knows what your change retired. Entries that were correct when written are the dangerous
case: they read as authoritative and have no way to learn they were superseded.

## Editing these documents

Twice on 2026-09-07 a new rule collided with an old one a few paragraphs away, both times introduced
by the author who had just written a rule about contradictions — hence the whole-file pass.
