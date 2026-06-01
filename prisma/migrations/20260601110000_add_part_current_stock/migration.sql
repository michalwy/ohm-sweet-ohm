ALTER TABLE "Part"
  ADD COLUMN "currentStock" DECIMAL NOT NULL DEFAULT 0;

UPDATE "Part" p
SET "currentStock" = COALESCE(balance."quantity", 0)
FROM (
  SELECT "partId", SUM(delta) AS "quantity"
  FROM (
    SELECT "partId", "quantity" AS delta
    FROM "InventoryEntry"
    WHERE "toLocationId" IS NOT NULL
      AND "entryType" IN ('RECEIPT', 'TRANSFER', 'ADJUSTMENT')
    UNION ALL
    SELECT "partId", -"quantity" AS delta
    FROM "InventoryEntry"
    WHERE "fromLocationId" IS NOT NULL
      AND "entryType" IN ('ISSUE', 'TRANSFER')
  ) deltas
  GROUP BY "partId"
) balance
WHERE p."id" = balance."partId";

CREATE INDEX "Part_workspaceId_currentStock_id_idx"
  ON "Part"("workspaceId", "currentStock", "id");
