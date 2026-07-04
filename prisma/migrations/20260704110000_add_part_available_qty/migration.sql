-- Issue #173: sort the parts list by Available quantity. availableQty has no independent
-- write path (it is always currentStock - reservedQty, per ADR 0021), so it is stored as a
-- Postgres STORED generated column instead of an application-maintained denormalized field.
-- This keeps it always correct without touching entryMutations.ts/builds.ts write sites, and
-- makes it a plain indexed Decimal column usable by the existing DB-level keyset sort helper.
ALTER TABLE "Part" ADD COLUMN "availableQty" DECIMAL(65,30) GENERATED ALWAYS AS ("currentStock" - "reservedQty") STORED;

-- CreateIndex
CREATE INDEX "Part_workspaceId_availableQty_id_idx" ON "Part"("workspaceId", "availableQty", "id");
