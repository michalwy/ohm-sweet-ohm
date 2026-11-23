# Dependency review — the Monday Renovate thread

Renovate works once a week, and one thread reviews what it left waiting (the owner, 2026-11-24, #255).

## Why

Renovate used to run at any time and keep every open pull request up to date with `main`. The `main`
ruleset requires a branch to be up to date before it merges, so every merge to `main` made Renovate
rebase all of its open pull requests (up to `prConcurrentLimit`, five), and each rebase re-ran the
whole CI. That filled the CI queue, and the pull requests it kept fresh still waited for the owner.

## What `renovate.json` does

- `"schedule": ["before 6am on monday"]`, `"timezone": "Europe/Warsaw"`: Renovate opens and updates
  branches only in that window. Security updates (vulnerability alerts) ignore the schedule, as
  Renovate does by default.
- `"updateNotScheduled": false`: outside the window, existing branches are left alone, so merges to
  `main` during the week do not trigger rebases.
- `"rebaseWhen": "conflicted"`: a pull request that does not automerge is rebased only when it
  conflicts with `main`, not every time it falls behind.
- The dev-tooling patch/minor rule, the only one that automerges, keeps
  `"rebaseWhen": "behind-base-branch"`: an automerging pull request has to be up to date to merge
  ([`branch-protection.md`](branch-protection.md) § *Renovate inside the gate*), and nobody else would
  bring it there.

## Who starts it, and when

**Every Monday, once Renovate's window has passed (after 6:00 Europe/Warsaw), the project
conversation starts one *dependency review* thread** for the Renovate pull requests awaiting human
review — every open pull request by `renovate[bot]` that does not automerge, plus any automerging one
that is stuck (red, or green and unmerged). It starts it without asking the owner, as part of backlog
review ([`backlog-review.md`](backlog-review.md)), and it counts toward the three threads at once.
If no Renovate pull request is waiting, no thread is started. There is no issue for a dependency
review: the thread's brief is this page, and its role is *dependency review*.

## What the thread does

`R=repos/michalwy/ohm-sweet-ohm`, REST only ([`collaboration.md`](collaboration.md) § *GitHub from a
cloud thread*).

1. **List what waits.**

   ```bash
   gh api --paginate "$R/pulls?state=open&per_page=100" \
     --jq '.[] | select(.user.login == "renovate[bot]") | "#\(.number)  \(.head.sha)  \(.title)"'
   gh api $R/issues/84 --jq .body      # the Dependency Dashboard: pending and rate-limited updates
   ```

2. **Read every changelog.** For each pull request read the release notes Renovate puts in its body,
   and the upstream changelog or release page for every version it skips. Look for breaking changes,
   deprecations the code uses, changed defaults, security fixes, and anything touching
   authentication, sessions or outgoing HTTP requests.

3. **Sort each pull request** into one of two piles:

   - **Escalate — the owner decides; the thread does not merge it:**
     - a **major** update (Renovate's `major` update type, or a `0.x` minor bump that its changelog
       calls breaking);
     - **authentication**: `better-auth` (the *Auth* group), or any update whose changelog touches
       sessions, cookies, password hashing or OAuth;
     - **the DigiKey and TME integrations**: any update that could change what is sent to DigiKey or
       TME or how their answers are read — server-side `fetch`, HTTP, OAuth tokens or JSON handling
       ([`integrations.md`](integrations.md), `src/server/integrations/`);
     - any pull request that crosses a hard guardrail of [`merge-checklist.md`](merge-checklist.md)
       § 2 — for example one that changes a workflow under `.github/workflows/` (CI triggers, the
       deploy) or the container image the deploy builds.
   - **Merge** — everything else, once its CI is green.

4. **Merge the safe ones, one at a time**, per [`merge-checklist.md`](merge-checklist.md):

   - **Up to date first.** With `rebaseWhen: conflicted`, a pull request behind `main` stays behind.
     Ask Renovate to rebase it by ticking the *rebase* checkbox in its body (a manual request,
     honoured outside the schedule), then wait for the new head's CI with one call:

     ```bash
     body=$(gh api $R/pulls/N --jq .body)
     gh api -X PATCH $R/pulls/N -f body="${body/- \[ \] <!-- rebase-check -->/- [x] <!-- rebase-check -->}"
     scripts/ci/wait-for-checks.sh N
     ```

     Do not push to a `renovate/*` branch yourself: Renovate then treats the branch as edited by
     someone else and stops updating it.
   - **Record the guardrail checklist as a comment** on the pull request — not in its body, which
     Renovate rewrites — with the changelog finding in one or two lines and each of the four
     guardrails as *not touched*.
   - **Rebase-merge** with `sha=<the head that went green>`, and **read `main`'s run**
     ([`merge-checklist.md`](merge-checklist.md) § 4–5). A red `main` goes to the project
     conversation at once.
   - Each merge puts every other Renovate pull request behind `main` again, so take the next one only
     after this one has merged, and bring it up to date first.

   A pull request whose CI is red is not merged: say in the reply what fails. The thread changes no
   application code to make an update pass; a fix that needs code is reported, and the project
   conversation files an issue for it.

5. **Reply in at most 5 lines**: what merged (numbers), what is escalated and why (one reason each),
   what is red. The project conversation takes the escalations to the owner, one at a time; once he
   decides, a thread merges or closes that pull request on his word.

The thread never closes or edits a Renovate pull request other than ticking its checkbox, never edits
`renovate.json`, and never deploys. A merged dependency update reaches the owner's instance only with
the next release ([`release-versioning.md`](release-versioning.md)).
