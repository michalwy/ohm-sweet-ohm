-- AlterTable
ALTER TABLE "PurchaseOrderAdditionalCost" ADD COLUMN     "taxRate" DECIMAL(65,30),
ADD COLUMN     "grossAmount" DECIMAL(65,30),
ADD COLUMN     "amountPrimary" DECIMAL(65,30),
ADD COLUMN     "grossAmountPrimary" DECIMAL(65,30);
