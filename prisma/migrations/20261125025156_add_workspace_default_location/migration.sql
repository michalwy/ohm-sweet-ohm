-- AlterTable
ALTER TABLE "Workspace" ADD COLUMN     "defaultLocationId" TEXT;

-- AddForeignKey
ALTER TABLE "Workspace" ADD CONSTRAINT "Workspace_defaultLocationId_fkey" FOREIGN KEY ("defaultLocationId") REFERENCES "StorageLocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
