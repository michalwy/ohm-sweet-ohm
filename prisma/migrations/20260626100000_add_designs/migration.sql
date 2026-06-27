-- AlterTable
ALTER TABLE "Organization" ADD COLUMN "isInternal" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "Design" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "outputPartId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Design_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DesignRevision" (
    "id" TEXT NOT NULL,
    "designId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "revisionNumber" INTEGER NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DesignRevision_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Design_outputPartId_key" ON "Design"("outputPartId");

-- CreateIndex
CREATE INDEX "Design_workspaceId_name_idx" ON "Design"("workspaceId", "name");

-- CreateIndex
CREATE INDEX "Design_workspaceId_createdAt_idx" ON "Design"("workspaceId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "DesignRevision_designId_revisionNumber_key" ON "DesignRevision"("designId", "revisionNumber");

-- CreateIndex
CREATE INDEX "DesignRevision_designId_idx" ON "DesignRevision"("designId");

-- CreateIndex
CREATE INDEX "DesignRevision_workspaceId_idx" ON "DesignRevision"("workspaceId");

-- AddForeignKey
ALTER TABLE "Design" ADD CONSTRAINT "Design_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Design" ADD CONSTRAINT "Design_outputPartId_fkey" FOREIGN KEY ("outputPartId") REFERENCES "Part"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DesignRevision" ADD CONSTRAINT "DesignRevision_designId_fkey" FOREIGN KEY ("designId") REFERENCES "Design"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DesignRevision" ADD CONSTRAINT "DesignRevision_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
