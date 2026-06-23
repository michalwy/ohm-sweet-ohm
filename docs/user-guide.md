# OSO User Guide

Welcome to OhmSweetOhm (OSO).

This guide explains how to use the current version of the app in everyday work. It focuses on what you can do today, in plain language, without describing internal implementation details.

## Before You Start

OSO is currently designed for desktop browsers and the UI is in English.  
All data is workspace-scoped, so each workspace is its own isolated workshop context.

## Run OSO On Your Computer (Local Use)

If you want to run OSO for your own use, the simplest path is Docker Compose.

### What You Need

- Docker Desktop (or Docker Engine + Docker Compose)
- Internet connection for the first image/build pull
- The repository includes a ready-to-use default `.env` file

### Steps

1. Open a terminal in the repository folder.
2. Run:

```bash
docker compose up
```

3. Wait until startup finishes.
4. Open `http://localhost:3000` in your browser.
5. Create your own account on the sign-up screen.
6. Sign in with the account you created.

To stop the app, press `Ctrl+C` in the terminal where it is running.

## 1. Sign In And Enter A Workspace

When you open OSO, start by signing in (or signing up if this is your first time).

After sign-in, you land on **Workspaces**. This is your entry point to everything else:

- create a new workspace by entering a name
- open an existing workspace
- sign out from the header

Think of a workspace as one workshop environment with its own parts, categories, attributes, locations, and settings.

### Starting data presets

When creating a workspace you can choose one of three starting data options:

- **Empty workspace** (default) — the workspace starts with no data. Best when you want to build your part library from scratch.
- **Demo parts** — seeds the workspace with ~250 real electronic parts across common categories (resistors, capacitors, MOSFETs, microcontrollers, connectors, and more), complete with categories, attributes, manufacturers, and storage locations.
- **Demo parts + orders** — everything in "Demo parts" plus two shopping lists and three purchase orders (one received, one ordered, one draft) so you can explore the full ordering workflow immediately.

Seeded data behaves identically to data you create yourself — you can edit, delete, or extend any of it. The preset cannot be changed after the workspace is created.

### Archiving and restoring a workspace

If you no longer actively use a workspace, you can archive it. Archiving removes it from the active workspace list and makes it inaccessible to members until it is restored. All data is preserved.

**To archive a workspace** (admins only):

1. Open the workspace.
2. Navigate to **Settings → General**.
3. Click **Archive workspace** in the danger zone.
4. Confirm in the dialog. You are redirected to the Workspaces page.

**To restore an archived workspace** (admins only):

1. Open the Workspaces page.
2. Scroll to the **Archived workspaces** section (only visible when at least one workspace is archived).
3. Click **Restore** next to the workspace you want to reactivate.

The workspace immediately reappears in the active list and is accessible again to all members.

**What members see:** If a member navigates to an archived workspace URL, they are redirected to the Workspaces page with a notice that the workspace has been archived.

### Resetting a workspace to demo data

If you use a workspace as a sandbox or playground, you can wipe all its domain data and replace it with a fresh demo preset in one step — without deleting and recreating the workspace.

**What is preserved:** the workspace name, URL slug, member list, roles, and integration settings.

**What is deleted:** all parts, inventory entries, categories, attributes, locations, organizations, purchase orders, and shopping lists currently in the workspace.

**Presets available:**
- **Parts only** — categories, attributes, manufacturers, storage locations, and 200+ real electronic parts with plausible stock levels.
- **Parts + POs & shopping lists** — everything in "Parts only", plus sample purchase orders in various states and a couple of shopping lists.

**To reset a workspace** (admins only):

1. Open the workspace.
2. Navigate to **Settings → General**.
3. Click **Reset to demo data** in the danger zone.
4. Select the desired preset.
5. Click **Reset workspace** to confirm. The operation runs synchronously; the page navigates to the parts list when complete.

**There is no undo.** All current workspace data is permanently deleted before the new preset is imported.

### Permanently deleting a workspace

Permanent deletion removes the workspace and all of its data — parts, inventory, purchase orders, organizations, attributes, and everything else — completely and irreversibly.

**Requirements:**
- The workspace must be archived first. Permanent deletion is only available from the archived state.
- Only workspace admins can trigger deletion.

**To permanently delete an archived workspace** (admins only):

1. Open the Workspaces page.
2. Scroll to the **Archived workspaces** section.
3. Click **Permanently delete** next to the workspace.
4. In the confirmation dialog, type the exact workspace name and click **Delete**.

Once deletion is confirmed, the workspace enters a **"Deletion in progress"** state visible on the Workspaces page. The Restore button disappears; restoration is no longer possible. The actual deletion runs in the background and the workspace disappears from all views when complete.

