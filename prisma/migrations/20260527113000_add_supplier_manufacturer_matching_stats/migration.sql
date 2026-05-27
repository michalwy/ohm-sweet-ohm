-- CreateTable
CREATE TABLE "SupplierManufacturerMappingStat" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "sourceManufacturerKey" TEXT NOT NULL,
  "targetManufacturerId" TEXT NOT NULL,
  "score" INTEGER NOT NULL DEFAULT 0,
  "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SupplierManufacturerMappingStat_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE UNIQUE INDEX "SupplierManufacturerMapStat_ws_provider_source_target_key" ON "SupplierManufacturerMappingStat"("workspaceId", "provider", "sourceManufacturerKey", "targetManufacturerId");
CREATE INDEX "SupplierManufacturerMapStat_ws_provider_source_score_used_idx" ON "SupplierManufacturerMappingStat"("workspaceId", "provider", "sourceManufacturerKey", "score", "lastUsedAt");
CREATE INDEX "SupplierManufacturerMapStat_ws_targetManufacturerId_idx" ON "SupplierManufacturerMappingStat"("workspaceId", "targetManufacturerId");

-- FKs
ALTER TABLE "SupplierManufacturerMappingStat"
  ADD CONSTRAINT "SupplierManufacturerMappingStat_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SupplierManufacturerMappingStat"
  ADD CONSTRAINT "SupplierManufacturerMappingStat_targetManufacturerId_fkey"
  FOREIGN KEY ("targetManufacturerId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
