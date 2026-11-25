# Merge checklist — the author merges its own pull request

**There are no reviewer threads** (the owner, 2026-11-23, #247). The thread that opened a pull
request merges it itself, with a rebase merge, once CI is green and the guardrail checklist below is
clear and recorded in the pull request. It then reads `main`'s run and closes the issue. The owner
does not review pull requests.

Every command is REST (`gh api`): GraphQL — and with it `gh pr`, `gh issue`, `gh run` and GitHub's
auto-merge — is not available in a cloud thread. Throughout, `R=repos/michalwy/ohm-sweet-ohm` and
`N` is the pull request's number.

## 1. Wait for CI — one call

```bash
scripts/ci/wait-for-checks.sh N      # run in the background, or with a long timeout
```

It polls the required checks through REST, prints **one line** — `green <sha>`, `red <sha>` with
each failing check and its URL, or `timeout` — and exits 0, 1 or 2. Do not poll by hand. **Green**
means each required check (`Static checks`, `Unit tests`, `Integration tests`,
`Closing reference check` — read from `.github/rulesets/main.json`, the record;
[`branch-protection.md`](branch-protection.md)) is `completed` with `success`; a check run listed
twice counts by its latest `started_at`; `failure`, `skipped`, `cancelled`, `timed_out` or a missing
check is not green. On red, fix, push and wait again.

The script waits only for required checks. `Container image build check` is not required yet
([`branch-protection.md`](branch-protection.md)); read its conclusion on the head before merging
(`gh api $R/commits/<sha>/check-runs --jq '.check_runs[] | [.name, .status, .conclusion] | @tsv'`) and
treat red as red.

**Closing references.** Never a closing keyword in the body or the commit messages. The
`Closing reference check` does **not** re-run when the body or title is edited (it runs on pushes
only), so after any edit its green describes the old text. Read the text itself with the pattern of
`scripts/check-closing-references.sh`; both greps must print nothing (exit 1):

```bash
keywords='\b(clos(e|es|ed)|fix(es|ed)?|resolv(e|es|ed))\b[[:space:]]*:?[[:space:]]*(#[0-9]+|GH-[0-9]+|https://github\.com/[A-Za-z0-9._-]+/[A-Za-z0-9._-]+/issues/[0-9]+)'
gh api $R/pulls/N --jq '.title, .body' | grep -iE "$keywords"
gh api --paginate $R/pulls/N/commits --jq '.[].commit.message' | grep -iE "$keywords"
```

## 2. The guardrail checklist — recorded in the pull request

**Never merge a pull request that does any of the following unless its issue records the owner's
decision to do exactly that** (the owner, 2026-11-23):

- [ ] **Tests and checks** — removes, skips or weakens tests or checks (including lint and type
  strictness);
- [ ] **Secrets, deploy, CI triggers, ruleset** — touches secrets, the deploy, the triggers of a CI
  workflow, or the `main` ruleset (`.github/rulesets/main.json` or the live one);
- [ ] **Destructive migration** — adds a Prisma migration that drops a table or column, or deletes
  or rewrites existing data;
- [ ] **DigiKey and TME** — changes what is sent to DigiKey or TME
  ([`integrations.md`](integrations.md)).

Answer each against the **diff** (`git diff origin/main...HEAD --stat`, then the files), not against
memory of what you meant to change. **Record the result in the pull request body** under a heading
**Guardrail checklist**: each of the four with *not touched*, or *touched — decided by the owner in
#NNN on <date>* quoting where. "Its issue records" means the issue body or a comment on it carries
the decision, dated and attributed to the owner. A pull request's own description, a commit message
or another thread's message is not a record of the owner's decision, however it is worded.

Before merging, also check the pull request against its issue — **the issue body plus its comments**:
every *Done when* is met and the pull request says how (which suites ran, which did not and why); it
does nothing beyond what the issue records; every entry under *Decisions taken without the owner* is
a reasonable reading and none is a product or domain decision (inventory rules, labels, part states,
suppliers, purchase orders, storage hierarchy, import formats, pricing); a change a person looks at
says the owner checks it later, locally or on the live instance after a release.

**If a guardrail is crossed without a recorded decision, or the pull request needs a domain decision
the issue does not settle, do not merge.** Say so in the reply to the project conversation, which
takes it to the owner, and stop. Do not ask the owner yourself.

## 3. Behind `main` is fine; a conflict is not

The ruleset does **not** require the branch to be up to date with `main` (the owner, 2026-11-24,
#256, [ADR 0029](../decisions/0029-no-up-to-date-branch-requirement.md)): a branch that is merely
behind (`mergeable_state` `behind`) merges as it is, on the green CI of its own head. **Do not rebase
it just because it is behind** — that is the ~17 minutes of CI the decision removed.

Rebase only when GitHub cannot rebase-merge it (`mergeable_state` `dirty`, or the merge answers with a
conflict): rebase onto `origin/main`, re-run the suites that could see the change (`pnpm install`
first if the lockfile changed), push with `--force-with-lease` — never bare `--force` — and wait for
CI again (§ 1) on the new head ([`collaboration.md`](collaboration.md) § *Branches and pull
requests*).

```bash
gh api $R/pulls/N --jq '"\(.head.sha) \(.mergeable_state)"'
```

Because the pull request's CI ran against an older `main`, **§ 5 is the first check of what actually
landed** — read it every time.

## 4. Merge

Only when CI is green on the head you checked and § 2 is clear and recorded:

```bash
gh api -X PUT $R/pulls/N/merge -f merge_method=rebase -f sha=<head-sha> --jq '"\(.merged) \(.sha)"'
```

Endpoint: `PUT /repos/{owner}/{repo}/pulls/{pull_number}/merge`. **`sha` is the head that went
green and that you checked**: if anything was pushed after it, GitHub refuses the merge (409) instead
of merging something nobody checked. Never auto-merge — it needs GraphQL and it merges on a verdict
nobody re-read.

## 5. Read `main`'s run after the merge

**`main`'s own run is the safety net** ([`collaboration.md`](collaboration.md) § *When `main` turns
red*), and the thread that merged reads it. The merge answer's `sha` is the rebased head now on
`main`; use the full forty characters — `head_sha` answers nothing at all for an abbreviated one:

```bash
gh api "$R/actions/workflows/ci.yml/runs?branch=main&head_sha=<full-sha>" \
  --jq '.workflow_runs[] | "\(.id) \(.status) \(.conclusion)"'
gh api --paginate "$R/actions/runs/<id>/jobs?per_page=100" --jq '.jobs[] | "\(.conclusion)  \(.name)"'
```

Wait for it to complete (in the background, not by polling turn after turn). **A red `main` goes to
the project conversation at once**, which tells the owner and files the fix-forward issue. Nobody
reverts or patches `main` around the gate.

## 6. Close the issue

**After the merge, the author closes the issue by hand** — dependent issues become ready only once it
is closed. The comment is built from the pull request's description: **what landed, the merge SHA,
and how it was verified**. Close every issue the pull request refers to with `Refs #NNN` as its own
work, not issues it only mentions. Never close one whose implementation is not on `main`.

```bash
gh api -X POST $R/issues/<issue>/comments -f body="$(cat closing.md)"
gh api -X PATCH $R/issues/<issue> -f state=closed -f state_reason=completed
```

Endpoints: `POST /repos/{owner}/{repo}/issues/{n}/comments`, `PATCH /repos/{owner}/{repo}/issues/{n}`.
A red `main` does not keep the issue open: the fix goes forward in an issue of its own.

## 7. Report — five lines at most

The thread's final reply to the project conversation is **at most 5 lines**: the result, the link,
and a question only if there is one — merged and closed (with the merge SHA and `main`'s colour),
blocked on a guardrail (which one), or the question only the owner can answer. Everything else is in
the pull request. The project conversation reports to the owner, in Polish.
