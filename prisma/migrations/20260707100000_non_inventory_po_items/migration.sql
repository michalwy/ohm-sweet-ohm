-- AlterTable
ALTER TABLE "PurchaseOrderItem" ADD COLUMN "description" TEXT,
ALTER COLUMN "partId" DROP NOT NULL;
