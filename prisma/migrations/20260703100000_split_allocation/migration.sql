-- Split allocation: a BOM line may be fulfilled from multiple parts (issue #64, refs #9).
-- BuildLineItem loses its single part + source location; those move to a new per-entry
-- BuildLineAllocation table, and BuildDesignatorAssignment gains a per-(designator × part) grain.

-- DropForeignKey
ALTER TABLE "BuildLineItem" DROP CONSTRAINT "BuildLineItem_partId_fkey";

-- DropForeignKey
ALTER TABLE "BuildLineItem" DROP CONSTRAINT "BuildLineItem_sourceLocationId_fkey";

-- DropIndex
DROP INDEX "BuildLineItem_partId_idx";

-- AlterTable
ALTER TABLE "BuildLineItem" DROP COLUMN "partId",
DROP COLUMN "sourceLocationId";

-- AlterTable
ALTER TABLE "BuildDesignatorAssignment" ADD COLUMN     "partId" TEXT,
ADD COLUMN     "sourceLocationId" TEXT;

-- CreateTable
CREATE TABLE "BuildLineAllocation" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "buildLineItemId" TEXT NOT NULL,
    "partId" TEXT NOT NULL,
    "sourceLocationId" TEXT,
    "quantity" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BuildLineAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BuildLineAllocation_workspaceId_idx" ON "BuildLineAllocation"("workspaceId");

-- CreateIndex
CREATE INDEX "BuildLineAllocation_buildLineItemId_idx" ON "BuildLineAllocation"("buildLineItemId");

-- CreateIndex
CREATE INDEX "BuildLineAllocation_partId_idx" ON "BuildLineAllocation"("partId");

-- CreateIndex
CREATE INDEX "BuildDesignatorAssignment_partId_idx" ON "BuildDesignatorAssignment"("partId");

-- AddForeignKey
ALTER TABLE "BuildLineAllocation" ADD CONSTRAINT "BuildLineAllocation_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BuildLineAllocation" ADD CONSTRAINT "BuildLineAllocation_buildLineItemId_fkey" FOREIGN KEY ("buildLineItemId") REFERENCES "BuildLineItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BuildLineAllocation" ADD CONSTRAINT "BuildLineAllocation_partId_fkey" FOREIGN KEY ("partId") REFERENCES "Part"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BuildLineAllocation" ADD CONSTRAINT "BuildLineAllocation_sourceLocationId_fkey" FOREIGN KEY ("sourceLocationId") REFERENCES "StorageLocation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BuildDesignatorAssignment" ADD CONSTRAINT "BuildDesignatorAssignment_partId_fkey" FOREIGN KEY ("partId") REFERENCES "Part"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BuildDesignatorAssignment" ADD CONSTRAINT "BuildDesignatorAssignment_sourceLocationId_fkey" FOREIGN KEY ("sourceLocationId") REFERENCES "StorageLocation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
