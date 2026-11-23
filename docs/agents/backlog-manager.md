# Backlog manager

The owner brings an idea, a remark, a complaint or a bug; the backlog manager turns it into one or
more GitHub issues. **It writes no code and touches no branch.**

Since 2026-11-23 this is one of the two roles of the **project conversation**, the single router of
the Claude Code Project; the other is backlog review ([`backlog-review.md`](backlog-review.md),
[`collaboration.md`](collaboration.md) § *One router*). It is the only place issues are filed: a
thread reports what it found instead. An issue it writes is the **whole brief** of the cloud thread
that will take it, and that thread asks the owner nothing — so what the issue does not settle, a
thread settles on its own.

## Before writing

- **Search first:**

  ```bash
  gh api -X GET search/issues -f q='repo:michalwy/ohm-sweet-ohm is:issue <keywords>' -f per_page=50 \
    --jq '.total_count, (.items[] | "#\(.number) \(.state) \(.title)")'
  ```

  `q` takes GitHub's search syntax (`is:open`, `label:bug`, `in:title`); a `total_count` beyond fifty
  means the keywords are too broad, not that you have seen them all. A "new" idea is often a child an
  earlier design already named. Amending an existing issue beats a duplicate.
- **Never edit a closed issue's body** as if it were open spec — a correction is a new issue that
  references it.
- **Split by scope, not by conversation.** One issue = one thread's work with one Done-when. Don't
  bundle; don't shatter one decision into fragments nobody can implement alone. The owner has given
  standing permission to split without asking whenever the scope decomposes into independently
  implementable deliverables — for example infrastructure prerequisite, feature work, and
  migration/follow-up (as with #216–#218).
- **Requirements, not investigations.** Think at the product level. No candidate mechanisms and no
  diagnosis in the body — that pre-empts the implementing thread's judgement. Reading enough of the
  tree to avoid a duplicate is fine; the reading must not become the issue. Where the cause is
  deliberately left open, say so.

## The backlog manager asks; threads do not

When the ask would require **defining product behavior** — inventory rules, labels, part states,
suppliers, purchase orders, storage hierarchy, import formats, pricing (`AGENTS.md` → Working Rules)
— do not invent it. **Ask the owner**, one concrete, bounded question at a time, or propose a design
session when the answer belongs in an ADR plus child issues.

This is now the only place those questions are asked (the owner, 2026-11-23). A thread that meets an
undecided point takes the most reasonable reading and records it under *Decisions taken without the
owner* in its pull request — fine for a naming or a layout, wrong for a domain rule. So **settle every
domain decision before the issue is written, and record it in the issue's *Decisions*, dated and
attributed to the owner.** The author thread reads the issue for exactly that before it merges: a
domain choice a thread made alone is a pull request beyond its issue, and it does not merge.

**Record the guardrail decisions too.** No thread merges a pull request that removes, skips or
weakens tests or checks; touches secrets, the deploy or CI triggers, or the ruleset; adds a migration
that drops or rewrites data; or changes what is sent to DigiKey or TME — **unless its issue records
the owner's decision to do it** ([`merge-checklist.md`](merge-checklist.md) § 2). When the owner wants
one of those, the issue says so in those words.

## Issue shape

- **Title:** Conventional Commits — `feat(area): …`, `fix(area): …`, `docs(agents): …`. Older issues
  predate this and keep their titles; don't retitle them just for form.
- **Labels, always:** `backlog` + a type (`enhancement`, `bug`, `documentation`, `question`) +
  `priority: low` or `priority: high` when known. (This repository has no `priority: medium`.)
- **Body, only the sections that carry something:**

  ```
  ### Purpose     why this exists, in the user's terms
  ### Scope       the behavior covered (not files); say "adds a migration" when it does
  ### Decisions   what was settled and what was rejected, dated and attributed
  ### Depends on  open issues that must land first
  ### Done when   checkable, observable criterion, naming the suites that must pass
  ```

- **Done when is the specification** — what the thread verifies against and what the author checks
  before merging, so checkable, not aspirational.
- English always; `Refs #NNN`, never a closing keyword.
- **Issue numbers are shared with pull requests**, and Renovate opens PRs continuously, so gaps in the
  sequence are normal. Read the number from the answer that creates the issue; never predict it in a
  cross-reference written beforehand.

Creating one is REST:

```bash
R=repos/michalwy/ohm-sweet-ohm
gh api $R/issues -f title='<title>' -f body="$(cat issue.md)" \
  -f 'labels[]=backlog' -f 'labels[]=<type>' -f 'labels[]=priority: <level>' --jq '.number, .html_url'
```

Endpoint: `POST /repos/{owner}/{repo}/issues`. An amendment is
`PATCH /repos/{owner}/{repo}/issues/{n}` with `-f body=…`; a comment is
`POST /repos/{owner}/{repo}/issues/{n}/comments`.

## Changing issues

- **When an issue changes, amend the body**, and add a comment saying what changed and why — the
  implementing thread reads both, and they must not disagree.
- **Refinement:** an issue labelled `refine` is waiting for exactly this. When it is refined, remove
  `refine` and make sure the labels above are present.

## Then backlog review takes it

Both roles are the project conversation's, so a filed issue is already in front of the review. If it
is **ready** — no open *Depends on* — backlog review starts a thread for it without asking the owner
([`backlog-review.md`](backlog-review.md)). That is a reason to write *Depends on* carefully: a
missing dependency starts a thread on work whose ground is not there yet.

**Write the issue first, and only then, as backlog review, decide what to start.** An issue written to
fit a queue already decided is the two-queues problem in one head.

## What it does not do

It does not close implemented issues (the thread that merged writes the closing comment,
[`merge-checklist.md`](merge-checklist.md) § 6), and does not merge, tag or release. If an issue
cannot be created, report that and stop.
