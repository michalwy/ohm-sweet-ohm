-- Issue #184: denormalized quantity for a Design's output part currently being produced by
-- active builds (STARTED/IN_PROGRESS), maintained the same way as allocatedQty/reservedQty.
ALTER TABLE "Part" ADD COLUMN     "inProductionQty" DECIMAL(65,30) NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "Part_workspaceId_inProductionQty_id_idx" ON "Part"("workspaceId", "inProductionQty", "id");
