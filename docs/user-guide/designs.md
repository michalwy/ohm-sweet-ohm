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

Click **Edit** on a design to open the edit dialog. It has two tabs:

**Details tab** — edit the design name and description.

**Revisions tab** — view and manage the revision history.

- Each revision has a revision number (v1, v2, …) and optional notes.
- To add a new revision, click **Add revision** and optionally enter notes.
- To edit revision notes, click **Edit notes** next to a revision.
- Revision numbers are assigned automatically and cannot be changed.

### Deleting a Design

Click **Delete** on a design and confirm.

Deletion is blocked if the output part has any recorded inventory (current stock above zero or any historical stock movements). Move stock to zero and ensure no inventory history exists before deleting.

## Assembled Parts in the Parts List

The Parts list includes an optional **Source** column (hidden by default — enable it via **Configure list**). Parts created as the output of a Design show an **Assembled** badge in this column.
