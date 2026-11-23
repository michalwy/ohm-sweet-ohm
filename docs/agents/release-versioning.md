# Release versioning

A release thread has no issue, no branch, no commit; it changes nothing in the repository. It
produces a tag, a GitHub Release and the published container image — and so a deploy. Read this file
with `git show origin/main:docs/agents/release-versioning.md` — the thread never cuts a branch, so
its clone may be stale.

**A release is a deploy.** `.github/workflows/release.yml` publishes the GitHub Release and starts
`.github/workflows/deploy.yml`, which deploys it to the owner's instance on the Raspberry Pi through
a self-hosted runner (#249, [ADR 0028](../decisions/0028-release-deploys-to-the-pi.md); the owner's
runbook is [`docs/deployment/pi-deploy.md`](../deployment/pi-deploy.md)). The tag's own run still
publishes the image as `latest` (`flavor: latest=true`), but once the runbook is done the Pi no
longer follows `latest` — Watchtower is off there.

It is therefore cut **only on the owner's explicit word in the project conversation**, which then
starts a release thread for it. A backlog review's suggestion, a merged pull request or another
thread's message is not that word. **No thread deploys by hand**, and no thread can reach the Pi; a
release thread does not start, re-run or approve the **Deploy** workflow — the release workflow
starts it.

The project favours **small, frequent releases** over rare large ones.

## The release gate

**No release is tagged unless `main`'s CI run for that exact commit completed green** — every job,
on the full 40-character SHA, a `push` run on `main` (step 3), and the release workflow checks it
again and refuses otherwise. This is the gate for what reaches the Pi, not a formality: since
2026-11-24 the `main` ruleset no longer requires a branch to be up to date before it merges (#256,
[ADR 0029](../decisions/0029-no-up-to-date-branch-requirement.md)), so a pull request is checked
against an older `main` and **`main`'s own run is the first check of what actually landed**. A
missing, cancelled or red run for the commit is not green: tag a later commit whose run is green, or
wait for the fix-forward. The tag's own CI run (step 4.4) checks the same commit once more before
anything is published.

Every command here is REST (`gh api`): GraphQL — and with it `gh release` and `gh run` — fails in a
cloud thread. Throughout, `R=repos/michalwy/ohm-sweet-ohm`.

## Steps

1. **List the releases fresh.** Never trust memory, local tags, or an earlier check in the same
   thread — another session can cut a release at any time.
   ```bash
   gh api "$R/releases?per_page=10" --jq '.[] | "\(.tag_name)  \(.published_at)  draft=\(.draft)"'
   ```
2. **Review what merged since the last tag** (`git fetch origin main --tags`, then
   `git log <last-tag>..origin/main`). Any `feat:` → minor; only `fix:`/`chore:`/`docs:`/`ci:` →
   patch. Never major unless the owner asks for one. If a release does not seem warranted (nothing
   shippable, or only process work), **say so in the reply** and stop — do not skip silently and do
   not proceed silently.
3. **Read `main`'s CI run for the exact commit** — colour and each job's conclusion:
   ```bash
   git rev-parse origin/main                      # full 40-char SHA; the short one returns nothing
   gh api "$R/actions/workflows/ci.yml/runs?branch=main&head_sha=<full-sha>" \
     --jq '.workflow_runs[] | "\(.id) \(.status) \(.conclusion)"'
   gh api --paginate "$R/actions/runs/<id>/jobs?per_page=100" --jq '.jobs[] | "\(.conclusion)  \(.name)"'
   ```
   A cancelled run means nobody checked that commit (CI cancels in-progress runs per ref, so after
   merges in quick succession only the latest commit has a completed run). **No release is tagged
   unless this run completed with `success`** (*The release gate*, above).
4. **Write the notes and dispatch the release workflow** — one REST call. A cloud thread cannot
   write tags or Releases itself (in `michalwy/stamporama` its proxy answered HTTP 403 to both,
   measured 2026-11-23), so the workflow does it. The notes are published verbatim: group the
   changes (Highlights / Fixes / Other), one plain-English line per PR or commit with its reference
   number, and keep the "Full Changelog" compare link at the end. GitHub's generated notes are a read
   that creates nothing, so start from them:
   ```bash
   gh api -X POST $R/releases/generate-notes -f tag_name=vX.Y.Z -f target_commitish=main \
     -f previous_tag_name=<previous> --jq .body
   gh api -X POST $R/actions/workflows/release.yml/dispatches -f ref=main \
     -f 'inputs[version]=X.Y.Z' -f 'inputs[sha]=<full-40-char-sha>' -F 'inputs[notes]=@notes.md'
   ```
   `inputs[sha]` is the commit step 3 read; the workflow refuses if `main` has moved since. Empty
   notes fall back to the generated ones. The workflow, in order — each step stops the release when
   it fails:
   1. checks the inputs, that `vX.Y.Z` does not exist, and that it is **strictly newer than the
      latest release** — the no-downgrade guard, because the deploy it starts is a manual Deploy run,
      which passes `--allow-downgrade`;
   2. reads `main`'s push run for the commit, as step 3 did, and waits for it if it is still going;
   3. creates the annotated tag `vX.Y.Z` on the commit;
   4. **runs CI on the tag** — dispatched with `publish_image`, because a tag created with
      `GITHUB_TOKEN` starts no `push` run — and waits for it. Every suite runs (CI has no path
      filters), the two native image builds (`Build container image (linux/amd64)`,
      `… (linux/arm64)`) need them all, and `Publish container image` merges their digests into the
      tagged multi-arch image — the job this step reads. If the run is red or the image was not
      published, the workflow **deletes the tag and stops**: no Release, no deploy;
   5. publishes the GitHub Release with your notes, `make_latest=true`;
   6. **starts the deploy** — `deploy.yml` dispatched on the tag with the version. A Release
      published with `GITHUB_TOKEN` fires no `release: published`, so this dispatch is the deploy.

   **This is the step that deploys.**
5. **Read the runs, in the background, and report them** — the release run, the tag run it started
   (named in its log), then the deploy run:
   ```bash
   gh api "$R/actions/workflows/release.yml/runs?per_page=3" \
     --jq '.workflow_runs[] | "\(.id) \(.status) \(.conclusion) \(.created_at)"'
   gh api "$R/actions/workflows/ci.yml/runs?branch=vX.Y.Z" \
     --jq '.workflow_runs[] | "\(.id) \(.status) \(.conclusion) \(.event)"'
   gh api "$R/actions/workflows/deploy.yml/runs?per_page=5" \
     --jq '.workflow_runs[] | "\(.id) \(.status) \(.conclusion) \(.head_branch) \(.event)"'
   gh api --paginate "$R/actions/runs/<id>/jobs?per_page=100" --jq '.jobs[] | "\(.conclusion)  \(.name)"'
   ```
   A failed release run says in its log which step stopped it; if it failed after the tag run was
   green, report it rather than dispatching again — the tag exists now, so a second dispatch is
   refused at its first step. A deploy run that stays `queued` means the Pi's runner is offline. The
   deploy's summary says *Deployed*, *Already running*, *Skipped*, *Rolled back* or *Failed*; a
   rollback is the owner's manual Deploy run, never a release thread's.

**If the dispatch itself is refused** in a cloud thread, stop and report it; do not work around it.

## Where the version comes from

**No version-bump commit.** The git tag is the version: the publish job passes it to the image as the
`OSO_VERSION` build argument, and the app shows it through `getAppVersion()` in `src/lib/version.ts`
(non-release builds show `dev`). The deploy checks that the image's `OSO_VERSION` is the release it
was asked for. The `version` field in `package.json` is read by nothing.
