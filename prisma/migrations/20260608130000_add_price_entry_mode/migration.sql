-- AlterTable: Workspace — add ordering defaults
ALTER TABLE "Workspace" ADD COLUMN "defaultPriceEntryMode" TEXT NOT NULL DEFAULT 'net';
ALTER TABLE "Workspace" ADD COLUMN "defaultTaxRate" DECIMAL(65,30);

-- AlterTable: Organization — add supplier ordering defaults
ALTER TABLE "Organization" ADD COLUMN "defaultPriceEntryMode" TEXT;
ALTER TABLE "Organization" ADD COLUMN "defaultTaxRate" DECIMAL(65,30);

-- AlterTable: PurchaseOrder — add price entry mode
ALTER TABLE "PurchaseOrder" ADD COLUMN "priceEntryMode" TEXT NOT NULL DEFAULT 'net';
