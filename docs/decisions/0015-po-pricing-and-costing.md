# 0015 PO Pricing and Multi-Currency Costing

- Status: Accepted
- Date: 2026-06-08

## Context

ADR-0014 introduced purchase orders with optional `unitPrice` and `currency` per item, but left workspace-level pricing policy undefined. As POs accumulated real pricing data, several gaps became apparent:

1. No way to compare costs across orders denominated in different currencies.
2. No gross/net distinction — tax rates vary significantly across suppliers and regions.
3. No audit trail for what a part actually cost when it was received.
4. No parts-list column showing average historical cost.

## Decision

### Workspace Primary Currency

Every workspace has a required `primaryCurrency` (ISO 4217 code). It is set at workspace creation and **cannot be changed afterwards**, because changing it would silently invalidate all stored primary-currency amounts.

Existing workspaces at migration time are defaulted to `EUR`.

### Net/Gross Model

Prices are stored as **net** (before tax). Gross is always computed: `gross = net × (1 + taxRate / 100)`.

Tax rate (`taxRate`) can be set at the PO level and overridden per item. The effective tax rate for an item follows this cascade:

```
item.taxRate → order.taxRate → supplier.defaultTaxRate → workspace.defaultTaxRate → 0
```

### Price Entry Mode

Each PO has a `priceEntryMode` field (`"net"` or `"gross"`, default `"net"`), set at creation and **immutable** afterwards (like currency).

- **Net mode**: user enters net price in the item dialog; gross is shown as a computed read-only value.
- **Gross mode**: user enters gross price; net is back-calculated as `net = gross / (1 + effectiveTaxRate / 100)` and stored. The computed section shows the resulting net value.

The DB always stores net. Gross is always derived at query/display time.

### Price Entry Mode and Tax Rate Defaults

Default `priceEntryMode` and `defaultTaxRate` can be configured at two levels:

1. **Supplier (Organization)**: per-supplier defaults applied when creating a new PO for that supplier.
2. **Workspace ordering defaults**: fallback when the supplier has no defaults. Managed via Settings → Ordering.

When a supplier is selected in the create-PO dialog, `priceEntryMode` and `taxRate` are auto-filled from the supplier's defaults, falling back to workspace defaults.

### PO Currency

Each purchase order carries an optional `currency` field. If set, all items on that order are assumed to be in that currency unless a per-item currency override is present.

### Two-Currency Display

Whenever a PO's currency differs from the workspace primary currency, amounts are displayed in both:

- In the PO item dialog: `"1.50 USD (≈ 1.38 EUR)"` for gross amounts.
- In the PO detail panel totals footer: net and gross totals in PO currency plus primary-currency equivalents.
- In the PO list: optional `Net value` and `Gross value` columns (in PO currency) plus `Net value (EUR)` and `Gross value (EUR)` columns (in primary currency). All four are hidden by default.

### Exchange Rates

Exchange rates are fetched from the **Frankfurter API** (https://api.frankfurter.app), which publishes ECB reference rates. Rates are cached in the `ExchangeRate` DB table, keyed by `(baseCurrency, quoteCurrency, date)`.

The rate date used for a PO is `orderedAt`. Draft orders (no `orderedAt`) use today's rate for preview purposes; that rate is not frozen until the order is marked as ordered.

Frankfurter returns the nearest preceding business-day rate for weekends and holidays. That rate is stored under the requested date key, so weekend dates map to the most recent available rate.

### Inventory Cost Tracking

When a PO item is received:

- `InventoryEntry.unitCost` — net unit price from the PO item.
- `InventoryEntry.costCurrency` — effective currency (item override → PO currency).
- `InventoryEntry.unitCostPrimary` — `unitCost` converted to the workspace primary currency at the `orderedAt` exchange rate. Stored once and never recalculated, so it represents the historical cost at receive time.

If the exchange rate is unavailable at receive time, `unitCostPrimary` is left `null`.

### Average Part Cost

A new **Avg. cost** column is available in the parts list (hidden by default, requires Purchase Orders read access). It shows the weighted-average net unit cost in the workspace primary currency:

```
avgCost = Σ(quantity × unitCostPrimary) / Σ(quantity)
```

Only `RECEIPT` inventory entries with a non-null `unitCostPrimary` are included. The column is always expressed in the primary currency.

## Consequences

- `Workspace.primaryCurrency` is immutable after creation. There is no migration path to change it; a new workspace must be created if the primary currency was set incorrectly.
- `PurchaseOrder.priceEntryMode` is immutable after creation. It determines how prices were entered but does not affect storage — net is always stored.
- `ExchangeRate` is a global table (not workspace-scoped) because exchange rates are the same for all workspaces. The Frankfurter API is called at most once per `(from, to, date)` triple; subsequent requests are served from the DB cache.
- Gross amounts are never stored — they are always computed from stored net prices. This means historical gross values reflect the tax rate configuration *at query time*, not at order time. This also means back-calculating net from gross at item save time uses the tax rate at the moment of saving, not at order time — so editing the tax rate of an item after creation will change the stored net.
- Parts received before this migration have `unitCostPrimary = null` and are excluded from the average cost calculation.
- See ADR-0014 for the foundational purchases workflow this builds on.
