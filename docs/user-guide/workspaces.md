# Workspaces

## Sign In And Enter A Workspace

When you open OSO, start by signing in (or signing up if this is your first time).

After sign-in, you land on **Workspaces**. This is your entry point to everything else:

- create a new workspace by entering a name
- open an existing workspace
- sign out from the header

Think of a workspace as one workshop environment with its own parts, categories, attributes, locations, and settings.

### Starting Data Presets

When creating a workspace you can choose one of four starting data options:

- **Empty workspace** (default) — the workspace starts with no data. Best when you want to build your part library from scratch.
- **Starter dictionaries only** — seeds only the dictionary layer: a broad category tree (modeled after a real electronics distributor's category hierarchy — passives, semiconductors, ICs, optoelectronics, electromechanical, connectors, crystals/timing, protection, and sensors, each broken into specific subcategories) with the correct attribute bindings, a curated attribute list, common manufacturers and suppliers, and a few extra stock-keeping units (Grams, Rolls, Boxes, Sets) alongside the always-on Pieces/Meters/Liters. No parts, locations, or stock are created — ideal when you want a head start on setup but plan to enter your own real parts.
- **Demo parts** — seeds the workspace with ~250 real electronic parts across common categories (resistors, capacitors, MOSFETs, microcontrollers, connectors, and more), complete with categories, attributes, manufacturers, and storage locations.
- **Demo parts + orders** — everything in "Demo parts" plus two shopping lists and three purchase orders (one received, one ordered, one draft) so you can explore the full ordering workflow immediately.

Seeded data behaves identically to data you create yourself — you can edit, delete, or extend any of it. The preset cannot be changed after the workspace is created.

Unlike the demo presets, starter dictionaries can also be loaded into an existing workspace at any time from **Settings → General** — see below.

### Archiving And Restoring A Workspace

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

**Automatic deletion after the retention period:** Archived workspaces are automatically and permanently deleted after a retention period (default: 30 days). The Workspaces page shows the scheduled deletion date next to each archived workspace. If you restore the workspace before that date, the automatic deletion is cancelled. Once the retention period expires and deletion is scheduled, restoration is no longer possible.

### Loading Starter Dictionaries Into An Existing Workspace

If a workspace started empty and you want the same head start the "Starter dictionaries only" preset gives at creation, you can load it at any time from **Settings → General**.

This action is **additive and non-destructive**: it only adds categories, attributes, manufacturers/suppliers, and extra stock units that don't already exist — it never deletes or overwrites existing data, and it does not add any parts, locations, or stock. It is safe to run more than once.

**To load starter dictionaries** (admins only):

1. Open the workspace.
2. Navigate to **Settings → General**.
3. Click **Load starter dictionaries**.

### Resetting A Workspace To Demo Data

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

### Permanently Deleting A Workspace

Permanent deletion removes the workspace and all of its data — parts, inventory, purchase orders, organizations, attributes, and everything else — completely and irreversibly.

Deletion can happen in two ways:
- **Automatically** — after the retention period expires (default: 30 days after archiving), the system schedules deletion without any manual action. See the note above under archiving.
- **Manually** — an admin triggers deletion immediately from the Workspaces page.

**Requirements:**
- The workspace must be archived first. Permanent deletion is only available from the archived state.
- Only workspace admins can trigger manual deletion.

**To permanently delete an archived workspace** (admins only):

1. Open the Workspaces page.
2. Scroll to the **Archived workspaces** section.
3. Click **Permanently delete** next to the workspace.
4. In the confirmation dialog, type the exact workspace name and click **Delete**.

Once deletion is confirmed, the workspace enters a **"Deletion in progress"** state visible on the Workspaces page. The Restore button disappears; restoration is no longer possible. The actual deletion runs in the background and the workspace disappears from all views when complete.

**There is no undo.** If you are unsure, restore the workspace first and leave it archived until you are certain.

### Switching Between Light And Dark Theme

OSO supports both a **Light** and a **Dark** color theme. The toggle is located at the bottom of the sidebar inside any workspace. Your preference is saved in the browser and restored automatically on your next visit.
