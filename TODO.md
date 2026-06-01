# Project TODO

Keep this list focused on product and implementation work that has been explicitly requested but not yet completed. Do not treat these items as finalized requirements when they say assumptions are still TBD.

## Current priority

- [ ] Purchases: orders and shopping lists; exact assumptions TBD.
- [ ] BOMs: exact assumptions TBD.
- [ ] Inventory: add per-part movement history (chronological ledger) with entry type, quantity, from/to location, note, timestamp, and author.
- [ ] Inventory: make stock updates concurrency-safe (single-transaction validation for non-negative stock on issue/transfer/negative adjustment).
- [ ] Inventory/Locations: define and implement behavior for archived locations with non-zero stock (visibility, blocking rules, and migration path).

## Low priority

- [ ] Improve inventory UX on the parts screen: redesign the stock dialog and movement flow for faster day-to-day use (clearer layout, fewer manual steps, better feedback).
- [ ] Add the ability to open a location from the locations tree and see the parts currently stored in that specific location.
- [ ] Refactor category and location trees to use shared tree-list UI primitives/components (layout, expand/collapse behavior, row styling, and action alignment) to keep both screens visually and behaviorally consistent.
- [ ] Standardize CRUD actions in dialogs/lists: extract shared action component/API (for example edit/delete/cancel) so UX updates can be applied centrally.
- [ ] Improve boolean field presentation in UI: replace plain text values like `Yes/No` and `True/False` with clearer graphical indicators.
- [ ] Add UI for managing workspace organizations and roles (for example manufacturer, supplier, and future organization roles).
- [ ] Import part data from Mouser supplier.
- [ ] Extend supplier category/attribute matching flow to Mouser once that provider is integrated.
