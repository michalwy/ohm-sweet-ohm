-- Issue #186: single at-a-glance "Balance" figure combining every quantity already tracked
-- on Part. Like availableQty (#173), balanceQty has no independent write path -- it is always
-- (currentStock - reservedQty) + onOrderQty + inProductionQty - allocatedQty -- so it is a
-- Postgres STORED generated column rather than an application-maintained denormalized field.
-- Generated columns cannot reference another generated column, so the formula is spelled out
-- against the base columns instead of reusing availableQty.
ALTER TABLE "Part" ADD COLUMN "balanceQty" DECIMAL(65,30) GENERATED ALWAYS AS (("currentStock" - "reservedQty") + "onOrderQty" + "inProductionQty" - "allocatedQty") STORED;

-- CreateIndex
CREATE INDEX "Part_workspaceId_balanceQty_id_idx" ON "Part"("workspaceId", "balanceQty", "id");
