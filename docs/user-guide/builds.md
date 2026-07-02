# Builds

A **build** is a concrete production run of a design revision for a target quantity. A build
walks through a series of states, and each state change moves stock: from planning, to a hard
reservation, to actual consumption, and finally to producing the design's output part.

Builds live under **Builds** in the workspace navigation. Reading builds requires the
`builds:read` permission; creating and advancing builds requires `builds:write`.

## Stock terms

- **On hand** — the stock you physically have (the Stock column on the parts list).
- **Allocated** — a soft, informational reservation ("I plan to use these"). It does **not**
  reduce what is available, and over-allocation is allowed.
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

When the build is created, the chosen revision's bill of materials is **frozen** into the build:
each BOM line becomes a build line, and every reference designator becomes its own assembly
item. Each designator needs `target quantity` parts, so a line with designators `R1, R2, R3`
and a target quantity of 2 requires 6 of that part in total.

## Build states

| State | What it means | Effect on stock |
|---|---|---|
| **Created** | Editable. Assign a part and a source location to each line. | None |
| **Allocated** | Every line has a part and source location. | Marks parts **allocated** (informational) |
| **Started** | Stock is hard-reserved. | Converts allocated into **reserved**; reduces Available |
| **In progress** | At least one designator assembled. | Each assembled designator **issues** its parts from the line's source location |
| **Completed** | All designators assembled (reached automatically). | **Receives** the target quantity of the output part into the output location |
| **Cancelled** | Stopped manually. | Releases the remaining allocation/reservation |

## Allocating parts

While a build is **Created**, open it and, for each line, choose the **part** and the **source
location** to consume from. Pinned BOM lines come pre-assigned to their pinned part; for other
lines you pick from the parts that match the line's specification.

When every line has a part and a source location, choose **Allocate** to move the build to the
**Allocated** state. To change an allocation afterwards, choose **Reopen** to return to
**Created**.

## Starting a build

From **Allocated**, choose **Start**. A build can only start when:

1. Every line is fully allocated.
2. **Available** stock (on hand minus existing reservations) covers every part's requirement.
3. Each line's chosen source location physically holds enough of its part.

Starting converts the soft allocation into a hard reservation, so the reserved parts are no
longer available to other builds.

## Assembling and completing

From **Started**/**In progress**, mark designators as assembled. For a target quantity greater
than one, each designator needs that many units, so you can assemble it one unit at a time
(**+1**) or all remaining units at once (**All**) — for example to assemble the run board by
board. Assembling issues the parts from the line's source location (reducing on-hand stock) and
releases that much of the reservation. When every designator is fully assembled, the build
completes automatically and the target quantity of the output part is received into the output
location.

## Cancelling

Cancelling releases stock that has not yet been consumed:

- From **Allocated**, the soft allocation is released.
- From **Started**/**In progress**, the remaining reservation is released.

Designators that were already assembled are **not** reversed — those parts were physically used.
To recover them (for example by desoldering), make a manual stock adjustment in
[Inventory](inventory.md).
