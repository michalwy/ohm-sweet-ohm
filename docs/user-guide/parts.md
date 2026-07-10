---
title: Parts, Categories, Attributes, and Units
---

## Work With Parts

The **Parts** screen is the main operational view.

Here you can create, update, and remove parts. Each part is identified by manufacturer and catalog number, and you can also maintain description, unit, and category assignment.

You can also:

- search by text
- filter by category
- filter by manufacturer
- configure visible columns in the list
- scroll through large datasets with endless loading

Several optional columns can be enabled via **Configure list**:

- **Planned** — total quantity of this part currently on shopping lists (items not yet linked to a purchase order), any direct draft purchase order line items (added to a PO without originating from a shopping list), and — for a Design's output part — the target quantity of any builds in the Allocating state (planned to be produced but not yet started). Requires Shopping Lists read access. Hidden by default.
- **On order** — total quantity in purchase orders that have been submitted to a supplier and are awaiting receipt. Requires Purchase Orders read access. Hidden by default.
- **In production** — for a Design's output part, the total quantity currently being assembled across active builds (builds in Started or In Progress state). Requires Builds read access. Hidden by default.
- **Balance** — a single at-a-glance figure combining everything already in motion, net of what's already earmarked: `Available + On order + In production − Allocated`. Requires Inventory, Purchase Orders, and Builds read access (all three); the column is omitted entirely if any is missing, since a partial figure would be misleading. Hidden by default. Also shown on the part details panel when those same permissions are held.

All of these columns support sorting with cursor-based pagination so they work efficiently across large datasets.

### Adding A Part

1. Open the add-part dialog.
2. Fill in manufacturer and catalog number.
3. Select unit and primary category.
4. Optionally select a secondary category and fill attribute values.
5. Optionally choose a **Default location** — a storage location that will be pre-selected whenever you receive or move this part.
6. Save.

### Editing Or Deleting A Part

- Use row actions to open edit mode for a selected part.
- Update fields and save, or remove the part if needed.
- If deletion fails (for example, due to a server error), an error notification appears and the part remains in the list.

### Default Location

A part can have an optional default storage location set in its edit dialog. When set:

- The receive-order dialog pre-selects this location for that part's line item. You can still override it before saving.
- If the default location is later archived, it is treated as unset until you choose a new one.

To clear the default location, click the **×** button next to the location picker in the edit dialog.

### Part Detail Panel

Click any row in the parts list to open the detail panel on the right. The panel shows:

- **Attributes** — all attribute values recorded for the part.
- **Locations and stock** — current stock quantity per storage location, plus a button to record a new movement. Only locations with a non-zero quantity are listed; if the part has no stock anywhere, an empty-state message is shown instead. Requires Inventory read access.
- **Movement history** — the 50 most recent inventory entries (receipts, issues, transfers, adjustments). Each entry is shown across separate **Type**, **Qty**, **From**, **To**, **Note**, **Date**, and **Author** columns, which you can sort, resize, reorder, and toggle via **Configure list**. Requires Inventory read access.
- **Purchase Orders** — all purchase order lines that reference this part, ordered by date descending (most recent first), up to 50 rows. Shows order reference, supplier, status (Draft / Ordered / Received), order date, quantity, and unit price with currency. An **Add to PO** button below the table opens a quick-add dialog. Requires Purchase Orders read access; the button additionally requires Purchase Orders write access.
- **Shopping Lists** — all shopping lists that currently contain this part, ordered alphabetically by list name. Shows list name (click to open that list), quantity requested, and notes. An **Add to shopping list** button below the table opens a quick-add dialog. Requires Shopping Lists read access; the button additionally requires Shopping Lists write access.
- **Builds** — all builds that currently have this part allocated (build in Allocating state) or reserved (build in Started / In Progress state, from unassembled designator assignments), ordered by creation date descending. Shows build reference (design name, revision, target quantity; click to open that build), state, and quantity allocated and/or reserved. Requires Builds read access.
- **In Production** — all Started or In Progress builds whose output is this part, ordered by creation date descending. Shows build reference (design name, revision, target quantity; click to open that build), state, and quantity being produced. Only shown when this part is a design output and at least one such build is active. Requires Builds read access.

### Quick-Add To Purchase Order

From either the row action button (visible in each part row when you have Purchase Orders write access) or the **Add to PO** button in the detail panel, you can add the part to a draft Purchase Order without leaving the parts list.

The dialog lets you:
- Choose an existing **Draft** PO from a list (displayed as order number and supplier). If the part is already on the selected PO, the quantity is merged into the last matching line rather than creating a duplicate.
- Or switch to **Create new purchase order** mode: choose a supplier from the autocomplete and optionally set an order number. A new Draft PO is created and the part is added in one step.
- Enter the **Quantity** to add.

On success a toast confirms the action and the PO history section refreshes automatically.

### Quick-Add To Shopping List

From either the row action button (visible in each part row when you have Shopping Lists write access) or the **Add to shopping list** button in the detail panel, you can add the part to a shopping list without leaving the parts list.

The dialog lets you:
- Choose an existing shopping list from a list (displayed as name and item count). If the part is already on the selected list, the quantity is merged into the last matching line rather than creating a duplicate.
- Or switch to **Create new shopping list** mode: enter a list name. The list is created and the part is added in one step.
- Enter the **Quantity** to add and optionally a **Notes** field (shown when adding to an existing list).

On success a toast confirms the action and the Shopping Lists section in the detail panel refreshes automatically.

## Organize Your Category Structure

Use **Part Categories** to build and maintain your category tree.

You can create categories one by one or use quick path creation for faster setup. Categories support parent-child hierarchy and can be marked as assignable or organizational.

Inside category configuration, you can manage which attributes are active for that category, including defaults, order, and value-column behavior.

## Define Attributes Once, Reuse Everywhere

Use **Attributes** as your workspace dictionary of reusable part properties.

Supported attribute types are:

- text
- number
- quantity
- boolean
- choice

For quantity attributes, you can define a base unit symbol.  
For choice attributes, you can manage option lists and option order.

After attributes exist, categories can attach and configure them for actual part entry workflows.

The attributes list supports the same shared list controls as other workspace lists: sort by any column (name, type, base unit, description), resize, reorder, and toggle visible columns via **Configure list**, with cursor-based loading for large dictionaries.

## Manage Units

Use **Units** to define measurement or counting units used by parts.

For each unit, you can set:

- name
- symbol
- whether fractional values are allowed

This helps keep part data consistent when recording quantities and stock operations.

The units list supports the same shared list controls as other workspace lists: sort by any column (name, symbol, fractional flag), resize, reorder, and toggle visible columns via **Configure list**, with cursor-based loading for large unit sets.
