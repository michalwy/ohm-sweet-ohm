# Branch protection and CI gates

## The ruleset

`main` is protected by a repository ruleset (adopted 2026-09-07). It requires a pull request with
**0 approvals**, allows **rebase merges only**, requires **linear history**, blocks force-push and
branch deletion, and requires these status checks to be green on the pull request's head:

- `Static checks`
- `Unit tests`
- `Integration tests`
- `Closing reference check` — required since 2026-09-18 (see below)

**There are no bypass actors, including the repository owner.** This was chosen knowingly: a gate its
own author can step around does not gate anything, and the whole flow in `collaboration.md` depends
on there being a real moment before merge. Adding or removing a required context is a ruleset change
and therefore the user's call.

### Why the branch need not be up to date with `main`

The ruleset required it (`strict_required_status_checks_policy: true`) until the owner turned it off
on 2026-11-24 (#256, [ADR 0029](../decisions/0029-no-up-to-date-branch-requirement.md)). With three
threads in parallel, every merge put every other open pull request behind `main`, and each then had
to rebase and wait for a full CI run (~17 minutes) again before it could merge. Now a pull request's
required checks are green against the `main` it was cut from, and two pull requests that are each
green can still break `main` together. What catches that instead:

- **CI runs on every push to `main`**, and the thread that merged reads that run
  ([`merge-checklist.md`](merge-checklist.md) § 5); a red `main` is fixed forward in its own issue.
  CI cancels an in-progress run on the same ref, so when merges land in quick succession only the
  latest commit's run completes — it covers the earlier ones, since it contains them.
- **A release requires a green CI run on `main` for the exact commit it tags**, and the release
  workflow refuses otherwise ([`release-versioning.md`](release-versioning.md) § *The release gate*),
  so a combination nobody checked never reaches the Pi.

A conflict still has to be rebased away: GitHub cannot rebase-merge a branch that conflicts.

### Why the other jobs are not required

Some *cannot* be required, because they do not run on every pull request, and a required check whose
job never runs blocks that pull request forever: `Build container image (…)` and
`Publish container image` (release tags only),
`renovate/stability-days` (Renovate pull requests only), and the `Site` workflow jobs (pushes to
`main` only).

`Container image build check` (#317, the owner, 2026-11-25) runs on every pull request and every
push to `main` — it builds the Dockerfile's `runner` target for `linux/amd64` without pushing, so a
broken Dockerfile fails a pull request instead of a release — but it is **not required** yet: making
it so is a ruleset change, still the owner's call. Until then `scripts/ci/wait-for-checks.sh` does
not wait for it, so read its result on the pull request before merging, and do not merge one where
it is red.

`Ruleset drift (advisory)` *could* run on every pull request and deliberately is not required — see
the drift check below.

### Why `Closing reference check` is required

It was advisory until 2026-09-18 and was made required by the user when this repository adopted its
current working model. It runs on every pull request, Renovate's included, so it cannot strand one;
and the mistake it catches — a closing keyword that makes GitHub close an issue at merge time, before
anyone verified the work — is one that every convention outside this repository teaches, so it has to
be enforced rather than remembered. Pull requests whose last CI run predates the job (it was added
2026-09-07) have no result for it and need a fresh push (a rebase) before they can merge.

## The artifact and the drift check

The ruleset is checked in at `.github/rulesets/main.json`, and `scripts/check-ruleset-drift.sh` exits
1 with a diff when the artifact and GitHub disagree (`--write` adopts the live state). The gate lives
in GitHub's settings, where a change is unversioned, unreviewed, and leaves no trace in git — the
artifact is what makes a change to the gate reviewable. It also catches parameters GitHub sets on its
own: creating this ruleset silently added `require_extra_approval_for_unattributed_changes: true`,
which with 0 required approvals in a solo repository is a deadlock, since an author cannot approve
their own pull request.

The check finds the gate by **what it gates, not what it is called**: every ruleset whose target is a
branch and whose conditions cover the default branch. What gates a branch is the union of every
ruleset matching it, so selecting by name would make the artifact's completeness depend on a string —
an organisation ruleset called anything else would change no field, produce no diff, and simply never
be mentioned. **A second match is drift**, whatever it claims to target, because it can add
requirements or bypass actors this repository never reviewed. Nothing can inherit here today only
because the account owner is a `User` rather than an organisation; that is a fact about the account,
not about the check, and it expires the day this repository moves.

**A red drift check is legitimate for exactly one window**: between a deliberate change to the
ruleset and the commit that updates the artifact to match. Outside that window a red check means
either someone changed the gate without recording it, or GitHub changed it by itself. Changing the
ruleset is therefore not finished until the artifact lands — and whoever changes the platform state
owns finding every place that describes it, not only this file.

### When it runs, and why it is never required

The check runs **daily on a schedule** (`.github/workflows/ruleset-drift.yml`) and **advisory on pull
requests** that touch the artifact, the workflow or the script. The schedule has fired daily since
2026-09-08.

It is **never a required context**, and that is a decision rather than an omission: the event it
exists to catch — GitHub writing to the ruleset unasked — produces no pull request, so only the
schedule can see it; and as a required context the legitimately-red window above would freeze every
unrelated pull request, with no bypass for anyone.

### The credential

The ruleset's `bypass_actors` field is invisible to `GITHUB_TOKEN`: without administration read,
GitHub returns a reduced view in which it is missing. "No bypass for anyone" is the property the check
most needs to watch, so a caller that cannot see it **fails** — the check never passes on a partial
comparison.

- CI reads the ruleset with the **`RULESET_READ_TOKEN`** secret: a personal access token with
  administration read, created by the user on 2026-09-08. **It does not expire** (confirmed by the
  user, 2026-09-18). Only the user can rotate or replace it. Nothing else in the repository records
  that it exists, which is why this paragraph does.
- The script prints the token's expiry on every run. `CREDENTIAL: no expiry reported` means "does not
  expire **or** GitHub discloses none" — the header alone cannot tell those apart; the user's
  confirmation above is what settles it.
- `GH_TOKEN` falls back to `github.token` on purpose. If the secret is deleted, the run still reaches
  the comparison, finds `bypass_actors` missing, and fails with a message about coverage — rather than
  dying on an authentication error that says nothing. An **expired or revoked** token behaves
  differently again: a non-empty secret the API rejects, so the run fails at the fetch.
- There used to be an `--allow-unverifiable` flag for declaring the field unverifiable, for a project
  that did not yet have the credential. Once the token existed nothing passed it, and it was removed
  on 2026-09-18 rather than kept as an unexercised path.

## Renovate inside the gate

Renovate opens pull requests inside the same gate and has no bypass, so its automerge (dev-tooling
patch/minor only, `renovate.json`) fires only on green required checks, and `automergeStrategy` is
`rebase` because the repository allows no other merge method. Everything else Renovate opens waits for
the Monday dependency-review thread (`dependency-review.md`), and Renovate rebases those pull requests
only when they conflict with `main`. Watching it is part of every backlog review (`backlog-review.md`).