**There is no undo.** If you are unsure, restore the workspace first and leave it archived until you are certain.

## 2. Manage Organizations

Use **Organizations** to manage the manufacturers, suppliers, and other external entities you work with. Each organization can hold one or more roles:

- **Manufacturer** — an organization that makes parts. Referenced when creating or editing a part.
- **Supplier** — an organization you order from. Required when creating a purchase order or converting a shopping list to an order.

One organization can have both roles at the same time.

### Creating An Organization

1. Open **Organizations** from the sidebar.
2. Click **Add organization**.
3. Enter a name and check at least one role.
4. Save.

### Editing An Organization

Use the pencil icon on any row to open the edit dialog. You can rename the organization or add/remove roles.

### Deleting An Organization

Use the delete icon on any row. An organization cannot be deleted if it is still referenced by parts (as a manufacturer) or by purchase orders (as a supplier). Remove those references first.

> **Note:** Organizations with the **Manufacturer** role are also created automatically when you type a new manufacturer name in the part form. You can then open the organization in the Organizations screen to assign the Supplier role if the same company also sells parts to you.

## 3. Work With Parts

The **Parts** screen is the main operational view.

Here you can create, update, and remove parts. Each part is identified by manufacturer and catalog number, and you can also maintain description, unit, and category assignment.

You can also:

- search by text
- filter by category
- filter by manufacturer
- configure visible columns in the list
- scroll through large datasets with endless loading

Two optional columns can be enabled via **Configure list**:

- **Planned** — total quantity of this part currently on shopping lists (items not yet linked to a purchase order) plus any direct draft purchase order line items (added to a PO without originating from a shopping list). Requires Shopping Lists read access. Hidden by default.
- **On order** — total quantity in purchase orders that have been submitted to a supplier and are awaiting receipt. Requires Purchase Orders read access. Hidden by default.

Both columns support sorting with cursor-based pagination so they work efficiently across large datasets.

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

### Default Location

A part can have an optional default storage location set in its edit dialog. When set:

- The receive-order dialog pre-selects this location for that part's line item. You can still override it before saving.
- If the default location is later archived, it is treated as unset until you choose a new one.

To clear the default location, click the **×** button next to the location picker in the edit dialog.

### Part Detail Panel

Click any row in the parts list to open the detail panel on the right. The panel shows:

- **Attributes** — all attribute values recorded for the part.
- **Locations and stock** — current stock quantity per storage location, plus a button to record a new movement. Requires Inventory read access.
- **Movement history** — the 50 most recent inventory entries (receipts, issues, transfers, adjustments). Requires Inventory read access.
- **Purchase Orders** — all purchase order lines that reference this part, ordered by date descending (most recent first), up to 50 rows. Shows order reference, supplier, status (Draft / Ordered / Received), order date, quantity, and unit price with currency. An **Add to PO** button below the table opens a quick-add dialog. Requires Purchase Orders read access; the button additionally requires Purchase Orders write access.
- **Shopping Lists** — all shopping lists that currently contain this part, ordered alphabetically by list name. Shows list name (click to open that list), quantity requested, and notes. An **Add to shopping list** button below the table opens a quick-add dialog. Requires Shopping Lists read access; the button additionally requires Shopping Lists write access.

### Quick-Add to Purchase Order

From either the row action button (visible in each part row when you have Purchase Orders write access) or the **Add to PO** button in the detail panel, you can add the part to a draft Purchase Order without leaving the parts list.

The dialog lets you:
- Choose an existing **Draft** PO from a list (displayed as order number and supplier). If the part is already on the selected PO, the quantity is merged into the last matching line rather than creating a duplicate.
- Or switch to **Create new purchase order** mode: choose a supplier from the autocomplete and optionally set an order number. A new Draft PO is created and the part is added in one step.
- Enter the **Quantity** to add.

On success a toast confirms the action and the PO history section refreshes automatically.

### Quick-Add to Shopping List

From either the row action button (visible in each part row when you have Shopping Lists write access) or the **Add to shopping list** button in the detail panel, you can add the part to a shopping list without leaving the parts list.

The dialog lets you:
- Choose an existing shopping list from a list (displayed as name and item count). If the part is already on the selected list, the quantity is merged into the last matching line rather than creating a duplicate.
- Or switch to **Create new shopping list** mode: enter a list name. The list is created and the part is added in one step.
- Enter the **Quantity** to add and optionally a **Notes** field (shown when adding to an existing list).

On success a toast confirms the action and the Shopping Lists section in the detail panel refreshes automatically.

## 4. Organize Your Category Structure

Use **Part Categories** to build and maintain your category tree.

