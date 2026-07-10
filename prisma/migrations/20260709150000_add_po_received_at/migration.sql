-- AlterTable
ALTER TABLE "PurchaseOrder" ADD COLUMN "receivedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "PurchaseOrder_workspaceId_receivedAt_idx" ON "PurchaseOrder"("workspaceId", "receivedAt");
