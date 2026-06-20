-- Add denormalized moving-average cost fields to Part
ALTER TABLE "Part"
  ADD COLUMN "avgNetCostPrimary"   DECIMAL,
  ADD COLUMN "avgGrossCostPrimary" DECIMAL;

-- Add gross cost capture field to InventoryEntry
ALTER TABLE "InventoryEntry"
  ADD COLUMN "unitGrossCostPrimary" DECIMAL;

-- Backfill avgNetCostPrimary: weighted average of all historical RECEIPT entries
WITH receipt_costs AS (
  SELECT "partId",
         SUM("unitCostPrimary" * quantity) AS total_cost,
         SUM(quantity)                     AS total_qty
  FROM "InventoryEntry"
  WHERE "entryType" = 'RECEIPT'
    AND "unitCostPrimary" IS NOT NULL
  GROUP BY "partId"
)
UPDATE "Part" p
SET "avgNetCostPrimary" = rc.total_cost / rc.total_qty
FROM receipt_costs rc
WHERE rc."partId" = p.id
  AND rc.total_qty > 0;

-- avgGrossCostPrimary stays NULL for historical data (tax rate not stored on InventoryEntry)
-- unitGrossCostPrimary stays NULL for historical entries (column default NULL)

CREATE INDEX "Part_workspaceId_avgNetCostPrimary_id_idx"
  ON "Part"("workspaceId", "avgNetCostPrimary", "id");
CREATE INDEX "Part_workspaceId_avgGrossCostPrimary_id_idx"
  ON "Part"("workspaceId", "avgGrossCostPrimary", "id");