You can create categories one by one or use quick path creation for faster setup. Categories support parent-child hierarchy and can be marked as assignable or organizational.

Inside category configuration, you can manage which attributes are active for that category, including defaults, order, and value-column behavior.

## 5. Define Attributes Once, Reuse Everywhere

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

## 6. Manage Units

Use **Units** to define measurement or counting units used by parts.

For each unit, you can set:

- name
- symbol
- whether fractional values are allowed

This helps keep part data consistent when recording quantities and stock operations.

## 7. Build Storage Locations

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

## 8. Record Stock Movements

From the **Parts** screen, open stock actions for a selected part.

OSO currently supports four movement types:

- receipt
- issue
- transfer
- adjustment

For each movement, you enter quantity and optional note, and select source/destination locations when relevant.  
The system then updates current stock based on recorded movement history.
When multiple stock updates for the same part happen at nearly the same time, OSO applies them in a transaction-safe order so stock cannot be driven below zero by race conditions.

## 9. Manage Shopping Lists

Use **Shopping Lists** to keep an informal running list of parts you want to buy.

A shopping list has no supplier and no formal status — it is a flexible scratchpad.

### Creating And Managing Lists

1. Open **Shopping Lists** from the sidebar.
2. Click **New list**, enter a name and optional notes, and save.
3. Click a list row to open the detail panel on the right. Use the **Edit** and **Delete** icon buttons in the row to rename, update notes, or remove a list.

### Adding Items To A List

