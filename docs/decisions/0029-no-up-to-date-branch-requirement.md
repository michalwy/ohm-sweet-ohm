# ADR 0029 — `main` No Longer Requires a Branch to Be Up to Date Before It Merges

**Status:** Accepted
**Date:** 2026-11-24

Decided by the owner on 2026-11-24 in the project conversation and recorded in #256: set
`strict_required_status_checks_policy: false` on the `main` ruleset, through the ruleset artifact and
the drift check, with this ADR; make a release require green CI on `main` for the commit it tags.

## Context

`main`'s ruleset (`docs/agents/branch-protection.md`) required its four status checks to be green
**with the branch up to date with `main`**. Since 2026-11-23 the repository is worked by up to three
cloud threads at once (#247), each merging its own pull request. Every merge put every other open
pull request behind `main`, and the strict policy then made each of them rebase and wait for a full
CI run again — about 17 minutes — before it could merge, so parallel threads queued behind one
another and the CI they spent mostly re-confirmed what was already green.

What strict checks bought is that the required checks ran on the exact tree that lands on `main`.

## Decision

- The `main` ruleset's `required_status_checks` rule has
  `strict_required_status_checks_policy: false`. Everything else stays: the same four required
  checks, pull request only, rebase merges only, linear history, no force-push or deletion, no bypass
  for anyone. The artifact `.github/rulesets/main.json` records it, and `Ruleset drift` compares it
  with the live ruleset as before.
- A pull request that is merely behind `main` merges on the green CI of its own head. It is rebased
  and re-verified only when it conflicts, because GitHub cannot rebase-merge it then.
- **The safety net is `main`'s own CI**, which runs on every push to `main`:
  - the thread that merged reads that run (`docs/agents/merge-checklist.md` § 5), and a red `main`
    goes to the project conversation at once and is fixed forward in its own issue;
  - **a release requires a green CI run on `main` for the exact commit it tags**
    (`docs/agents/release-versioning.md` § *The release gate*). `release.yml` already refuses a
    commit whose push run on `main` is missing, cancelled or red, so nothing in the release workflow
    changes; what changes is that this check is now the gate for what reaches the Pi, rather than a
    second look at a tree the pull request had already tested.

## Consequences

- Parallel pull requests no longer serialise behind one another; a merge costs the others nothing
  unless it conflicts with them.
- Two pull requests that are each green can break `main` together (a renamed function and a new
  caller of the old name, two migrations, a test that depends on both). That shows up first in
  `main`'s run after the second merge, not in either pull request. `main` can be red for a while;
  the release gate keeps such a commit off the Pi.
- CI cancels an in-progress run on the same ref, so when merges land in quick succession only the
  latest commit's run on `main` completes. It contains the earlier commits, so it checks them, but an
  earlier commit itself has no green run and cannot be released — release the later one.
- The live ruleset is changed by the owner in GitHub's settings: an agent's credentials cannot write
  it. Until the artifact and the live ruleset agree, `Ruleset drift` is red — the one window
  `branch-protection.md` calls legitimate.

## Alternatives considered

- **Keep strict checks and accept the queue.** Rejected by the owner: about 17 minutes of CI per
  open pull request per merge, with three threads running.
- **A merge queue.** GitHub's merge queue checks the combined tree without making authors rebase,
  but it is driven through GraphQL and auto-merge, which cloud threads cannot use, and it would be a
  further ruleset and CI-trigger change.
