-- CreateTable
CREATE TABLE "SupplierCategoryMappingStat" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "sourceCategoryKey" TEXT NOT NULL,
  "targetCategoryId" TEXT NOT NULL,
  "score" INTEGER NOT NULL DEFAULT 0,
  "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SupplierCategoryMappingStat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplierAttributeMappingStat" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "sourceCategoryKey" TEXT NOT NULL,
  "targetCategoryScopeKey" TEXT NOT NULL,
  "sourceAttributeKey" TEXT NOT NULL,
  "targetAttributeId" TEXT NOT NULL,
  "score" INTEGER NOT NULL DEFAULT 0,
  "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SupplierAttributeMappingStat_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE UNIQUE INDEX "SupplierCategoryMappingStat_workspaceId_provider_sourceCategor_key" ON "SupplierCategoryMappingStat"("workspaceId", "provider", "sourceCategoryKey", "targetCategoryId");
CREATE INDEX "SupplierCategoryMappingStat_workspaceId_provider_sourceCategoryK_score_lastUsedAt_idx" ON "SupplierCategoryMappingStat"("workspaceId", "provider", "sourceCategoryKey", "score", "lastUsedAt");

CREATE UNIQUE INDEX "SupplierAttributeMappingStat_workspaceId_provider_sourceAttribu_key" ON "SupplierAttributeMappingStat"("workspaceId", "provider", "sourceCategoryKey", "targetCategoryScopeKey", "sourceAttributeKey", "targetAttributeId");
CREATE INDEX "SupplierAttributeMappingStat_workspaceId_provider_sourceCategoryK_target_idx" ON "SupplierAttributeMappingStat"("workspaceId", "provider", "sourceCategoryKey", "targetCategoryScopeKey", "sourceAttributeKey", "score", "lastUsedAt");
CREATE INDEX "SupplierAttributeMappingStat_workspaceId_targetAttributeId_idx" ON "SupplierAttributeMappingStat"("workspaceId", "targetAttributeId");

-- FKs
ALTER TABLE "SupplierCategoryMappingStat"
  ADD CONSTRAINT "SupplierCategoryMappingStat_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SupplierAttributeMappingStat"
  ADD CONSTRAINT "SupplierAttributeMappingStat_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SupplierAttributeMappingStat"
  ADD CONSTRAINT "SupplierAttributeMappingStat_targetAttributeId_fkey"
  FOREIGN KEY ("targetAttributeId") REFERENCES "Attribute"("id") ON DELETE CASCADE ON UPDATE CASCADE;
