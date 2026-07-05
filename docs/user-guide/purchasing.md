# Purchasing

## Manage Shopping Lists

Use **Shopping Lists** to keep an informal running list of parts you want to buy.

A shopping list has no supplier and no formal status — it is a flexible scratchpad.

Shopping list items can also be added directly from a Design's **Shortage analysis** — see
[Designs](designs.md#shortage-analysis).

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

## Manage Purchase Orders

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

**Inline price editing** — on the line items list, click the unit price or line total cell to edit it directly. Editing either field recalculates the other (`unitPrice = lineTotal / quantity` or `lineTotal = unitPrice * quantity`), respecting the order's price entry mode. Press Enter or click away to save, Escape to cancel. Not available once the order is fully received.

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
