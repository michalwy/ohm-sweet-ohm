# Backlog review

A backlog-review session answers one question: **what should the next sessions take, and how should
it be grouped?** It proposes and changes nothing — no issue written or closed, no branch, no release.

## Measure, never remember

Every number comes from a command run in this session:

```bash
gh issue list --state open --limit 300
gh release list
gh pr list --state open
```

Never infer the backlog from `git log`, closed issues, or an earlier message: issues are filed at any
time, and a release can be cut in another session mid-review. Read each candidate issue's body before
ordering it (`gh issue view <n> --json body,comments`).

## The proposal — two tables, and nothing else

No status table, no questions. The user is addressed in Polish, so the tables are too.

- **Najbliższe** — the next **5** sessions. Columns: `Sesja`, `Temat` (a short theme label), `Opis`
  (issue links, each bold, with one sentence each, `<br>`-separated when a session holds several),
  `Dlaczego?` (one sentence).
- **Dalsze** — track level only, no per-session breakdown. Columns: `Track`, `Opis`, `Dlaczego?`.

Rules:

- **Product first.** Process/docs work fills gaps, never makes the queue.
- **Check dependencies before ordering**: read each issue's *Depends on*; never schedule an issue
  ahead of an open dependency. (Added after #49 was once scheduled ahead of #50 and #51.)
- **One session per issue by default.** Group issues into one session only when one has to point at
  what another is moving — not merely because they share a file section — and say why in `Dlaczego?`.
- **Do not ask which direction to pursue.** Present the plan as a recommendation; the user redirects.
- **Suggest a release** when a coherent, shippable batch has accumulated since the last tag — the
  project favours small, frequent releases. Never cut one; that is a release-manager session
  (`release-versioning.md`).

## Sweep Renovate

Renovate's job is to run without anyone watching, which is exactly why nobody notices when it stops.
Every review checks it and **reports, never acts**:

```bash
gh pr list --state open --label dependencies
gh issue view 84 --json body,updatedAt      # the Dependency Dashboard
```

Report:

- any Renovate PR with a failing check, or open longer than a week;
- PRs that are green but unmerged — only dev-tooling patch/minor updates automerge (`renovate.json`),
  so everything else waits for a human, and a waiting PR holds a slot;
- the **Rate-Limited** section of the dashboard: `prConcurrentLimit` is 5, so five stuck PRs silently
  hold back every update queued behind them;
- the dashboard's `updatedAt` and the newest Renovate PR activity. Renovate here has no schedule, so
  there is no batch to expect — a dashboard untouched for weeks while updates are listed as available
  means it has stopped moving, not that there is nothing to do.

## Standing behaviour in a backlog session

- When the user starts a task from the queue, **drop that item and reprint both tables in the same
  reply** — he should never have to ask for another review to see what is next.
- **A task's starting prompt is the issue numbers and nothing else** (`#971, #972`). The started
  session reads `AGENTS.md`, the topic files and the issues itself; a written brief duplicates them
  and goes stale. Only exception: prefix the role when it is not implementation —
  `Backlog manager: #152`, `Release manager`.
- **After every release, run a full review unprompted.** At the start of every turn, check
  `gh release list --limit 1` against the last tag you reported: notifications that another session
  finished do not reliably arrive.
