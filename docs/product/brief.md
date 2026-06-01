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

BOM workflows, purchase-order workflows, pricing policy, lifecycle states, and import behavior are still intentionally undefined.

## Open Questions

- What is the first workflow OSO should support?
- Should parts later include optional descriptive fields such as category, package, attributes, datasheets, or vendor links?
- Should the app optimize for a single-user home lab first, or prepare for multi-user/team usage from the beginning?
- Should OSO support offline-first usage?
- Which deployment targets matter first?
