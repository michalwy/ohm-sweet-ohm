-- Add multi-currency pricing support to Purchase Orders and Inventory

-- Workspace primary currency (immutable after creation)
ALTER TABLE "Workspace" ADD COLUMN "primaryCurrency" TEXT NOT NULL DEFAULT 'EUR';

-- Exchange rate cache (global, not workspace-scoped)
CREATE TABLE "ExchangeRate" (
  "id"            TEXT NOT NULL,
  "baseCurrency"  TEXT NOT NULL,
  "quoteCurrency" TEXT NOT NULL,
  "date"          DATE NOT NULL,
  "rate"          DECIMAL(65,30) NOT NULL,
  "fetchedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ExchangeRate_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ExchangeRate_baseCurrency_quoteCurrency_date_key"
  ON "ExchangeRate"("baseCurrency", "quoteCurrency", "date");

CREATE INDEX "ExchangeRate_baseCurrency_quoteCurrency_date_idx"
  ON "ExchangeRate"("baseCurrency", "quoteCurrency", "date");

-- PurchaseOrder: default currency and tax rate for the order
ALTER TABLE "PurchaseOrder" ADD COLUMN "currency" TEXT;
ALTER TABLE "PurchaseOrder" ADD COLUMN "taxRate"  DECIMAL(65,30);

-- PurchaseOrderItem: per-item tax rate override (NULL = inherit from PO)
ALTER TABLE "PurchaseOrderItem" ADD COLUMN "taxRate" DECIMAL(65,30);

-- InventoryEntry: purchase cost tracking for average cost calculation
ALTER TABLE "InventoryEntry" ADD COLUMN "unitCost"         DECIMAL(65,30);
ALTER TABLE "InventoryEntry" ADD COLUMN "costCurrency"     TEXT;
ALTER TABLE "InventoryEntry" ADD COLUMN "unitCostPrimary"  DECIMAL(65,30);
