-- AlterTable: add valueSortNumber for DB-level sort by the primary category's value attribute.
-- This stores the numeric sort key (quantityBaseValue or numberValue) for the part's value attribute.
-- Parts with TEXT/CHOICE/BOOLEAN value attributes have valueSortNumber = NULL and sort last.
ALTER TABLE "Part" ADD COLUMN "valueSortNumber" DECIMAL(65,30);

-- CreateIndex
CREATE INDEX "Part_workspaceId_valueSortNumber_id_idx" ON "Part"("workspaceId", "valueSortNumber", "id");

-- Backfill from the primary category's direct valueAttributeId (non-inherited only).
-- Parts in categories that inherit their value attribute will be updated on the next part save.
UPDATE "Part" p
SET "valueSortNumber" = COALESCE(
  (SELECT pav."quantityBaseValue"
   FROM "PartAttributeValue" pav
   JOIN "PartCategory" pc ON pc."valueAttributeId" = pav."attributeId"
   WHERE pav."partId" = p.id AND pc.id = p."primaryCategoryId"
   AND pav."quantityBaseValue" IS NOT NULL LIMIT 1),
  (SELECT pav."numberValue"
   FROM "PartAttributeValue" pav
   JOIN "PartCategory" pc ON pc."valueAttributeId" = pav."attributeId"
   WHERE pav."partId" = p.id AND pc.id = p."primaryCategoryId"
   AND pav."numberValue" IS NOT NULL LIMIT 1)
)
WHERE p."primaryCategoryId" IS NOT NULL;
