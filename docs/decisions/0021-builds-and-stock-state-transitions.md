# ADR 0021 — Builds and Stock State Transitions

**Status:** Accepted
**Date:** 2026-06-30

## Context

> **Superseded by [ADR 0025](0025-continuous-build-allocation.md).** As of #185 the `created`/
> `allocated` states below are collapsed into one continuously-editable `ALLOCATING` state, with
> `allocatedQty`/`plannedQty` maintained live instead of applied by a manual "Allocate" transition.
> The stock-effect table's `created`/`allocated` rows and the "editable while `created` or
> `allocated`" rule are what changed; everything else on this page (reserved, in-production,
> completion, cancellation semantics) is unchanged.

Issue #63 (refs #9) introduces a **Build**: a concrete production run of a Design revision for
a target quantity. A build progresses through defined states, each driving inventory
transitions. This is the first feature that distinguishes **on-hand** stock from **allocated**
(soft) and **reserved** (hard) stock, and the first that consumes parts and produces a design's
output part as a side effect of a workflow.

Before this change the inventory model (ADR 0013, `src/server/inventory/entryMutations.ts`)
was strictly location-based: every `ISSUE`/`TRANSFER` carries a source location and each
per-location balance must stay non-negative. `Part` carried denormalized `currentStock`,
`plannedQty`, `onOrderQty` but had no notion of stock committed to future production.

The Design/Revision/BOM model (ADR 0019/0020) gives each revision a bill of materials of
**specs** (`BomLineItem` + attribute `BomMatcher`s) that resolve against live inventory; ADR
0020 explicitly deferred "allocation of concrete parts to individual designators" to the build
flow.

## Decision

### State machine

```
created → allocated → started → in_progress → completed
   └──────────┴──────────┴────────────┘ → cancelled
```

| State | Entry condition | Stock effect |
|---|---|---|
| `created` | build created | BOM snapshot frozen into build lines + per-designator rows; no stock change |
| `allocated` | every line has a part + source location | `Part.allocatedQty += required` per part (informational) |
| `started` | full allocation **and** `availableQty ≥ required` per part **and** each line's source-location balance covers its required qty | move allocated→reserved: `allocatedQty −= required`, `reservedQty += required` |
| `in_progress` | first designator marked assembled | per designator: `ISSUE` its qty from the line's source location (`currentStock −= qty`), `reservedQty −= qty`, set `assembledAt` |
| `completed` | all designators assembled (automatic) | `RECEIPT` `targetQuantity` of the design output part into the build's output location (`currentStock += targetQuantity`) |
| `cancelled` | manual, from `created`/`allocated`/`started`/`in_progress` | release un-consumed stock; assembled designators are **not** reversed |

`completed` and `cancelled` are terminal. Allocation (part + source location) can only be
edited while the build is in `created` or `allocated`.

### Allocated vs. reserved

- **Allocated** is a soft reservation: a planning signal ("I plan to use these"). Over-allocation
  is allowed, it never reduces `availableQty`, and the same parts can still be consumed by other
  means.
- **Reserved** is a hard reservation: it reduces `availableQty = currentStock − reservedQty`.
  Parts cannot be used elsewhere until the build is cancelled or the designator is assembled
  (which converts the reservation into actual consumption).

Both are stored as **denormalized `Decimal` columns on `Part`** (`reservedQty`, `allocatedQty`),
mirroring the existing `plannedQty`/`onOrderQty` pattern, with matching descending-friendly
indexes. They are maintained transactionally by build transitions under the existing
`SELECT … FOR UPDATE` part-row lock.

### Planned and in-production quantity (output part)

> **Extended by #184.** A Design's output part carries its own denormalized `inProductionQty`,
> analogous to `onOrderQty` but for stock currently being produced in-house rather than
> incoming from a supplier. `allocated` builds additionally feed the existing `plannedQty`.

`Part.inProductionQty` = sum of `targetQuantity` across all builds where that part is the
output (`build.designRevision.design.outputPartId`) and `build.state` is `started` or
`in_progress` — the hard-reservation window, when stock has actually started being consumed.
Since a build's output is received in one shot at `completed` (no partial receipt as designators
are assembled), `inProductionQty` for an active build is always its full `targetQuantity`, never
partially reduced.

An `allocated` build is a softer commitment: it doesn't yet hold a hard reservation, but it is
still a plan to produce the output part, so its `targetQuantity` counts toward the output part's
existing `plannedQty` instead (the same field shopping lists and draft PO items feed). Moving
`allocated → started` shifts the quantity from `plannedQty` to `inProductionQty`; reopening back
to `created`, or cancelling from `allocated`, releases `plannedQty`; cancelling from
`started`/`in_progress` releases `inProductionQty`.

