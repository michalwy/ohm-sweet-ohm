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
5. Save.

### Editing Or Deleting A Part

- Use row actions to open edit mode for a selected part.
- Update fields and save, or remove the part if needed.

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
3. Items show an **On order** badge when they have been included in at least one purchase order.

### Converting Items To A Purchase Order

1. Select one or more items using the checkboxes in the detail panel.
2. Click **Convert to order (N)**.
3. Choose a supplier organization and confirm.

This creates a new purchase order in DRAFT status with the selected items. The original shopping list items remain on the list.

## 10. Manage Purchase Orders

Use **Purchase Orders** to track formal orders sent to a supplier.

### Creating An Order

1. Open **Purchase Orders** from the sidebar.
2. Click **New order**, choose a supplier organization, optionally enter an order number and notes, and save.
3. The order starts in **Draft** status.

> **Note:** The supplier dropdown only shows organizations with the **Supplier** role. If the list is empty, open **Organizations** from the sidebar and assign the Supplier role to the relevant organization.

### Adding Items

1. Click an order row to open the detail panel on the right.
2. Click **Add item**, search for a part, enter a quantity, and optionally fill in a supplier SKU, unit price, and currency.
3. Click **Look up** next to the supplier SKU field to auto-fill the SKU from the active DigiKey or TME integration.

### Marking An Order As Ordered

When you have submitted the order to the supplier, click **Mark as ordered** in the detail panel. This records the order date and advances the status to **Ordered**.

You can still add, edit, or remove items on an ordered order.

### Receiving Items

When parts arrive:

1. Click **Receive items** in the detail panel.
2. For each item, enter the quantity received and choose a destination storage location.
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
