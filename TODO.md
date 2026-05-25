# Project TODO

Keep this list focused on product and implementation work that has been explicitly requested but not yet completed. Do not treat these items as finalized requirements when they say assumptions are still TBD.

- [ ] List configuration: visible columns, column order, sorting, and column widths.
- [ ] Quick category creation from a path-like name, for example `Passives / Capacitors / Audio / Electrolytic`. The system should check whether each category level exists, create missing levels, mark the final category as assignable, and mark intermediate categories as organizational.
- [ ] Global attributes attached to all root categories.
- [ ] Category dialog parent selector should use the same tree control used elsewhere.
- [ ] When the parts list is filtered by category, adding a new part should preselect the same category if that filtered category is assignable.
- [ ] Review user-facing text, for example whether "real purchasable parts" sounds right and whether the part dialog should mention more than catalog number and manufacturer.
- [ ] Import part data from external suppliers. Define interfaces/abstractions first; initial candidates are DigiKey, Mouser, or TME.
- [ ] Locations: exact assumptions TBD.
- [ ] Stock/inventory states: exact assumptions TBD.
- [ ] Purchases: orders and shopping lists; exact assumptions TBD.
- [ ] BOMs: exact assumptions TBD.
