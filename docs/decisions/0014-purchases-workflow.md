# 0014 Purchases Workflow

- Status: Accepted
- Date: 2026-06-06

## Context

OSO already tracks parts inventory (stock movements: receipt, issue, transfer, adjustment) and has supplier integrations (DigiKey, TME). The missing piece is the workflow between "I need to buy parts" and "I received parts." Issue #8 asked to define this workflow.

Two distinct concepts were identified:

- **Shopping list** — an informal, ad-hoc list of parts the user wants to buy. No supplier, no formal state.
- **Purchase order** — a formal document sent to one supplier. Tracks state from draft through ordered to received.

## Decision

### Shopping List

- A shopping list is workspace-scoped and has a name and optional notes.
- Shopping list items link to existing parts in the workspace. The UI provides a quick-create path to add a new part inline without leaving the shopping list.
- Shopping lists have no supplier and no status. They are always in an editable, open state.
- The UI shows, per item, whether that item has already been added to a purchase order (tracked via `PurchaseOrderItem.sourceShoppingListItemId`).
- Selected items from a shopping list can be converted into a purchase order for a chosen supplier. This creates a new purchase order and new purchase order items referencing the source shopping list and source shopping list items via foreign keys.

### Purchase Order

- A purchase order is workspace-scoped and is linked to exactly one supplier.
- The supplier is an `Organization` with a `"supplier"` role (following the extensible role model from ADR-0009). An organization can hold both `"manufacturer"` and `"supplier"` roles simultaneously.
- A purchase order has an optional external order number and optional notes.
- Status transitions: `DRAFT → ORDERED → RECEIVED`.
  - A user manually marks an order as `ORDERED` (records `orderedAt`).
  - An order is automatically advanced to `RECEIVED` when all items reach their full received quantity.
- Purchase order items link to existing workspace parts (with quick-create path).
- When adding an item, the active supplier integration (DigiKey or TME) is queried to pre-fill supplier SKU and unit price for that part.
- Partial receives are supported: each item tracks `receivedQuantity` independently. Receiving items generates one `InventoryEntry` (type: `RECEIPT`) per item received, choosing a target storage location at receive time.
- An order can be received in multiple sessions until all items are fully received.

### Traceability

- `PurchaseOrder.sourceShoppingListId` — optional FK back to the shopping list this order was created from.
- `PurchaseOrderItem.sourceShoppingListItemId` — optional FK back to the shopping list item this order item was created from.
- Both FKs are nullable because orders may be created independently of any shopping list.

### Permissions

New permission keys added to the workspace access control model:

| Key | Description |
|-----|-------------|
| `shopping-lists:read` | View shopping lists and their items |
| `shopping-lists:write` | Create, update, delete shopping lists and items; convert to order |
| `purchase-orders:read` | View purchase orders and their items |
| `purchase-orders:write` | Create, update, delete purchase orders; mark ordered; receive items |

Assigned to system roles: `owner` and `editor` receive all four; `reader` receives the two `:read` keys.

## Consequences

- The `Organization` model now supports a `"supplier"` role in addition to `"manufacturer"`. Existing manufacturer organizations are unaffected.
- Receiving a purchase order item automatically creates an inventory `RECEIPT` movement. Users do not need to create receipt movements manually after receiving an order.
- A shopping list item that has been added to a purchase order shows a visual indicator in the shopping list UI; however, it is not removed from the shopping list automatically.
- Pricing fields (`unitPrice`, `currency`) on purchase order items are optional and pre-filled from supplier integration when available. No workspace-level pricing policy is defined by this decision.
- Future BOM workflows (Issue #9) may link to purchase orders or shopping lists, but that relationship is left undefined until BOM behavior is decided.
