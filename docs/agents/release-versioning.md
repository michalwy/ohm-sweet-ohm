# Release versioning

A release-manager session has no issue, no branch, no commit; it changes nothing in the repository.
It produces a tag, a GitHub Release and the published container image. Read this file with
`git show origin/main:docs/agents/release-versioning.md` — the session never cuts a branch, so its
worktree may be stale. Only a session the user opens for it may release. Its title is
`Release: X.Y.Z`, then `[DONE] Release: X.Y.Z`.

The project favours **small, frequent releases** over rare large ones.

## Steps

1. **`gh release list` fresh.** Never trust memory, local tags, or an earlier check in the same
   session — another session can cut a release at any time.
2. **Review what merged since the last tag** (`git log <last-tag>..origin/main`). Any `feat:` →
   minor; only `fix:`/`chore:`/`docs:`/`ci:` → patch. Never major unless the user asks for one. If a
   release does not seem warranted (nothing shippable, or only process work), **ask** — do not skip
   silently and do not proceed silently.
3. **Read `main`'s CI run for the exact commit** — colour and each job's conclusion:
   ```bash
   git rev-parse origin/main                      # full 40-char SHA; the short one returns []
   gh run list --branch main --commit <full-sha> --workflow CI --json databaseId,conclusion
   gh run view <id> --json jobs --jq '.jobs[] | "\(.conclusion)  \(.name)"'
   ```
   A cancelled run means nobody checked that commit (CI cancels in-progress runs per ref).
4. **Tag the merged commit on `main`** and push the tag: `git tag vX.Y.Z <full-sha>`,
   `git push origin vX.Y.Z`. The `main` ruleset covers branches, not tags, so the push is allowed.
5. **Read the tag's own CI run.** A `v*` tag runs every suite — CI has no path filters — and
   `Publish container image` needs `Static checks`, `Unit tests` and `Integration tests`, so it
   publishes nothing unless they pass. If the run is red: no Release; delete the tag
   (`git push origin :refs/tags/vX.Y.Z` and locally); the fix goes through a PR; then re-cut.
6. **Create the GitHub Release** with a human-written description — never bare `--generate-notes`
   output. Group changes (Highlights / Fixes / Other), one plain-English line per PR or commit with
   its reference number, and keep the auto-generated "Full Changelog" compare link at the end:
   `gh release create vX.Y.Z --title vX.Y.Z --notes-file <file>`.
7. **Check the image**: the publish job pushed `ghcr.io/michalwy/ohm-sweet-ohm` as `X.Y.Z`, `X.Y`,
   `sha-…` and `latest`. `latest` moves by itself (`flavor: latest=true`), and self-hosted
   deployments track it — there is no separate `latest` git tag to move.

## Where the version comes from

**No version-bump commit.** The git tag is the version: the publish job passes it to the image as the
`OSO_VERSION` build argument, and the app shows it through `getAppVersion()` in `src/lib/version.ts`
(non-release builds show `dev`). The `version` field in `package.json` is read by nothing.
