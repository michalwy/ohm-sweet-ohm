-- CreateEnum
CREATE TYPE "BuildState" AS ENUM ('CREATED', 'ALLOCATED', 'STARTED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- AlterTable
ALTER TABLE "Part" ADD COLUMN     "allocatedQty" DECIMAL(65,30) NOT NULL DEFAULT 0,
ADD COLUMN     "reservedQty" DECIMAL(65,30) NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "Build" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "designRevisionId" TEXT NOT NULL,
    "outputLocationId" TEXT,
    "targetQuantity" INTEGER NOT NULL,
    "state" "BuildState" NOT NULL DEFAULT 'CREATED',
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Build_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BuildLineItem" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "buildId" TEXT NOT NULL,
    "sourceBomLineItemId" TEXT,
    "designators" TEXT NOT NULL,
    "designatorCount" INTEGER NOT NULL,
    "categoryName" TEXT,
    "partId" TEXT,
    "sourceLocationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BuildLineItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BuildDesignatorAssignment" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "buildLineItemId" TEXT NOT NULL,
    "designator" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "assembledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BuildDesignatorAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Build_workspaceId_state_createdAt_idx" ON "Build"("workspaceId", "state", "createdAt");

-- CreateIndex
CREATE INDEX "Build_workspaceId_createdAt_idx" ON "Build"("workspaceId", "createdAt");

-- CreateIndex
CREATE INDEX "Build_designRevisionId_idx" ON "Build"("designRevisionId");

-- CreateIndex
CREATE INDEX "BuildLineItem_workspaceId_idx" ON "BuildLineItem"("workspaceId");

-- CreateIndex
CREATE INDEX "BuildLineItem_buildId_idx" ON "BuildLineItem"("buildId");

-- CreateIndex
CREATE INDEX "BuildLineItem_partId_idx" ON "BuildLineItem"("partId");

-- CreateIndex
CREATE INDEX "BuildDesignatorAssignment_workspaceId_idx" ON "BuildDesignatorAssignment"("workspaceId");

-- CreateIndex
CREATE INDEX "BuildDesignatorAssignment_buildLineItemId_idx" ON "BuildDesignatorAssignment"("buildLineItemId");

-- CreateIndex
CREATE INDEX "Part_workspaceId_reservedQty_id_idx" ON "Part"("workspaceId", "reservedQty", "id");

-- CreateIndex
CREATE INDEX "Part_workspaceId_allocatedQty_id_idx" ON "Part"("workspaceId", "allocatedQty", "id");

-- AddForeignKey
ALTER TABLE "Build" ADD CONSTRAINT "Build_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Build" ADD CONSTRAINT "Build_designRevisionId_fkey" FOREIGN KEY ("designRevisionId") REFERENCES "DesignRevision"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Build" ADD CONSTRAINT "Build_outputLocationId_fkey" FOREIGN KEY ("outputLocationId") REFERENCES "StorageLocation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Build" ADD CONSTRAINT "Build_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BuildLineItem" ADD CONSTRAINT "BuildLineItem_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BuildLineItem" ADD CONSTRAINT "BuildLineItem_buildId_fkey" FOREIGN KEY ("buildId") REFERENCES "Build"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BuildLineItem" ADD CONSTRAINT "BuildLineItem_sourceBomLineItemId_fkey" FOREIGN KEY ("sourceBomLineItemId") REFERENCES "BomLineItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BuildLineItem" ADD CONSTRAINT "BuildLineItem_partId_fkey" FOREIGN KEY ("partId") REFERENCES "Part"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BuildLineItem" ADD CONSTRAINT "BuildLineItem_sourceLocationId_fkey" FOREIGN KEY ("sourceLocationId") REFERENCES "StorageLocation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BuildDesignatorAssignment" ADD CONSTRAINT "BuildDesignatorAssignment_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BuildDesignatorAssignment" ADD CONSTRAINT "BuildDesignatorAssignment_buildLineItemId_fkey" FOREIGN KEY ("buildLineItemId") REFERENCES "BuildLineItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
