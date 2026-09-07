#!/usr/bin/env bash
#
# Fails when a pull request body, or any commit message in the branch, puts a
# GitHub closing keyword directly in front of an issue reference.
#
# Why: GitHub acts on those keywords at merge time and closes the issue before
# anyone has verified the work. There is no repository setting that turns this
# off, and every convention outside this repository says to write them, so the
# rule needs enforcement rather than everyone remembering it. This project
# writes `Refs #NNN` instead and closes issues by hand after verification.
#
# Both halves matter: on a rebase-merge repository the branch commits are
# replayed verbatim onto main, so a keyword in a commit message arms the close
# even when the pull request body is clean.
#
# Local use:
#   BASE_SHA=origin/main HEAD_SHA=HEAD ./scripts/check-closing-references.sh
# (PR_NUMBER is optional; without it only commit messages are checked.)

set -euo pipefail

KEYWORD='(clos(e|es|ed)|fix(es|ed)?|resolv(e|es|ed))'
REFERENCE='(#[0-9]+|GH-[0-9]+|https://github\.com/[A-Za-z0-9._-]+/[A-Za-z0-9._-]+/issues/[0-9]+)'
PATTERN="\\b${KEYWORD}\\b[[:space:]]*:?[[:space:]]*${REFERENCE}"

violations=0

check() {
  local label="$1" text="$2" hits
  hits="$(printf '%s\n' "$text" | grep -Ein "$PATTERN" || true)"
  if [ -n "$hits" ]; then
    echo "FAIL: ${label} contains a closing keyword in front of an issue reference:"
    printf '%s\n' "$hits" | sed 's/^/      /'
    violations=$((violations + 1))
  fi
}

if [ -n "${PR_NUMBER:-}" ]; then
  body="$(gh pr view "$PR_NUMBER" --json body -q .body)"
  check "pull request body" "$body"
fi

base="${BASE_SHA:-origin/main}"
head="${HEAD_SHA:-HEAD}"

if ! git rev-list "${base}..${head}" >/dev/null 2>&1; then
  echo "FAIL: cannot walk ${base}..${head} — is the full history fetched?"
  exit 1
fi

while IFS= read -r sha; do
  [ -n "$sha" ] || continue
  check "commit ${sha:0:8}" "$(git log -1 --format=%B "$sha")"
done < <(git rev-list "${base}..${head}")

if [ "$violations" -gt 0 ]; then
  cat <<'MSG'

Use `Refs #NNN` instead. The issue is closed by the lead session after it has
verified the work in the repository, not by GitHub at merge time.

To fix a commit message, rewrite it (`git rebase -i`) and force-push the branch.
MSG
  exit 1
fi

echo "OK: no closing keywords found in the pull request body or commit messages."
