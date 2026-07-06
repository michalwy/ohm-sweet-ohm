# ADR 0025 — Continuous build allocation and incoming-stock allocation

**Status:** Accepted
**Date:** 2026-07-05

## Context

Issue #185 asks that `setBuildLineAllocations`/`setBuildAllocations` ([ADR 0023](0023-split-allocation-across-parts.md))
allow a build's allocation plan to draw from incoming stock (`onOrderQty`,
`inProductionQty` — [ADR 0021](0021-builds-and-stock-state-transitions.md)'s
"planned and in-production quantity" extension, #184), not only from physical
`currentStock − reservedQty`, so a user can plan a build ahead of parts
arriving. The hard guard at `startBuild` (real `currentStock` must cover the
requirement) is explicitly meant to stay as-is — only the *plan* should be able
to draw on incoming stock, not the *start*.

Working out where that relaxed check belongs surfaced a real usability problem
with the existing `CREATED → ALLOCATED → STARTED → …` state machine: editing an
allocation after the build reaches `ALLOCATED` requires `reopenBuild` (back to
`CREATED`), edit, then `markBuildAllocated` again. For incoming-stock entries
this round-trip becomes routine — every time a PO or sub-build lands, the user
would have to reopen, add a location, and re-allocate before even attempting to
start. This ADR therefore makes two changes together, because the second is
what makes the first usable.

## Decision

### 1. Collapse `CREATED`/`ALLOCATED` into one continuously-editable `ALLOCATING` state

```prisma
enum BuildState { ALLOCATING STARTED IN_PROGRESS COMPLETED CANCELLED }
```

- A build enters `ALLOCATING` immediately on creation (replacing the old
  `CREATED` default) and stays there — editable, with no lock and no
  "reopen" step — until `startBuild` moves it directly to `STARTED`. The old
  `ALLOCATED` state and the `markBuildAllocated`/`reopenBuild` transitions are
  removed entirely.
- `Part.allocatedQty` (soft) and the output part's `plannedQty` are now
  maintained **live** instead of being applied in one bulk step by a manual
  "Allocate" click:
  - `createBuild` increments `plannedQty` by `targetQuantity` immediately, and
    `allocatedQty` for whatever the greedy pre-fill produced.
  - `setBuildLineAllocations`/`setBuildAllocations` diff a line's (or the whole
    build's) previously-persisted `BuildLineAllocation` rows against the new
    ones and apply the per-part `allocatedQty` **delta** in the same
    transaction that replaces the rows — so every save is immediately
    reflected, with no separate allocate step and no risk of double-counting
    across repeated saves.
  - `startBuild` is unchanged in effect (`allocatedQty → reservedQty`,
    `plannedQty → inProductionQty`) but now transitions directly from
    `ALLOCATING`.
  - `cancelBuild`'s release logic collapses from a three-way branch
    (`ALLOCATED`/`CREATED`/other) to two-way: `ALLOCATING` always releases
    `allocatedQty` + `plannedQty` (since both are now always live from
    creation); `STARTED`/`IN_PROGRESS` releases `reservedQty` (un-assembled
    portion) + `inProductionQty`, unchanged from before. `deleteBuild` on an
    `ALLOCATING` build must release the same holds before deleting, for the
    same reason.
  - `getAllocationWarnings` (the read-only re-check of `startBuild`'s hard
    guards, surfaced on the detail view) and `getBuildPickList` now key off
    `ALLOCATING` instead of `ALLOCATED` — both are meaningful the whole time a
    build is being planned, not just after a one-time "Allocate" click.
- No new schema field or "readiness" flag was needed for any of this — the
  existing `BuildLineAllocation`/`Part` fields and `isFullyAllocated` check
  already carry enough information (see below).
- No production deployment exists yet, so the migration simply deletes all
  existing `Build` rows (and dependents) rather than writing a
  value-preserving enum migration, matching the precedent set by
  [ADR 0024](0024-per-unit-build-assembly.md).

### 2. Allocate against incoming stock, but never start against it

- The allocation-time stock guard in `setBuildLineAllocations`/
  `setBuildAllocations` changes from `currentStock − reservedQty` to
  `currentStock − reservedQty + onOrderQty + inProductionQty` per part —
  still netted against the build's other lines/entries exactly as before (no
  cross-build netting of incoming stock either, matching ADR 0023's existing
  "allocation is soft, two builds can both plan against the same stock"
  stance, now extended to incoming stock too — no cap on how much of a line
  can be incoming, per product decision).
- The per-`(part, location)` physical-balance check is unaffected: it already
  only evaluates entries that carry a `sourceLocationId`, and incoming stock
  structurally has no location yet (a PO hasn't been assigned a receiving bin,
  or a sub-build's output part has no location until it completes) — an
  incoming-backed `BuildLineAllocation` entry simply has `sourceLocationId:
  null`.
- **This is also the whole answer to "when is a build ready to start."**
  `isFullyAllocated`/`startBuild` already require every entry to have a
  `sourceLocationId` to count as complete (ADR 0023). An incoming-backed entry
  therefore already keeps its line — and so the build — from being
  start-ready, with zero new logic: once the incoming stock physically lands,
  the user edits the entry to add a real location (an ordinary save, no
  reopen needed under the state-machine change above) and the build becomes
  start-ready.
- `startBuild`'s hard guard is completely untouched: `currentStock −
  reservedQty` only, never `onOrderQty`/`inProductionQty`.

### UI

- The allocation editor lets an entry's location be left unset — labeled
  "Incoming" — instead of requiring a location for every entry. Match
  candidates and existing allocations report on-hand and incoming availability
  as two separate numbers (`onHandAvailableQuantity`/`incomingAvailableQuantity`)
  instead of one blended figure, so the editor can badge each entry "On hand"
  vs "Incoming" and validate against the combined pool.
- A two-tone progress bar (dark green = on-hand-backed share of the
  requirement, light green = incoming-backed share, adjacent segments on one
  bar) replaces the old allocated/assembled bar while a build is `ALLOCATING`,
  both per line and aggregated for the whole build.
- The allocation-warnings banner and the "Apply"/"Start" actions are visible
  continuously through the `ALLOCATING` phase; the old "Allocate"/"Reopen"
  buttons are gone.

## Consequences

- `BuildState` has one fewer value; every state-label map, permission gate,
  and pick-list/assembly-list gate keyed off `CREATED`/`ALLOCATED` now keys
  off `ALLOCATING`. `buildTransitions.ts`'s `isAllocationEditable` helper is
  removed as redundant (`state === "ALLOCATING"` is now the only editable
  check, and every write path already inlines it).
- `getPartBuildAllocations` (the part-detail "which builds hold this part"
  view, #184) now reports `ALLOCATING` builds the moment they have any
  allocation entries, rather than only after an explicit allocate step.
- Cancelling or deleting an `ALLOCATING` build always releases its live
  `allocatedQty`/`plannedQty` holds — there is no longer a "not yet applied"
  window to rely on.
- ADR 0021's state-machine diagram and ADR 0023's "must reopen to edit" rule
  are both superseded by this ADR; their stock-guard, split-allocation, and
  per-unit-assembly content is otherwise unchanged.
- Shortage analysis remains out of scope (refs #9).
