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

## Guide Sections

- [Workspaces](workspaces.md) — sign in, create, archive, restore, delete workspaces
- [Organizations](organizations.md) — manage manufacturers and suppliers
- [Parts](parts.md) — create and manage parts, categories, attributes, and units
- [Inventory](inventory.md) — storage locations and stock movements
- [Purchasing](purchasing.md) — shopping lists and purchase orders
- [Integrations](integrations.md) — DigiKey, TME, and currency settings
- [Settings & Permissions](settings.md) — workspace settings and access control
