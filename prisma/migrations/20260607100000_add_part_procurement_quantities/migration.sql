ALTER TABLE "Part"
  ADD COLUMN "plannedQty" DECIMAL NOT NULL DEFAULT 0,
  ADD COLUMN "onOrderQty" DECIMAL NOT NULL DEFAULT 0;

-- plannedQty = unconverted SL items (no linked PO item) + direct draft PO items (no SL source)
UPDATE "Part" p
SET "plannedQty" =
  COALESCE((
    SELECT SUM(sli."quantity")
    FROM "ShoppingListItem" sli
    WHERE sli."partId" = p."id"
      AND NOT EXISTS (
        SELECT 1 FROM "PurchaseOrderItem" poi
        WHERE poi."sourceShoppingListItemId" = sli."id"
      )
  ), 0)
  +
  COALESCE((
    SELECT SUM(poi."quantity")
    FROM "PurchaseOrderItem" poi
    JOIN "PurchaseOrder" po ON poi."purchaseOrderId" = po."id"
    WHERE poi."partId" = p."id"
      AND po."status" = 'DRAFT'
      AND poi."sourceShoppingListItemId" IS NULL
  ), 0);

-- onOrderQty = PO items in ORDERED status
UPDATE "Part" p
SET "onOrderQty" = COALESCE((
  SELECT SUM(poi."quantity")
  FROM "PurchaseOrderItem" poi
  JOIN "PurchaseOrder" po ON poi."purchaseOrderId" = po."id"
  WHERE poi."partId" = p."id" AND po."status" = 'ORDERED'
), 0);

CREATE INDEX "Part_workspaceId_plannedQty_id_idx"
  ON "Part"("workspaceId", "plannedQty", "id");

CREATE INDEX "Part_workspaceId_onOrderQty_id_idx"
  ON "Part"("workspaceId", "onOrderQty", "id");
