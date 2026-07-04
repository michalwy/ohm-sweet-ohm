# ADR 0024 — Per-unit build assembly tracking

**Status:** Accepted
**Date:** 2026-07-04

## Context

[ADR 0021](0021-builds-and-stock-state-transitions.md) tracks assembly per
designator: `BuildDesignatorAssignment.quantity` equals the whole run's unit
count for a `(designator × part)` pair, and `assembledQuantity` is a single
running counter incremented as assembly happens, in no particular order
relative to individual physical units. [ADR 0023](0023-split-allocation-across-parts.md)
refined the grain to `(designator × part)` to support split allocation, but a
single designator's split (e.g. `R5` = 3 Yageo + 2 Royal Ohm across a 5-board
run) still has no concept of *which* unit got which part.

Issue #168 requires per-unit ("board") tracking: for a build with
`targetQuantity > 1`, the user needs to see "unit 2 of 3 is fully assembled" and
know which part went into which designator **on that specific unit**, not just
an aggregate count across the whole run.

## Decision

Refine `BuildDesignatorAssignment` again, to a `(designator × unit)` grain,
rather than adding a parallel event-log table. Each row now represents exactly
one physical unit's designator, so the numeric `quantity`/`assembledQuantity`
counters collapse to a single boolean.

### Data model

```prisma
model BuildDesignatorAssignment {   // one row per (designator, unit) — the assembly ledger
  buildLineItemId  String
  designator       String
  unitIndex        Int              // 1..build.targetQuantity
  partId           String?          // set by distribution at start
  sourceLocationId String?
  assembled        Boolean  @default(false)
  assembledAt      DateTime?

  @@unique([buildLineItemId, designator, unitIndex])
}
```

`quantity` and `assembledQuantity` are removed. There is no production
deployment yet, so the migration simply deletes all existing `Build` rows
(cascading to their line items, allocations, and assignments) instead of
backfilling the old shape.

### Distribution

`distributeAllocations` (`src/lib/buildAllocation.ts`), run once at `startBuild`,
now emits one row per `(designator, unit)` instead of grouping consecutive units
of the same part into a single row: for each designator it loops `unitIndex`
from `1` to `targetQuantity`, consuming one unit at a time from the line's
allocation entries in order. This is the same "consume from the designator's
allocated part/location entries in order" behavior as before — just at unit
grain instead of batch grain. `BuildLineAllocation` (the editable allocation
plan) and its per-line editing semantics are unchanged.

### Assembly and override

- `assembleDesignator` now assembles exactly one row (one unit's designator):
  issue 1 unit from the row's part/location, decrement `reservedQty` by 1, set
  `assembled = true` (and `assembledAt`). The build still auto-completes when
  every row across every line is assembled — same semantics as ADR 0021/0023,
  just derived from counting boolean rows instead of summing quantities.
- A new `assembleBuildUnit` assembles every not-yet-assembled row for one
  `unitIndex` across all of the build's lines in a single transaction — the
  "assemble this whole board" convenience the per-unit UI needs.
- `reassignDesignatorAssignment` is unchanged in shape: it already overrides a
  single not-yet-assembled row by id. The row now happens to represent one
  physical unit instead of a batch, so overriding a designator's part now
  naturally applies to a single unit rather than the whole run.
- A unit is complete when all of its designators (across all lines) are
  assembled; the build completes when all units are complete — the same
  overall completion rule as before, just derived from a finer-grained record.

### UI

The build detail assembly view becomes unit/board-grid-primary: a grid of
`targetQuantity` unit chips (not started / in progress / complete), where
selecting a unit shows that unit's designators to assemble or reassign. The
existing per-line allocation editor is unaffected — it still edits
`BuildLineAllocation` before `startBuild`.

## Consequences

- The state machine, `allocated`/`reserved`/`assembled` semantics,
  `availableQty`, cancellation (assembled parts never reversed), and the
  location-based consumption primitive from ADR 0021 are all unchanged. Only
  the assignment ledger's grain changed, again.
- The build list's aggregate progress (`unitsTotal`/`unitsAssembled`) is
  unchanged in meaning — still "assembled rows vs total rows" — only now
  counted as booleans instead of summed quantities.
- Per-unit part traceability (which part went into which unit's designator) is
  now a direct property of each row, rather than reconstructible only from
  ordering assumptions.
- Shortage analysis remains out of scope (refs #9).
