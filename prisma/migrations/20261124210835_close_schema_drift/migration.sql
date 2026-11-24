-- Issue #304: close the drift between prisma/schema.prisma and the database. Nothing here
-- rewrites or drops a value; it is safe on a database with real data.
--
-- * Part.availableQty and Part.balanceQty are STORED generated columns (20260704110000,
--   20260706100000) computed only from columns that are already NOT NULL (currentStock,
--   reservedQty, onOrderQty, inProductionQty, allocatedQty), so no row can hold NULL in them and
--   no backfill is needed. SET NOT NULL only validates that; if it ever found a NULL it would stop
--   the migration rather than change data.
-- * Index renames change catalogue names only. The old names were written by hand (and some were
--   cut at PostgreSQL's 63-character limit); the new ones are the names Prisma derives. No code
--   refers to an index by name.
-- * The number-precision drift is closed in the schema, not here: the columns that are
--   unconstrained NUMERIC in the database are declared `@db.Decimal` (no precision) in the schema.
--   Converting them to DECIMAL(65,30) would round any value with more than 30 decimal places, and
--   PostgreSQL produces such values (e.g. a product of two DECIMAL(65,30) values has scale 60), so
--   the wider type the database already has is kept.

-- AlterTable
ALTER TABLE "Part" ALTER COLUMN "availableQty" SET NOT NULL,
ALTER COLUMN "balanceQty" SET NOT NULL;

-- RenameIndex
ALTER INDEX "BuildDesignatorAssignment_buildLineItemId_designator_unitI_key" RENAME TO "BuildDesignatorAssignment_buildLineItemId_designator_unitIn_key";

-- RenameIndex
ALTER INDEX "SupplierAttributeMappingStat_workspaceId_provider_sourceAttribu" RENAME TO "SupplierAttributeMappingStat_workspaceId_provider_sourceCat_key";

-- RenameIndex
ALTER INDEX "SupplierAttributeMappingStat_workspaceId_provider_sourceCategor" RENAME TO "SupplierAttributeMappingStat_workspaceId_provider_sourceCat_idx";

-- RenameIndex
ALTER INDEX "SupplierCategoryMappingStat_workspaceId_provider_sourceCategor_" RENAME TO "SupplierCategoryMappingStat_workspaceId_provider_sourceCate_key";

-- RenameIndex
ALTER INDEX "SupplierCategoryMappingStat_workspaceId_provider_sourceCategory" RENAME TO "SupplierCategoryMappingStat_workspaceId_provider_sourceCate_idx";

-- RenameIndex
ALTER INDEX "SupplierManufacturerMapStat_ws_provider_source_score_used_idx" RENAME TO "SupplierManufacturerMappingStat_workspaceId_provider_source_idx";

-- RenameIndex
ALTER INDEX "SupplierManufacturerMapStat_ws_provider_source_target_key" RENAME TO "SupplierManufacturerMappingStat_workspaceId_provider_source_key";

-- RenameIndex
ALTER INDEX "SupplierManufacturerMapStat_ws_targetManufacturerId_idx" RENAME TO "SupplierManufacturerMappingStat_workspaceId_targetManufactu_idx";