It is maintained the same way as `allocatedQty`/`reservedQty`: incremented on `started`,
decremented on `completed` (alongside the `RECEIPT` of the output part) and on `cancelled` from
`started`/`in_progress`. Like `onOrderQty` and `plannedQty`, it is purely informational and does
**not** reduce `availableQty`.

### Data model

```prisma
enum BuildState { CREATED ALLOCATED STARTED IN_PROGRESS COMPLETED CANCELLED }

model Build {                       // a production run of one DesignRevision
  designRevisionId String
  outputLocationId String?          // where the produced output part is received; nullable in
                                     // schema, but required by the create build UI/action (#169)
                                     // so a build can never get stuck unable to reach `completed`
  targetQuantity   Int
  state            BuildState @default(CREATED)
  startedAt / completedAt / cancelledAt DateTime?
  lineItems        BuildLineItem[]
}

model BuildLineItem {               // snapshot of one BOM line + its allocation
  sourceBomLineItemId String?       // frozen reference (SetNull if BOM later edited)
  designators         String        // frozen
  designatorCount     Int           // frozen
  categoryName        String?       // frozen display label
  partId              String?       // chosen at allocation; all designators in the line use it
  sourceLocationId    String?       // chosen at allocation
  assignments         BuildDesignatorAssignment[]
}

model BuildDesignatorAssignment {   // one row per individual designator
  designator        String
  quantity          Int             // = build.targetQuantity (units needed at this designator)
  assembledQuantity Int @default(0) // units assembled so far (0 ≤ assembledQuantity ≤ quantity)
}
```

### Grain and target quantity

> **Superseded in part by [ADR 0023](0023-split-allocation-across-parts.md).** As of #64 a line's
> allocation is no longer a single part + location: it is a set of `BuildLineAllocation` entries,
> and `BuildDesignatorAssignment` carries its own `partId`/`sourceLocationId` at a
> per-(designator × part) grain. The state machine, stock semantics, and `availableQty` behavior
> below are unchanged.
>
> **Further superseded by [ADR 0024](0024-per-unit-build-assembly.md).** As of #168
> `BuildDesignatorAssignment` is refined again to a per-(designator × unit) grain: `quantity`/
> `assembledQuantity` are replaced by a single `assembled` boolean per physical unit.

- **Per-line allocation, per-designator assembly.** A part and a source location are chosen
  once per BOM line, but each designator is tracked individually so a build can be partially
  assembled and reach `completed` automatically when the last designator is assembled.
- Each `BuildDesignatorAssignment.quantity` equals the build's `targetQuantity` — the number of
  that part needed at that reference designator across the whole run. So total required for a
  part = (count of its designators across allocated lines) × `targetQuantity`. A designator can
  be assembled in increments (`assembledQuantity`, 1 at a time by default) so a multi-unit run
  can be assembled board-by-board; each increment issues that many units in one `ISSUE`.
- `allocated` vs `reserved` are build-wide phases derived from `Build.state`; the per-designator
  row only needs `assembledQuantity`, and the build completes when every designator is fully
  assembled (Σ `assembledQuantity` = Σ `quantity`).

### Snapshot semantics

The build freezes designators and counts at creation. Pinned BOM lines auto-assign their part.
For unpinned lines the allocation part picker re-runs `findMatchingParts` against the source
BOM line's live spec; if that line was later edited or deleted the picker falls back to a free
part search. Only the chosen `partId`/`sourceLocationId` are authoritative for stock effects.

### Authorization

A new resource permission pair `builds:read` / `builds:write` is introduced (the reader role
gets read, the editor role gets both), rather than reusing `designs:*`, because builds mutate
inventory and have a distinct lifecycle.

## Consequences

- `availableQty` (`currentStock − reservedQty`) becomes the meaningful "can I use this" number
  and is surfaced read-only in the parts/inventory views.
- Consumption and output reuse the existing location-based `createInventoryEntry` primitive, so
  per-location non-negative balance rules and moving-average cost continue to apply unchanged.
- Cancelling never reverses physically-used (assembled) parts; recovering them (e.g.
  desoldering) requires a manual stock adjustment, consistent with the issue.
- Reservation is tracked at the part level while consumption is location-specific; `started`
  therefore guards both part-level availability and per-line source-location balance.
- Split allocation across multiple matching parts is implemented separately in
  [ADR 0023](0023-split-allocation-across-parts.md) (#64). Shortage analysis remains out of scope
  and is tracked separately (refs #9).
