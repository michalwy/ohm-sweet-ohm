# Designs

## What Is a Design?

A **Design** represents a recipe for building a part in-house. Each Design automatically creates a corresponding output part, which appears in the **Parts** list with an "Assembled" indicator in the **Source** column.

Designs are workspace-scoped. Each workspace maintains its own list of designs.

## Work With Designs

The **Designs** screen lists all designs in the workspace.

Table columns:

- **Name** — the design name. Sort the list by clicking this column header.
- **Description** — optional free-text description.
- **Output part** — catalog number of the auto-created output part and its current stock.
- **Revisions** — total revision count and the number of the latest revision.
- **Created** — creation timestamp.

Use **Configure list** to choose which columns are visible; you can also reorder and resize columns. These preferences are remembered per workspace in your browser.

### Creating a Design

1. Click **New design**.
2. Enter a name (required).
3. Optionally enter a description.
4. The **Output part catalog number** field is pre-filled with a suggested identifier (for example, `DESIGN-0001`). You can change it before saving.
5. Click **Create design**.

On creation:
- The output part is created automatically under a workspace-internal manufacturer. This manufacturer is hidden from the Organizations list and the part form.
- Revision 1 is created automatically with no notes.

### Editing a Design

Click **Edit** on a design to change its name and description. The output part catalog
number is shown but cannot be changed after creation.

### Viewing Design Details

Click a design row to open its **details panel** on the right. The panel shows:

- The **output part** catalog number.
- The **revision history**.
- The **bill of materials** for the currently selected revision.

#### Revisions

- Each revision has a revision number (v1, v2, …) and optional notes.
- To add a new revision, click **Add revision** and optionally enter notes.
- To edit revision notes, click the edit icon next to a revision.
- Revision numbers are assigned automatically and cannot be changed.
- Click a revision row to select it and view (or edit) its bill of materials below.

## Bill of Materials

Each revision has a **bill of materials (BOM)** — the list of components needed to build
the design. BOM line items are defined as **specs** (what kind of part is needed) rather
than fixed pointers to specific parts, so passive components can be substituted from
inventory while specific components can still be pinned to one exact part.

Select a revision in the details panel to see its line items. Each line item shows its
designators, quantity, spec, and the number of inventory parts that currently match.

### Designators and Quantity

Each line item carries one or more **reference designators** entered as a range string,
for example `R1, R3, R5-R10`. The system expands ranges into individual designators and
derives the **quantity** automatically (`R5-R10` → 6 designators, quantity 6). Designators
must be unique within a line item; duplicates or overlapping ranges are rejected. Tokens
in one line may use different prefixes (for example `R1, C2`).

### Attribute Matchers

Instead of pointing at a part, a line item holds a set of **attribute matchers**. Each
matcher compares one workspace attribute against a value using an operator:

- Numeric attributes (number and quantity types) support `=`, `≠`, `<`, `≤`, `>`, `≥`
  (for example `power rating ≥ 0.25 W`).
- Text, choice, and yes/no attributes support `=` and `≠` only.

Quantity values are entered with units and SI prefixes (for example `1k`, `0.25 W`) and
are normalized just like part attribute values, so a matcher and a part value are compared
on the same basis. Optionally choose a **category** to narrow matching to parts in that
category (and its subcategories).

A part matches a line item when it satisfies **all** of the line item's matchers.

### Pinning an Exact Part

For components that must be a specific part (for example a particular IC), use the
**pinned part** field to select that part directly. When a part is pinned, the attribute
matchers are ignored and the line item resolves to exactly that part.

### Live Match Preview

While editing a line item, a preview lists the inventory parts that satisfy the current
spec, so you can confirm the spec resolves to the parts you expect before saving. The BOM
table also shows a live match count per line item.

> Building and allocating concrete parts to designators is handled by the build flow.
> See [Builds](builds.md) to turn a revision's bill of materials into a production run.

## Shortage Analysis

Below the bill of materials, the details panel shows a **Shortage analysis** for the
selected revision. Enter a **target quantity** (how many units you intend to build) and the
analysis reports what cannot be fulfilled from current stock.

- **Availability** of a part is its current stock minus reserved quantity. Quantities that
  are only allocated or on order do not count as available.
- **Line shortages** lists each BOM line with its required, available, and gap quantities.
  The required quantity is `designators × target quantity`. Available stock is **combined
  across all parts that match the line's spec**, so a line is short only when the matching
  parts together cannot cover it. Lines with no matching part are flagged.
- **To acquire** is the exploded list of purchasable parts you need to obtain, with the
  total shortage quantity for each.

If a matching part is itself the output of another Design, the analysis nets that
sub-assembly's own stock first and then recurses into that Design's latest revision, so the
**To acquire** list contains only leaf (purchasable) parts. Stock shared between several
lines or sub-assemblies is counted once. If Designs reference each other in a loop, the
cycle is reported instead of analyzed.

Next to **To acquire**, click **Create shopping list** to add these items to a new or
existing shopping list. If a line's shortage could be filled by more than one matching
part, choose which part to add from a dropdown; only genuinely purchasable parts are
offered, not sub-assemblies the analysis would otherwise build. Quantities default to the
computed shortage and can be edited before adding, and remain editable afterward like any
shopping list item. This action requires permission to write shopping lists.

The same shortage preview appears in the **build create dialog** once you pick a revision
and target quantity, so you can spot missing parts before creating the build.

### Deleting a Design

Click **Delete** on a design and confirm.

Deletion is blocked if the output part has any recorded inventory (current stock above zero or any historical stock movements). Move stock to zero and ensure no inventory history exists before deleting.

## Assembled Parts in the Parts List

The Parts list includes an optional **Source** column (hidden by default — enable it via **Configure list**). Parts created as the output of a Design show an **Assembled** badge in this column.
