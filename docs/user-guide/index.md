---
title: OSO User Guide
---

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
5. Create your own account on the sign-up screen. (Further accounts need `OSO_AUTH_ALLOW_SIGN_UP=1`; see the deployment guide.)
6. Sign in with the account you created.

To stop the app, press `Ctrl+C` in the terminal where it is running.

## Run OSO On A Server (Self-Hosting)

To run OSO on an always-on server such as a Raspberry Pi, using a prebuilt image and your
own PostgreSQL database, see the [Deployment guide](deployment.md).

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
12. Run builds of a design revision to allocate, reserve, and consume parts and produce the output part.

## Working With Lists

- **Row buttons.** The small icon buttons at the end of a list row (edit, delete, add to purchase
  order, add to shopping list, and so on) show their name in a tooltip when you rest the mouse on
  them for a moment, or when you reach them with the keyboard.
- **Links to related records.** Where a list shows a related part, purchase order or shopping list,
  hovering the row reveals a small link icon next to its name. Rest the mouse on the icon to see a
  short preview without leaving the page — manufacturer, catalog number and description for a part;
  supplier, status and number of items for a purchase order; name, description and number of items
  for a shopping list. Click the icon to open that record.

## Guide Sections

- [Workspaces](workspaces.md) — sign in, create, archive, restore, delete workspaces
- [Organizations](organizations.md) — manage manufacturers and suppliers
- [Parts](parts.md) — create and manage parts, categories, attributes, and units
- [Designs](designs.md) — designs, revisions, and bills of materials
- [Builds](builds.md) — production runs that allocate, reserve, and consume stock
- [Inventory](inventory.md) — storage locations and stock movements
- [Purchasing](purchasing.md) — shopping lists and purchase orders
- [Integrations](integrations.md) — DigiKey, TME, and currency settings
- [Settings & Permissions](settings.md) — workspace settings, access control and personal API tokens
- [API and MCP](api-and-mcp.md) — use OSO from scripts and connect Claude to it
- [Deployment](deployment.md) — self-host OSO on your own server with a prebuilt image
- [Instance administration](admin.md) — accounts, storage, registration and feedback for the whole instance (administrator only)
- [Sending feedback](feedback.md) — tell the people who build OSO about a problem, an idea or a question
