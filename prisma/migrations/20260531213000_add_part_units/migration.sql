-- CreateTable
CREATE TABLE "Unit" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "normalizedName" TEXT NOT NULL,
  "symbol" TEXT NOT NULL,
  "allowsFraction" BOOLEAN NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Unit_pkey" PRIMARY KEY ("id")
);

-- AddColumn
ALTER TABLE "Part" ADD COLUMN "unitId" TEXT;

-- CreateIndex (must exist before ON CONFLICT on workspaceId + normalizedName)
CREATE UNIQUE INDEX "Unit_workspaceId_normalizedName_key" ON "Unit"("workspaceId", "normalizedName");
CREATE INDEX "Unit_workspaceId_symbol_idx" ON "Unit"("workspaceId", "symbol");

-- Seed minimal default units per workspace
WITH workspaces AS (
  SELECT id FROM "Workspace"
)
INSERT INTO "Unit" (
  "id",
  "workspaceId",
  "name",
  "normalizedName",
  "symbol",
  "allowsFraction",
  "createdAt",
  "updatedAt"
)
SELECT
  'unit_' || substr(md5(w.id || ':piece'), 1, 24),
  w.id,
  'Pieces',
  'pieces',
  'pcs',
  FALSE,
  now(),
  now()
FROM workspaces w
ON CONFLICT ("workspaceId", "normalizedName") DO NOTHING;

WITH workspaces AS (
  SELECT id FROM "Workspace"
)
INSERT INTO "Unit" (
  "id",
  "workspaceId",
  "name",
  "normalizedName",
  "symbol",
  "allowsFraction",
  "createdAt",
  "updatedAt"
)
SELECT
  'unit_' || substr(md5(w.id || ':meter'), 1, 24),
  w.id,
  'Meters',
  'meters',
  'm',
  TRUE,
  now(),
  now()
FROM workspaces w
ON CONFLICT ("workspaceId", "normalizedName") DO NOTHING;

WITH workspaces AS (
  SELECT id FROM "Workspace"
)
INSERT INTO "Unit" (
  "id",
  "workspaceId",
  "name",
  "normalizedName",
  "symbol",
  "allowsFraction",
  "createdAt",
  "updatedAt"
)
SELECT
  'unit_' || substr(md5(w.id || ':liter'), 1, 24),
  w.id,
  'Liters',
  'liters',
  'L',
  TRUE,
  now(),
  now()
FROM workspaces w
ON CONFLICT ("workspaceId", "normalizedName") DO NOTHING;

-- Backfill existing parts with "Pieces" unit
UPDATE "Part" p
SET "unitId" = u.id
FROM "Unit" u
WHERE u."workspaceId" = p."workspaceId"
  AND u."normalizedName" = 'pieces'
  AND p."unitId" IS NULL;

-- Make unit required
ALTER TABLE "Part" ALTER COLUMN "unitId" SET NOT NULL;

-- CreateIndex
CREATE INDEX "Part_workspaceId_unitId_idx" ON "Part"("workspaceId", "unitId");

-- AddForeignKey
ALTER TABLE "Unit"
  ADD CONSTRAINT "Unit_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Part"
  ADD CONSTRAINT "Part_unitId_fkey"
  FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