1. Click a list row to open the detail panel on the right.
2. Click **Add item**, search for a part by catalog number or description, set a quantity, and save.
3. Items show an **On order** badge when they have been included in a purchase order. The badge shows the order number (e.g. **On order: #PO-2026-001**) when available, or the supplier name as a fallback.

### Adding Multiple Items At Once

Click **Add multiple items** (next to **Add item** in the detail panel) to open the part picker wizard. This is a two-step flow:

**Step 1 — Select parts.** A full-featured parts list opens in a dialog. You can search, filter by category or manufacturer, sort and resize columns, and configure which columns are visible — the same way as the main parts list. Column layout is saved independently per context (so the shopping list picker and the purchase order picker each remember their own column configuration). Parts already on the list are shown with an **Already on list** badge; you may still select them (the quantity will be merged). Select parts using the checkbox column, then click **Set quantities**.

**Step 2 — Set quantities.** Each selected part appears in a table with a quantity input (default: 1). Parts already on the list are flagged. Click **Add item(s)** to commit.

- **Back** returns to step 1 with your selection and any quantities you already entered preserved.
- If a selected part is already on the list, its existing quantity is incremented rather than creating a duplicate line.

### Converting Items To A Purchase Order

1. Select one or more items using the checkboxes in the detail panel. Items already on a purchase order have a disabled checkbox and cannot be re-converted.
2. Click **Convert to order (N)**.
3. A dialog lists all your draft purchase orders. Select one and click **Add to order** to append the items to that order.
4. To create a new purchase order instead, click **New order**. Fill in the supplier (required), optional order number, and optional notes, then click **Create order**. The selected items are added to the new order automatically.

In both cases the original shopping list items remain on the list and show an **On order** badge.

## 10. Manage Purchase Orders

Use **Purchase Orders** to track formal orders sent to a supplier.

### Pricing And Currencies

OSO tracks net prices and computes gross amounts on the fly.

**Workspace primary currency** is set when you create a workspace and cannot be changed. It is used for all cost summaries and the average cost column in the parts list.

**Order currency** — set an optional currency on each purchase order. When the order currency differs from your workspace primary currency, OSO fetches the exchange rate from the ECB (via the Frankfurter API) and shows amounts in both currencies wherever applicable. Currency is locked after creation.

**Tax rate cascade** — tax rate defaults follow this hierarchy: per-item override → PO default → supplier default → workspace ordering default → 0. Set workspace-level defaults under **Settings → Ordering**.

**Price entry mode** — each PO has a price entry mode: **Net** (you enter net prices, gross is computed) or **Gross** (you enter gross prices, net is back-calculated and stored). Set at PO creation; cannot be changed afterwards.

- In **Net** mode: enter net price per item; the dialog shows gross as a read-only computed value.
- In **Gross** mode: enter the gross price per item; OSO back-calculates `net = gross / (1 + taxRate / 100)` and stores the net.

**Supplier defaults** — set a default price entry mode, tax rate, and currency per supplier organization (under **Organizations**). When you select a supplier in the create-PO dialog, these fields are pre-filled automatically.

**Workspace ordering defaults** — fallback defaults for price entry mode and tax rate when the selected supplier has no defaults. Configure them under **Settings → Ordering**.

**Dual-entry pricing** — in the item dialog, enter either the unit price (or gross unit price) or the line total; the other field updates automatically.

**Order totals** — the detail panel shows a totals footer (net and gross) whenever at least one item has a price. If the order currency differs from your primary currency and the order has been marked as ordered, primary-currency equivalents are shown alongside.

**Average cost column** — the parts list has an **Avg. cost** column (hidden by default). It shows the weighted-average net receipt cost in your workspace primary currency, calculated from all received purchase order items that had a price at receive time.

### Creating An Order

1. Open **Purchase Orders** from the sidebar.
2. Click **New order**, choose a supplier. Currency, tax rate, and price entry mode are pre-filled from the supplier's defaults (falling back to workspace ordering defaults).
3. Adjust any fields as needed and save.
4. The order starts in **Draft** status.

> **Note:** The supplier dropdown only shows organizations with the **Supplier** role. If the list is empty, open **Organizations** from the sidebar and assign the Supplier role to the relevant organization.

### Adding Items

1. Click an order row to open the detail panel on the right.
2. Click **Add item**, search for a part, enter a quantity, and optionally fill in a supplier SKU, price (net or gross depending on the PO's price entry mode), and a per-item tax rate override.

### Adding Multiple Items At Once

Click **Add multiple items** (next to **Add item** in the detail panel, visible when the order is not yet Received) to open the part picker wizard. This is a two-step flow:

**Step 1 — Select parts.** A full-featured parts list opens in a dialog. You can search, filter by category or manufacturer, sort and resize columns, and configure which columns are visible — the same way as the main parts list. Column layout is saved independently per context. Parts already on the order are shown with an **Already on order** badge; you may still select them. Select parts using the checkbox column, then click **Set quantities**.

**Step 2 — Set quantities.** Each selected part appears in a table with a quantity input (default: 1). Parts already on the order are flagged. Click **Add item(s)** to commit.

- **Back** returns to step 1 with your selection and quantities preserved.
- If a selected part is already on the order, its existing quantity is incremented rather than creating a duplicate line.
- Price fields are not set at this stage; edit individual items afterwards to add prices.
3. A computed panel shows the complementary price (gross if net mode, net if gross mode). If the order is marked as ordered and the currencies differ, primary-currency equivalents are also shown.
4. Click **Look up** next to the supplier SKU field to auto-fill the SKU from the active DigiKey or TME integration.

### Marking An Order As Ordered

When you have submitted the order to the supplier, click **Mark as ordered** in the detail panel. This records the order date and advances the status to **Ordered**.

You can still add, edit, or remove items on an ordered order. Removing an item from an ordered order immediately decrements the on-order quantity shown in the parts list.

### Reverting An Order To Draft

If you need to make changes after marking an order as ordered, click **Revert to draft** in the detail panel. This moves the order back to **Draft** status, clears the recorded order date, and returns the on-order quantities to planned.

### Deleting An Order

Draft and ordered orders can be deleted using the delete icon in the order list. Received orders cannot be deleted.

Deleting a draft order returns any quantities it contributed to the **Planned** column in the parts list. Deleting an ordered order decrements the **On order** column; for items that originated from a shopping list, the quantity returns to **Planned** since those shopping list items still exist.

### Receiving Items

When parts arrive:

1. Click **Receive items** in the detail panel.
2. For each item, enter the quantity received and choose a destination storage location using the tree picker. If the part has a default location set, the picker is pre-filled with that location. The picker shows your full location hierarchy — click the arrow to expand a node, or type in the search box to filter by name.
3. Save.

Each received item creates a **Receipt** inventory movement automatically. Items with a checkmark (✓) are fully received.

When all items reach their full ordered quantity the order status advances to **Received** automatically.

Partial receives are supported — you can receive in multiple sessions until the order is complete.

## 11. Configure Supplier Integrations

In **Settings > Integrations**, you can configure workspace-level supplier settings.

Current providers:

- DigiKey (client ID + client secret)
- TME (API token + application secret)

You can also choose which provider is active for the workspace.

## 12. Permissions And Read-Only Behavior

What you can edit depends on your workspace permissions.

In some cases, a feature remains visible but actions are disabled.  
This is expected behavior when your role has read-only access for that area.

## Quick Start Checklist

If you are setting up a new workspace, this sequence usually works best:

1. Create or open workspace.
2. Define units.
3. Create attributes.
4. Build part categories and attach attributes.
5. Add locations.
6. Add organizations (at least one Manufacturer, one Supplier if you plan to create purchase orders).
7. Add parts.
8. Record stock movements.
9. Configure integrations if needed.
10. Use shopping lists to collect parts to buy.
11. Create purchase orders and receive deliveries to update inventory automatically.
