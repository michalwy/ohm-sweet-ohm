-- AlterTable
ALTER TABLE "StorageLocation"
  ADD COLUMN "isAssignable" BOOLEAN NOT NULL DEFAULT TRUE;

-- CreateIndex
CREATE INDEX "StorageLocation_workspaceId_isAssignable_idx" ON "StorageLocation"("workspaceId", "isAssignable");
