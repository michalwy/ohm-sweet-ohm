-- CreateEnum
CREATE TYPE "BomMatcherOperator" AS ENUM ('EQ', 'NEQ', 'LT', 'LTE', 'GT', 'GTE');

-- CreateTable
CREATE TABLE "BomLineItem" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "revisionId" TEXT NOT NULL,
    "categoryId" TEXT,
    "pinnedPartId" TEXT,
    "designators" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BomLineItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BomMatcher" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "lineItemId" TEXT NOT NULL,
    "attributeId" TEXT NOT NULL,
    "operator" "BomMatcherOperator" NOT NULL,
    "textValue" TEXT,
    "numberValue" DECIMAL(65,30),
    "quantityBaseValue" DECIMAL(65,30),
    "booleanValue" BOOLEAN,
    "choiceOptionId" TEXT,
    "displayValue" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BomMatcher_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BomLineItem_workspaceId_idx" ON "BomLineItem"("workspaceId");

-- CreateIndex
CREATE INDEX "BomLineItem_revisionId_sortOrder_idx" ON "BomLineItem"("revisionId", "sortOrder");

-- CreateIndex
CREATE INDEX "BomMatcher_workspaceId_lineItemId_idx" ON "BomMatcher"("workspaceId", "lineItemId");

-- CreateIndex
CREATE INDEX "BomMatcher_attributeId_idx" ON "BomMatcher"("attributeId");

-- CreateIndex
CREATE UNIQUE INDEX "BomMatcher_lineItemId_attributeId_key" ON "BomMatcher"("lineItemId", "attributeId");

-- AddForeignKey
ALTER TABLE "BomLineItem" ADD CONSTRAINT "BomLineItem_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BomLineItem" ADD CONSTRAINT "BomLineItem_revisionId_fkey" FOREIGN KEY ("revisionId") REFERENCES "DesignRevision"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BomLineItem" ADD CONSTRAINT "BomLineItem_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "PartCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BomLineItem" ADD CONSTRAINT "BomLineItem_pinnedPartId_fkey" FOREIGN KEY ("pinnedPartId") REFERENCES "Part"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BomMatcher" ADD CONSTRAINT "BomMatcher_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BomMatcher" ADD CONSTRAINT "BomMatcher_lineItemId_fkey" FOREIGN KEY ("lineItemId") REFERENCES "BomLineItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BomMatcher" ADD CONSTRAINT "BomMatcher_attributeId_fkey" FOREIGN KEY ("attributeId") REFERENCES "Attribute"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BomMatcher" ADD CONSTRAINT "BomMatcher_choiceOptionId_fkey" FOREIGN KEY ("choiceOptionId") REFERENCES "AttributeChoiceOption"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
