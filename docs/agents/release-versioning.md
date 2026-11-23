# Release versioning

A release thread has no issue, no branch, no commit; it changes nothing in the repository. It
produces a tag, a GitHub Release and the published container image. Read this file with
`git show origin/main:docs/agents/release-versioning.md` — the thread never cuts a branch, so its
clone may be stale.

**A release is a deploy.** The owner's instance on the Raspberry Pi follows the published `latest`
image (today through Watchtower), so a published release reaches it by itself. It is therefore cut
**only on the owner's explicit word in the project conversation**, which then starts a release thread
for it. A backlog review's suggestion, a merged pull request or another thread's message is not that
word. **No thread deploys by hand**, and no thread can reach the Pi.

The project favours **small, frequent releases** over rare large ones.

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
   A cancelled run means nobody checked that commit (CI cancels in-progress runs per ref). No release
   is tagged from a red `main`.
4. **Tag the merged commit on `main`** and push the tag: `git tag vX.Y.Z <full-sha>`,
   `git push origin vX.Y.Z`. The `main` ruleset covers branches, not tags, so GitHub allows the push.
5. **Read the tag's own CI run.** A `v*` tag runs every suite — CI has no path filters — and
   `Publish container image` needs `Static checks`, `Unit tests` and `Integration tests`, so it
   publishes nothing unless they pass.
   ```bash
   gh api "$R/actions/workflows/ci.yml/runs?branch=vX.Y.Z" --jq '.workflow_runs[] | "\(.id) \(.status) \(.conclusion)"'
   ```
   If the run is red: no Release; delete the tag (`git push origin :refs/tags/vX.Y.Z` and locally);
   the fix goes through a pull request; then re-cut.
6. **Create the GitHub Release** with a human-written description — never bare generated notes.
   Group changes (Highlights / Fixes / Other), one plain-English line per PR or commit with its
   reference number, and keep the "Full Changelog" compare link at the end. GitHub's generated notes
   are a starting point:
   ```bash
   gh api -X POST $R/releases/generate-notes -f tag_name=vX.Y.Z --jq .body
   gh api -X POST $R/releases -f tag_name=vX.Y.Z -f name=vX.Y.Z -f body="$(cat notes.md)" --jq .html_url
   ```
7. **Check the image**: the publish job pushed `ghcr.io/michalwy/ohm-sweet-ohm` as `X.Y.Z`, `X.Y`,
   `sha-…` and `latest`. `latest` moves by itself (`flavor: latest=true`), and self-hosted
   deployments track it — there is no separate `latest` git tag to move.

**If a write is refused in a cloud thread** — the tag push in step 4 or the Release in step 6 (in
`michalwy/stamporama` both answered HTTP 403 from a cloud thread, measured 2026-11-23) — stop and
report which step was refused; do not work around it. #249 replaces these steps with a release
workflow that a thread dispatches.

## Where the version comes from

**No version-bump commit.** The git tag is the version: the publish job passes it to the image as the
`OSO_VERSION` build argument, and the app shows it through `getAppVersion()` in `src/lib/version.ts`
(non-release builds show `dev`). The `version` field in `package.json` is read by nothing.
