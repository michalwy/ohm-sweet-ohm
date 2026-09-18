---
title: Inventory
---

## Build Storage Locations

Use **Locations** to represent physical storage structure in your workshop.

Locations can be hierarchical (for example, area > drawer > bin).  
You can mark a location as:

- assignable (can hold stock directly)
- organizational (structural node)
- archived (no longer active for regular use)

Archived location behavior:

- archived locations cannot be used as source or destination in new stock movements
- if an archived location still has stock, it remains visible in part stock breakdown with an archived marker
- archiving is blocked while a location has non-zero stock; move or adjust stock to zero first

## Generate a Location Structure

Storage is often a regular grid — a cabinet with rows, each row with the same bins. Instead of adding
each location by hand, click **Generate locations** on the **Locations** screen and describe the
structure level by level.

- **Create inside** — the parent the structure goes under, or no parent for the top level. Any
  location can be the parent, organizational ones included.
- **Levels** — add as many as you need; every location of a level gets the whole next level inside
  it. For each level set:
  - **Prefix** and **Suffix** — text around the counter, for example `Row ` or `Bin-`.
  - **Counter** — **Numbers** (`1, 2, 3`) or **Letters** (`A, B, C`, continuing `AA, AB` after `Z`).
    Levels can mix them, such as lettered rows with numbered bins.
  - **Start** and **Count** — the first value (a number, or one to three letters) and how many
    locations the level has.
  - **Zero padding** (numbers only) — **Auto** pads every number to the width of the largest one
    (`01` … `12`), so the list sorts in counting order; or choose none or a fixed number of digits.
  - **Type** — organizational or assignable. By default the deepest level is assignable and the ones
    above it organizational.
- To build a name from several levels, put `{1}`, `{2}`, … in a prefix or suffix to insert that
  level's counter: prefix `R{1}C` on level 2 gives `R1C1`, `R1C2`, `R2C1`, …

The **Preview** lists every location the structure describes and how many are new. Up to 1,000 new
locations can be generated at once.

**Extending a structure.** A location whose name already exists in the same place (ignoring case and
extra spaces) is kept as it is — not renamed and not retyped — and the next level is generated inside
it. The preview marks these **Already exists**. So to add bins 11–15 to every existing row, generate
the same rows again with a bin level starting at 11; to add rows 6–10, start the row level at 6.

Generated locations are ordinary locations: rename, move, archive or delete them one by one as usual.
Generating needs permission to manage locations.

## See What a Location Holds

Click a location in the **Locations** tree to open its details panel. **Stored parts** lists every
part with non-zero stock held directly in that location, showing the part's catalog number (with a
link to the part), manufacturer and description, and its **Stock** and **Available** quantities
there — the same per-location figures as the part's **Locations and stock** table.

Turn on **Include sublocations** to also list stock held anywhere below the location. Each part then
gets one row per location that holds it, with a **Location** column giving the path below the opened
location (for example `Drawer 1 / Bin 3`); stock held directly in the opened location is listed
first. This is how you see the contents of an organizational location, which never holds stock
itself.

The panel needs permission to read inventory. The selected location is kept in the page URL, so the
view can be bookmarked or shared.

## Record Stock Movements

From the **Parts** screen, open stock actions for a selected part.

OSO currently supports four movement types:

- receipt
- issue
- transfer
- adjustment

For each movement, you enter quantity and optional note, and select source/destination locations when relevant.  
The system then updates current stock based on recorded movement history.
When multiple stock updates for the same part happen at nearly the same time, OSO applies them in a transaction-safe order so stock cannot be driven below zero by race conditions.

## Reserved and Available Stock

In addition to on-hand stock, OSO tracks two build-related quantities per part:

- **Reserved** — a hard reservation held by started [builds](builds.md). Reserved stock reduces what is available to commit elsewhere.
- **Available** — on-hand stock minus reserved stock. This is the amount you can still use for new builds or movements.

The parts list has optional **Reserved**, **Allocated**, and **Available** columns (enable them from *Configure list*); **Allocated** is a soft, informational reservation that does not reduce Available. All three columns support sorting with cursor-based pagination so they work efficiently across large datasets. When a build is **started**, its parts are reserved; assembling a designator consumes the reserved parts via an issue movement; cancelling a started build releases the remaining reservation. See [Builds](builds.md) for the full flow.

The part detail panel's **Locations and stock** table shows both figures per location: **Stock** (raw on-hand quantity at that location) and **Available** (that location's stock minus any hard reservation a started build is currently holding against it there). Use **Available** when deciding where to draw stock from — a location can show non-zero **Stock** but zero **Available** if another build has already reserved it. The build allocation editor (see [Builds](builds.md)) narrows its source-location picker to this same per-location **Available** figure.

If a **transfer** moves stock that a started build has reserved at the source location, OSO moves just enough of that reservation to the destination location along with it, so the source location's **Available** never goes negative and the reservation still points at real stock.
