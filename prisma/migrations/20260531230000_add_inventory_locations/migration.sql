-- CreateEnum
CREATE TYPE "InventoryEntryType" AS ENUM ('RECEIPT', 'ISSUE', 'TRANSFER', 'ADJUSTMENT');

-- CreateTable
CREATE TABLE "StorageLocation" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "parentId" TEXT,
  "name" TEXT NOT NULL,
  "normalizedName" TEXT NOT NULL,
  "isArchived" BOOLEAN NOT NULL DEFAULT FALSE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "StorageLocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryEntry" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "partId" TEXT NOT NULL,
  "entryType" "InventoryEntryType" NOT NULL,
  "quantity" DECIMAL(65,30) NOT NULL,
  "fromLocationId" TEXT,
  "toLocationId" TEXT,
  "note" TEXT,
  "createdByMemberId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "InventoryEntry_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "Part" ADD COLUMN "defaultLocationId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "StorageLocation_workspaceId_parentId_normalizedName_key" ON "StorageLocation"("workspaceId", "parentId", "normalizedName");
CREATE INDEX "StorageLocation_workspaceId_parentId_idx" ON "StorageLocation"("workspaceId", "parentId");
CREATE INDEX "StorageLocation_workspaceId_isArchived_idx" ON "StorageLocation"("workspaceId", "isArchived");
CREATE INDEX "StorageLocation_workspaceId_name_idx" ON "StorageLocation"("workspaceId", "name");

CREATE INDEX "InventoryEntry_workspaceId_partId_createdAt_idx" ON "InventoryEntry"("workspaceId", "partId", "createdAt");
CREATE INDEX "InventoryEntry_workspaceId_fromLocationId_idx" ON "InventoryEntry"("workspaceId", "fromLocationId");
CREATE INDEX "InventoryEntry_workspaceId_toLocationId_idx" ON "InventoryEntry"("workspaceId", "toLocationId");
CREATE INDEX "InventoryEntry_workspaceId_entryType_createdAt_idx" ON "InventoryEntry"("workspaceId", "entryType", "createdAt");

CREATE INDEX "Part_workspaceId_defaultLocationId_idx" ON "Part"("workspaceId", "defaultLocationId");

-- AddForeignKey
ALTER TABLE "StorageLocation"
  ADD CONSTRAINT "StorageLocation_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "StorageLocation"
  ADD CONSTRAINT "StorageLocation_parentId_fkey"
  FOREIGN KEY ("parentId") REFERENCES "StorageLocation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Part"
  ADD CONSTRAINT "Part_defaultLocationId_fkey"
  FOREIGN KEY ("defaultLocationId") REFERENCES "StorageLocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "InventoryEntry"
  ADD CONSTRAINT "InventoryEntry_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "InventoryEntry"
  ADD CONSTRAINT "InventoryEntry_partId_fkey"
  FOREIGN KEY ("partId") REFERENCES "Part"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "InventoryEntry"
  ADD CONSTRAINT "InventoryEntry_fromLocationId_fkey"
  FOREIGN KEY ("fromLocationId") REFERENCES "StorageLocation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "InventoryEntry"
  ADD CONSTRAINT "InventoryEntry_toLocationId_fkey"
  FOREIGN KEY ("toLocationId") REFERENCES "StorageLocation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "InventoryEntry"
  ADD CONSTRAINT "InventoryEntry_createdByMemberId_fkey"
  FOREIGN KEY ("createdByMemberId") REFERENCES "WorkspaceMember"("id") ON DELETE SET NULL ON UPDATE CASCADE;
