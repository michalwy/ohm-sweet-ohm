# Product Brief

## Name

OhmSweetOhm, abbreviated as OSO.

## Purpose

OhmSweetOhm is a web application for managing a home electronics workshop. Exact workflows must be defined through future product decisions.

## Language

The app starts in English. Additional languages should be possible later.

## Initial Scope

The first product feature is a parts list.

Parts currently represent real purchasable electronic parts and are tracked by manufacturer organization and catalog number. A part is unique within a workspace by the combination of manufacturer organization and catalog number. The manufacturer organization is a reusable workspace-scoped entity so the same organization can later take other roles if those workflows are defined.

Current implemented extension scope beyond the base parts list includes:

- workspace-scoped part categories and category attributes
- workspace-scoped attribute dictionary
- workspace-scoped units
- workspace-scoped storage locations
- stock movements (receipt, issue, transfer, adjustment)
- supplier integration settings (DigiKey and TME) and active provider selection
- shopping lists (informal lists of parts to buy)
- purchase orders (formal per-supplier orders with item-level receive flow)

Location lifecycle rule: a location can be archived only when its stock balance is zero. Archived locations are read-only for inventory movement purposes and remain visible in stock views when they still hold non-zero balances from earlier history.

Purchases workflow decisions (see ADR-0014): shopping lists are informal and ad-hoc with no supplier or status; purchase orders are formal per-supplier documents with states DRAFT → ORDERED → RECEIVED; receiving items automatically creates RECEIPT inventory entries; shopping list items can be converted into a purchase order; suppliers are Organizations with a `"supplier"` role; DigiKey/TME integration is used to look up supplier SKU when adding items to a purchase order.

BOM workflows, pricing policy, lifecycle states, and import behavior are still intentionally undefined.

## Open Questions

- Should parts later include optional descriptive fields such as category, package, attributes, datasheets, or vendor links?
- Should the app optimize for a single-user home lab first, or prepare for multi-user/team usage from the beginning?
- Should OSO support offline-first usage?
- Which deployment targets matter first?
