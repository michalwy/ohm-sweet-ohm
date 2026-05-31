-- CreateTable
CREATE TABLE "WorkspaceTmeCategoryCache" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "country" TEXT NOT NULL,
  "categoriesJson" JSONB NOT NULL,
  "fetchedAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "WorkspaceTmeCategoryCache_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WorkspaceTmeCategoryCache_workspaceId_country_key" ON "WorkspaceTmeCategoryCache"("workspaceId", "country");
CREATE INDEX "WorkspaceTmeCategoryCache_workspaceId_country_fetchedAt_idx" ON "WorkspaceTmeCategoryCache"("workspaceId", "country", "fetchedAt");

-- AddForeignKey
ALTER TABLE "WorkspaceTmeCategoryCache"
  ADD CONSTRAINT "WorkspaceTmeCategoryCache_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
