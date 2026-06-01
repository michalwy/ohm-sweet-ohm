# OSO User Guide

This guide describes the current user-facing functionality in OhmSweetOhm (OSO).

## Scope And Platform

- OSO is currently designed for desktop browsers.
- The application UI is currently in English.
- All data is workspace-scoped.

## Sign In And Workspaces

1. Sign in or sign up to access OSO.
2. After sign-in, open the **Workspaces** screen.
3. Create a workspace by entering a workspace name.
4. Open a workspace from the list to enter the workspace area.
5. Sign out from the Workspaces screen header.

## Parts List

The Parts screen is the main list of parts in a workspace.

- Add a part in a modal dialog.
- Edit or delete an existing part.
- Track part identity by manufacturer and catalog number.
- Enter part description.
- Assign unit, primary category, and optional secondary category.
- Fill attribute values based on effective category attributes.
- Search and filter parts by text, category, and manufacturer.
- Configure visible list columns and ordering.
- Load large lists with endless scrolling.

## Part Categories

Use **Part Categories** to manage the category tree and category-level attribute setup.

- Create, edit, and delete categories.
- Create category paths with quick path creation.
- Choose category type: assignable or organizational.
- Build parent-child category trees.
- Configure category attributes:
  - attach/detach attributes
  - set sort order
  - set default values
  - mark primary attributes
  - choose value attribute for the category
- Configure global workspace-level attribute defaults used by categories.

## Attributes Dictionary

Use **Attributes** to manage reusable workspace attributes.

- Create, edit, and delete attributes.
- Supported attribute types:
  - text
  - number
  - quantity
  - boolean
  - choice
- For quantity attributes, define a base unit symbol.
- For choice attributes, manage options and option order.

## Units

Use **Units** to manage units available for parts.

- Create, edit, and delete units.
- Define unit name and symbol.
- Set whether fractional values are allowed.

## Locations

Use **Locations** to manage storage location structure.

- Create, edit, and delete locations.
- Build parent-child location trees.
- Mark locations as assignable or organizational.
- Mark locations as archived (for existing locations).

## Part Stock Movements

From the Parts screen, open stock actions for a selected part.

- Add stock movements using:
  - receipt
  - issue
  - transfer
  - adjustment
- Enter quantity and optional note.
- Select source and/or destination location depending on movement type.
- Current stock values are updated from movement history.

## Supplier Integrations

Use **Settings > Integrations** to manage supplier provider settings per workspace.

- Configure DigiKey credentials:
  - client ID
  - client secret
- Configure TME credentials:
  - API token
  - application secret
- Set the active supplier provider (DigiKey or TME).

## Permissions Behavior

- Features can be visible but non-editable if your workspace role does not include the required permission.
- Some actions are disabled when access is read-only.

