-- Add createdByUserId and supplierOrderNumber to PurchaseOrder

ALTER TABLE "PurchaseOrder" ADD COLUMN "createdByUserId" TEXT;
ALTER TABLE "PurchaseOrder" ADD COLUMN "supplierOrderNumber" TEXT;

ALTER TABLE "PurchaseOrder"
  ADD CONSTRAINT "PurchaseOrder_createdByUserId_fkey"
  FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
