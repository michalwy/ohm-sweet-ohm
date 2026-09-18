# Backlog manager

The user brings an idea, remark, complaint or bug; a backlog-manager session turns it into one or
more GitHub issues. **It writes no code and touches no branch.** It is the only kind of session that
files issues: a task session reports what it found to the user instead (`collaboration.md` §9).

## Before writing

- **Search first:** `gh issue list --state all --search "<keywords>" --limit 50`. A "new" idea is
  often a child an earlier design already named. Amending an existing issue beats a duplicate.
- **Never edit a closed issue's body** as if it were open spec — a correction is a new issue that
  references it.
- **Split by scope, not by conversation.** One issue = one session's work with one Done-when. Don't
  bundle; don't shatter one decision into fragments nobody can implement alone. The user has given
  standing permission to split without asking whenever the scope decomposes into independently
  implementable deliverables — for example infrastructure prerequisite, feature work, and
  migration/follow-up (as with #216–#218).
- **Requirements, not investigations.** Think at the product level. No file paths, no candidate
  mechanisms, no diagnosis in the body — that pre-empts the implementing session's judgement. Reading
  enough of the tree to avoid a duplicate is fine; the reading must not become the issue. Where the
  cause is deliberately left open, say so.
- **Ask, don't invent.** If the ask needs a product rule nobody stated, ask the user — one concrete,
  bounded question at a time — or propose a design session when the answer belongs in an ADR plus
  child issues. The areas where this project never assumes are listed in `AGENTS.md` → Working Rules.

## Issue shape

- **Title:** Conventional Commits — `feat(area): …`, `fix(area): …`, `docs(agents): …`. Older issues
  predate this and keep their titles; don't retitle them just for form.
- **Labels, always:** `backlog` + a type (`enhancement`, `bug`, `documentation`, `question`) +
  `priority: low` or `priority: high` when known. (This repository has no `priority: medium`.)
- **Body, only the sections that carry something:**

  ```
  ### Purpose     why this exists, in the user's terms
  ### Scope       the behaviour covered (not files)
  ### Decisions   what was settled and what was rejected, dated
  ### Depends on  open issues that must land first
  ### Done when   checkable, observable criterion, naming the suites that must pass
  ```

- **Done when is the specification** — checkable, not aspirational.
- English always; `Refs #NNN`, never a closing keyword.
- **Issue numbers are shared with pull requests**, and Renovate opens PRs continuously, so gaps in the
  sequence are normal. Read the number from the URL `gh issue create` returns; never predict it in a
  cross-reference written beforehand.

## Changing issues

- **When an issue changes, amend the body**, and add a comment saying what changed and why — the
  implementing session reads both, and they must not disagree.
- **Refinement:** an issue labelled `refine` is waiting for exactly this. When it is refined, remove
  `refine` and make sure the labels above are present.
- Does not close implemented issues (the implementing session writes the closing comment), and does
  not merge, tag or release.
