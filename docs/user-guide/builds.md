# Builds

A **build** is a concrete production run of a design revision for a target quantity. A build
walks through a series of states, and each state change moves stock: from planning, to a hard
reservation, to actual consumption, and finally to producing the design's output part.

Builds live under **Builds** in the workspace navigation. Reading builds requires the
`builds:read` permission; creating and advancing builds requires `builds:write`.

The builds list shows each build's **Allocated** progress (how many of the required designator-units
have a `BuildLineAllocation` covering them, as a fraction and progress bar) and its **Assembled**
progress (how many designator-units have been marked assembled). Both columns follow the same visual
treatment: a numeric fraction and a progress bar. Columns can be shown, hidden, and reordered from
*Configure list*.

## Stock terms

- **On hand** — the stock you physically have (the Stock column on the parts list).
- **Incoming** — stock that isn't on hand yet but is on its way: on order from a supplier, or being
  produced by another active build. A build can plan against incoming stock, but cannot **start**
  until it actually arrives as on-hand stock.
- **Allocated** — a soft, informational reservation ("I plan to use these"), covering both on-hand
  and incoming stock. It does **not** reduce what is available, and over-allocation is allowed.
- **Reserved** — a hard reservation. It reduces **Available** stock, so reserved parts cannot be
  used by another build until they are consumed or released.
- **Available** — `On hand − Reserved`. This is the amount you can still commit elsewhere. The
  parts list has optional **Reserved**, **Allocated**, and **Available** columns (enable them
  from *Configure list*).

## Creating a build

1. Open **Builds** and choose **New build**.
2. Pick a **design** and one of its **revisions**.
3. Enter the **target quantity** — how many units of the design you intend to produce.
4. Choose an **output location** — where the finished output part will be received on completion.
   This is required; a build cannot be created without one.

Once a revision and target quantity are set, the dialog shows a **shortage preview** — which
BOM lines cannot be fulfilled from available stock and which parts you would need to acquire or
sub-build. This is informational and does not block creating the build. See
[Shortage Analysis](designs.md#shortage-analysis) for how it is calculated.

While a build is **Allocating**, the shortage analysis is also accessible from the build detail
panel. For any shortage line sourced by a sub-assembly, a **Create build** button appears next to
the sub-design name in the shortage modal. Clicking it closes the modal and opens the build
creation dialog pre-filled with the sub-design's latest revision and the unmet quantity as the
target quantity; you still need to choose an output location before creating. The resulting
sub-build is independent — no parent/child link is stored.

When the build is created, the chosen revision's bill of materials is **frozen** into the build:
each BOM line becomes a build line. Each designator needs `target quantity` parts, so a line with
designators `R1, R2, R3` and a target quantity of 2 requires 6 parts in total. The build also
pre-fills a suggested allocation for each line from stock that is currently available, which you
can adjust.

## Build states

| State | What it means | Effect on stock |
|---|---|---|
| **Allocating** | Editable at any time. Allocate each line to one or more parts. | Every saved entry immediately marks parts **allocated** (informational) |
| **Started** | Stock is hard-reserved. | Converts allocated into **reserved**; reduces Available |
| **In progress** | At least one designator assembled. | Each assembled designator **issues** its parts from the line's source location |
| **Completed** | All designators assembled (reached automatically). | **Receives** the target quantity of the output part into the output location |
| **Cancelled** | Stopped manually. | Releases the remaining allocation/reservation |

A build stays in **Allocating** for as long as you're planning it — there is no separate "Allocate"
step or locked-then-reopened state. Allocation entries can be added, edited, or removed at any time
before you choose **Start**, and every save immediately updates the **Allocated** figures shown on
the parts list.

## Allocating parts

While a build is **Allocating**, open it and allocate each line. A line can be **split across
several parts** — for example 50 resistors met as 20 from one part and 30 from another — and each
part is drawn from its own **source location**. For each entry you choose the **part** (from the
parts that match the line's specification **and still have available stock**, each shown with its
manufacturer and available quantity), the **source location** to consume from, and a **quantity**.
**Add part** adds another entry, pre-filled with the next best available part, location, and
quantity to cover what is still unallocated (the same greedy suggestion the build makes when it is
created); adjust it as needed. The remove button drops an entry.

An entry can also be left **without a source location**, which plans against **incoming** stock
(on order from a supplier, or being produced by another active build) instead of on-hand stock —
labeled **Incoming** rather than **On hand**. This lets you prepare a build ahead of parts arriving.
Each line's progress bar shows both shares side by side (dark green for on-hand, light green for
incoming). An incoming-backed entry always keeps its line — and so the build — from being ready to
**Start**, since starting requires the parts to be physically on hand; once the incoming stock
actually lands, edit the entry to add a real location (an ordinary save, no extra step needed) and
the build becomes start-ready.

