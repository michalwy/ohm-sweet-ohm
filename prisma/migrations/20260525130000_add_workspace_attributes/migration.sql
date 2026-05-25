-- CreateTable
CREATE TABLE "WorkspaceAttribute" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "attributeId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "defaultTextValue" TEXT,
    "defaultNumberValue" DECIMAL,
    "defaultQuantityBaseValue" DECIMAL,
    "defaultBooleanValue" BOOLEAN,
    "defaultChoiceOptionId" TEXT,
    "defaultDisplayValue" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkspaceAttribute_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WorkspaceAttribute_workspaceId_attributeId_key" ON "WorkspaceAttribute"("workspaceId", "attributeId");

-- CreateIndex
CREATE INDEX "WorkspaceAttribute_workspaceId_attributeId_idx" ON "WorkspaceAttribute"("workspaceId", "attributeId");

-- CreateIndex
CREATE INDEX "WorkspaceAttribute_attributeId_idx" ON "WorkspaceAttribute"("attributeId");

-- AddForeignKey
ALTER TABLE "WorkspaceAttribute" ADD CONSTRAINT "WorkspaceAttribute_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceAttribute" ADD CONSTRAINT "WorkspaceAttribute_attributeId_fkey" FOREIGN KEY ("attributeId") REFERENCES "Attribute"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceAttribute" ADD CONSTRAINT "WorkspaceAttribute_defaultChoiceOptionId_fkey" FOREIGN KEY ("defaultChoiceOptionId") REFERENCES "AttributeChoiceOption"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
