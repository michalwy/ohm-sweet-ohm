-- CreateTable
CREATE TABLE "PurchaseOrderAdditionalCost" (
    "id" TEXT NOT NULL,
    "purchaseOrderId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PurchaseOrderAdditionalCost_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PurchaseOrderAdditionalCost_purchaseOrderId_idx" ON "PurchaseOrderAdditionalCost"("purchaseOrderId");

-- AddForeignKey
ALTER TABLE "PurchaseOrderAdditionalCost" ADD CONSTRAINT "PurchaseOrderAdditionalCost_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