Each line shows its running **Allocated** total against the required quantity. You cannot allocate
more of a part than is **available** — on hand plus incoming, combined — nor more from a location
than that location has **available** there — the source-location picker and its per-location
figures already net out any hard reservation another started build holds at that location, so an
entry that exceeds either is highlighted.

**Apply** saves the allocation of **all lines at once**, in a single step. This is deliberate: it
keeps the whole build consistent, so rearranging parts between lines (for example moving a part off
one line and onto another) can never leave the build temporarily over-allocated. Apply is available
once your edits differ from what is saved, every entry is complete, and nothing exceeds available
stock; partial lines are allowed while you work.

**Start** becomes available once every line is fully allocated — every entry has a real source
location — and your changes are saved; it stays disabled otherwise.

Because allocation is a soft, informational hold, stock can still move while a build is
**Allocating** — for example another build reserves the same part, or someone transfers stock out
of the chosen source location. The build detail view re-checks the allocation against current stock
continuously and shows a warning banner naming the affected part(s)/location(s) when the plan no
longer holds. The warning is informational only; it does not block **Start**, but starting will
still fail with the same guard described below until the allocation is fixed or stock is restored.

## Starting a build

Once every line is fully allocated, choose **Start**. A build can only start when:

1. Every line is fully allocated.
2. **Available** stock (on hand minus existing reservations) covers every part's requirement.
3. Each chosen source location physically holds enough of its part.

Starting converts the soft allocation into a hard reservation, so the reserved parts are no
longer available to other builds. Starting also **distributes** each line's allocation down to a
per-unit assembly list: every one of the build's `target quantity` physical units gets its own
assignment for each designator, each naming a concrete part (and location). When a line is split
across parts, units are handed out in order, so a single designator can end up using different
parts on different units (possible when the target quantity is greater than one) — for example
unit 1's `R5` might use one resistor and unit 3's `R5` another.

## Assembling and completing

From **Started**/**In progress**, the build detail view shows a grid of its units (boards) —
**Unit 1** through **Unit *target quantity***, each labeled not started, in progress, or complete.
Select a unit to see its designators and the part assigned to each. Assemble a single designator
(**Assemble**) or the whole selected unit at once (**Assemble whole unit**) — useful for building
board by board. Assembling issues the part from that designator's source location for that one
unit (reducing on-hand stock) and releases its reservation.

If the wrong part was actually used, choose **Change part** on a designator that has not been
assembled yet (on that unit) and pick any part that matches the line's specification (with its
source location); the reservation moves to the new part for that unit only — other units of the
same designator are unaffected. A unit is complete once every one of its designators is assembled;
the build completes automatically once every unit is complete, and the target quantity of the
output part is received into the output location.

## Printing a pick list

From **Allocating**, **Started**, or **In progress**, choose **Print pick list** to open a
printable document (in a new tab) listing every part to physically gather, grouped by **source
location** to minimize walking back and forth, with a blank checkbox next to each line for
tick-off while picking. Each line shows the part's catalog number, manufacturer, the BOM line's
full category, and quantity needed at that location.

- While **Allocating**, quantities come from the current allocation plan (incoming-backed entries
  have no location yet, so they appear ungrouped until a location is assigned).
- While **Started**/**In progress**, quantities reflect the full original allocation, with a note
  on any line where some units have already been assembled — the list does not shrink as you
  assemble, so it always shows the complete picture for the build.

The page reflects live data each time it is opened; nothing is saved when you tick a box or close
the tab. Use your browser's print dialog (including "Print to PDF") to produce a physical copy.

## Printing an assembly list

From **Started**, **In progress**, or **Completed**, choose **Print assembly list** to open a
printable document (in a new tab) for use while assembling. It mirrors the unit grid from the
build detail view: grouped by **unit**, then by **designator** in order, each line showing the
designator, the assigned part's catalog number, manufacturer, full category, and source location.
Designators that are already assembled are shown checked and struck through — the list always
shows every designator for every unit (it never shrinks), so it reflects current progress on
re-print rather than only what remains.

## Cancelling

Cancelling releases stock that has not yet been consumed:

- From **Allocating**, the soft allocation is released.
- From **Started**/**In progress**, the remaining reservation is released.

Designators that were already assembled are **not** reversed — those parts were physically used.
To recover them (for example by desoldering), make a manual stock adjustment in
[Inventory](inventory.md).
