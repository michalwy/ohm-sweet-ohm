# Backlog review

Backlog review answers one question: **what should be worked on next, and how should it be grouped?**
Since 2026-11-23 it is one of the two roles of the **project conversation**, the single router of
the Claude Code Project — the other is the backlog manager
([`backlog-manager.md`](backlog-manager.md), [`collaboration.md`](collaboration.md) § *One router*).

It used to propose a queue and wait for the owner to start sessions. **Now it starts them** (the
owner, 2026-11-23): one cloud thread per **ready** issue, highest priority first, **without asking
the owner for confirmation**. It writes no code, touches no branch, and never cuts a release.

## Measure, never remember

Every number comes from a command run now:

```bash
R=repos/michalwy/ohm-sweet-ohm
gh api --paginate "$R/issues?state=open&per_page=100" \
  --jq '.[] | select(.pull_request | not) | "#\(.number)  [\([.labels[].name] | join(","))]  \(.title)"'
gh api "$R/releases?per_page=5" --jq '.[] | "\(.tag_name)  \(.published_at)"'      # the current version
gh api --paginate "$R/pulls?state=open&per_page=100" \
  --jq '.[] | "#\(.number)  \(.user.login)  \(.head.ref)  \(.title)"'               # what is already in flight
```

`/issues` returns pull requests as well — the `select(.pull_request | not)` is what keeps them out,
and dropping it silently doubles the in-flight work into the backlog. Never infer the backlog from
`git log`, from closed issues, or from a number quoted in an earlier message — issues appear at any
time and a released version is one call away. The threads already running are the Project's own
list; read it there rather than remembering what you started.

## Which issues are ready

**A ready issue has no open *Depends on*.** Read the *Depends on* section of each issue — body and
comments, since a dependency can be added in either — and look up every issue it names:

```bash
gh api $R/issues/<n> --jq .body
gh api --paginate $R/issues/<n>/comments --jq '.[].body'
gh api $R/issues/<dep> --jq '"#\(.number) \(.state) \(.state_reason)"'
```

An issue whose dependency is open is **not started**, however high its priority: an idle cloud
thread is reclaimed, and a thread that starts and then waits for another is the retired lead/worker
model by the back door ([`collaboration-rationale.md`](collaboration-rationale.md) § *This is not the
retired lead/worker model*). An issue with an open question for the owner is not ready either — take
the question to the owner as backlog manager first.

**Not more than one migration in flight.** An issue whose *Scope* says it adds a migration is not
started while another such issue has a thread or an open pull request: two migrations written in
parallel disagree on order and on the schema they start from.

## Starting threads

**At most 3 threads at once** (the owner, 2026-11-23, #247). Count the threads still working in the
Project's own list before starting another; when three are running, the next ready issue waits for
one to finish.

Highest priority first (`priority: high`, then `priority: low`, then unlabelled — there is no
`priority: medium`); **product first** — process and documentation work
fills a gap, it is never what the queue is made of.

**Group by whether one issue has to point at what another is moving** — not merely by whether they
land in the same file section. Issues that do share a file go to **one** thread, which holds them all
([`collaboration.md`](collaboration.md) § *One session owns its issues*). **Small, related issues from
the same area are bundled into one thread as well** (the owner, 2026-11-23, #247) — a thread's
context costs the same whether it carries one small issue or three. Each keeps its own `Refs #NNN`
and closing comment.

**Every thread is told, and nothing else is its brief:**

- the issue number (or numbers), and its role — task or release;
- that it opens one pull request with `Refs #NNN` and never a closing keyword;
- that it **asks the owner nothing**: an undecided point gets the most reasonable reading, recorded
  in the pull request under *Decisions taken without the owner*;
- that `gh issue`, `gh pr`, `gh run` and `gh release` do not work in a cloud thread — use `gh api`
  (REST) or the built-in GitHub tools ([`collaboration.md`](collaboration.md) § *GitHub from a cloud
  thread*);
- that it **never deploys**;
- that a task thread **waits for CI with one call** (`scripts/ci/wait-for-checks.sh <PR>`), runs the
  guardrail checklist, records it in the pull request, **merges its own pull request**, reads
  `main`'s run and closes the issue — or, when a guardrail is crossed without the owner's recorded
  decision, does not merge and reports ([`merge-checklist.md`](merge-checklist.md));
- that its **final reply is at most 5 lines**: the result, the link, a question if there is one.

The issue is the specification; do not restate it in the brief, where it would drift from the
issue.

**There are no reviewer threads** (the owner, 2026-11-23, #247): the author merges. **After every
merge or closed issue**, measure again and start what became ready.

**Route what a thread reports:**

- **merged**: the author has already closed the issue; measure again and start what became ready.
- **blocked on a guardrail** — the pull request crosses one and its issue records no decision: take
  it to the owner; once he decides, record the decision in the issue and send the thread (or a new
  thread on the same pull request, if it is gone) the pull request number.
- **a red `main`**: tell the owner at once; the fix goes forward in its own issue.
- **an open pull request whose thread is gone**: start a new thread on the same pull request (same
  issue, same branch) to take it over.
- **a question for the owner**: take it to him, one at a time.

## Report to the owner

Short, and in Polish: what was started and why, what is blocked and on what, what merged. The owner
redirects when he wants to; do not ask him which direction to pursue.

## Suggest a release, never cut one

When a coherent batch of shippable commits has accumulated since the last release, say so — the
project favours small, frequent releases. **A release is a deploy** to the owner's instance on the
Pi, so it is cut only on the owner's explicit word in the project conversation, by a release thread
([`release-versioning.md`](release-versioning.md)). A suggestion is not that word, and neither is
silence after one.

## Sweep Renovate

Renovate's job is to run without anyone watching, which is exactly why nobody notices when it stops.
Every review checks it and **reports, never acts**:

```bash
gh api --paginate "$R/pulls?state=open&per_page=100" \
  --jq '.[] | select(.user.login == "renovate[bot]") | "#\(.number)  \(.created_at)  \(.head.sha)  \(.title)"'
gh api "$R/commits/<head-sha>/check-runs?per_page=100" --jq '.check_runs[] | "\(.status) \(.conclusion)  \(.name)"'
gh api $R/issues/84 --jq '.updated_at, .body'      # the Dependency Dashboard
```

Report:

- any Renovate PR with a failing check, or open longer than a week (a check listed twice is two runs
  — read the latest);
- PRs that are green but unmerged — only dev-tooling patch/minor updates automerge (`renovate.json`),
  so everything else waits for the owner, and a waiting PR holds a slot;
- the **Rate-Limited** section of the dashboard: `prConcurrentLimit` is 5, so five stuck PRs silently
  hold back every update queued behind them;
- the dashboard's `updated_at` and the newest Renovate PR activity. Renovate works only before 6:00
  on Mondays (Europe/Warsaw, `renovate.json`), so expect one batch a week — a dashboard untouched for
  more than a week while updates are listed as available means it has stopped moving, not that there
  is nothing to do.

A review does not merge, close or rebase a Renovate pull request itself, and does not edit
`renovate.json`.

## Monday: start the dependency review

**Every Monday after Renovate's window (after 6:00 Europe/Warsaw), start one *dependency review*
thread** for the Renovate pull requests awaiting human review, without asking the owner (the owner,
2026-11-24, #255). Its brief is [`dependency-review.md`](dependency-review.md); there is no issue. It
counts toward the three threads at once; when none is waiting, start none. It merges what is safe and
replies with what it escalates — majors and risky updates (authentication, DigiKey and TME) — which
you take to the owner one at a time.
