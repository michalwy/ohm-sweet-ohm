-- AlterTable
ALTER TABLE "PartCategory" ADD COLUMN "sortPath" TEXT;

-- CreateIndex
CREATE INDEX "PartCategory_workspaceId_sortPath_idx" ON "PartCategory"("workspaceId", "sortPath");

-- Backfill sortPath for all existing categories using a recursive CTE.
-- sortPath is the full lowercase ancestor path, e.g. "electronics » resistors".
-- The separator matches PART_CATEGORY_PATH_SEPARATOR in src/server/parts/categories.ts.
WITH RECURSIVE cat_path(id, sort_path) AS (
  SELECT id, lower(name)
  FROM "PartCategory"
  WHERE "parentId" IS NULL
  UNION ALL
  SELECT c.id, concat(p.sort_path, ' » ', lower(c.name))
  FROM "PartCategory" c
  JOIN cat_path p ON c."parentId" = p.id
)
UPDATE "PartCategory" pc
SET "sortPath" = cp.sort_path
FROM cat_path cp
WHERE pc.id = cp.id;
