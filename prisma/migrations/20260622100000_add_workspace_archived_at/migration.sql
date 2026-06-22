-- AlterTable
ALTER TABLE "Workspace" ADD COLUMN "archivedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Workspace_archivedAt_idx" ON "Workspace"("archivedAt");
