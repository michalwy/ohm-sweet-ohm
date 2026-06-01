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

## 2. Work With Parts

The **Parts** screen is the main operational view.

Here you can create, update, and remove parts. Each part is identified by manufacturer and catalog number, and you can also maintain description, unit, and category assignment.

You can also:

- search by text
- filter by category
- filter by manufacturer
- configure visible columns in the list
- scroll through large datasets with endless loading

### Adding A Part

1. Open the add-part dialog.
2. Fill in manufacturer and catalog number.
3. Select unit and primary category.
4. Optionally select a secondary category and fill attribute values.
5. Save.

### Editing Or Deleting A Part

- Use row actions to open edit mode for a selected part.
- Update fields and save, or remove the part if needed.

## 3. Organize Your Category Structure

Use **Part Categories** to build and maintain your category tree.

You can create categories one by one or use quick path creation for faster setup. Categories support parent-child hierarchy and can be marked as assignable or organizational.

Inside category configuration, you can manage which attributes are active for that category, including defaults, order, and value-column behavior.

## 4. Define Attributes Once, Reuse Everywhere

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

## 5. Manage Units

Use **Units** to define measurement or counting units used by parts.

For each unit, you can set:

- name
- symbol
- whether fractional values are allowed

This helps keep part data consistent when recording quantities and stock operations.

## 6. Build Storage Locations

Use **Locations** to represent physical storage structure in your workshop.

Locations can be hierarchical (for example, area > drawer > bin).  
You can mark a location as:

- assignable (can hold stock directly)
- organizational (structural node)
- archived (no longer active for regular use)

## 7. Record Stock Movements

From the **Parts** screen, open stock actions for a selected part.

OSO currently supports four movement types:

- receipt
- issue
- transfer
- adjustment

For each movement, you enter quantity and optional note, and select source/destination locations when relevant.  
The system then updates current stock based on recorded movement history.

## 8. Configure Supplier Integrations

In **Settings > Integrations**, you can configure workspace-level supplier settings.

Current providers:

- DigiKey (client ID + client secret)
- TME (API token + application secret)

You can also choose which provider is active for the workspace.

## 9. Permissions And Read-Only Behavior

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
6. Add parts.
7. Record stock movements.
8. Configure integrations if needed.
