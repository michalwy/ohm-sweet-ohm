-- AlterTable: add stored totals to PurchaseOrder
ALTER TABLE "PurchaseOrder"
  ADD COLUMN "totalNetValue"        DECIMAL,
  ADD COLUMN "totalGrossValue"      DECIMAL,
  ADD COLUMN "totalNetValuePrimary"    DECIMAL,
  ADD COLUMN "totalGrossValuePrimary"  DECIMAL;

-- AlterTable: add line-total columns to PurchaseOrderItem
ALTER TABLE "PurchaseOrderItem"
  ADD COLUMN "lineNetValue"          DECIMAL,
  ADD COLUMN "lineGrossValue"        DECIMAL,
  ADD COLUMN "lineNetValuePrimary"   DECIMAL,
  ADD COLUMN "lineGrossValuePrimary" DECIMAL;

-- CreateIndex
CREATE INDEX "PurchaseOrder_workspaceId_totalNetValue_idx" ON "PurchaseOrder"("workspaceId", "totalNetValue");
CREATE INDEX "PurchaseOrder_workspaceId_totalGrossValue_idx" ON "PurchaseOrder"("workspaceId", "totalGrossValue");
CREATE INDEX "PurchaseOrder_workspaceId_totalNetValuePrimary_idx" ON "PurchaseOrder"("workspaceId", "totalNetValuePrimary");
CREATE INDEX "PurchaseOrder_workspaceId_totalGrossValuePrimary_idx" ON "PurchaseOrder"("workspaceId", "totalGrossValuePrimary");

-- Backfill item line net/gross from unitPrice × quantity (same currency only).
-- unitPrice is always stored as net (the UI converts gross→net before submitting).
-- Primary variants stay NULL — populated on next write mutation.
UPDATE "PurchaseOrderItem" poi
SET
  "lineNetValue"  = poi."quantity" * poi."unitPrice",
  "lineGrossValue" = poi."quantity" * poi."unitPrice" * (1 + COALESCE(poi."taxRate", po."taxRate", 0) / 100)
FROM "PurchaseOrder" po
WHERE po."id" = poi."purchaseOrderId"
  AND poi."unitPrice" IS NOT NULL
  AND (poi."currency" IS NULL OR poi."currency" = po."currency");

-- Backfill order-level net/gross from item line totals.
UPDATE "PurchaseOrder" po
SET
  "totalNetValue"   = sub.net,
  "totalGrossValue" = sub.gross
FROM (
  SELECT "purchaseOrderId", SUM("lineNetValue") AS net, SUM("lineGrossValue") AS gross
  FROM "PurchaseOrderItem"
  WHERE "lineNetValue" IS NOT NULL
  GROUP BY "purchaseOrderId"
) sub
WHERE po."id" = sub."purchaseOrderId";
