-- Fix: align currentStock column type with Prisma-expected DECIMAL(65,30)
ALTER TABLE "Part" ALTER COLUMN "currentStock" TYPE DECIMAL(65,30);

-- CreateEnum
CREATE TYPE "PurchaseOrderStatus" AS ENUM ('DRAFT', 'ORDERED', 'RECEIVED');

-- CreateTable
CREATE TABLE "ShoppingList" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ShoppingList_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShoppingListItem" (
  "id" TEXT NOT NULL,
  "shoppingListId" TEXT NOT NULL,
  "partId" TEXT NOT NULL,
  "quantity" DECIMAL(65,30) NOT NULL,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ShoppingListItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseOrder" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "supplierId" TEXT NOT NULL,
  "sourceShoppingListId" TEXT,
  "status" "PurchaseOrderStatus" NOT NULL DEFAULT 'DRAFT',
  "orderNumber" TEXT,
  "orderedAt" TIMESTAMP(3),
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "PurchaseOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseOrderItem" (
  "id" TEXT NOT NULL,
  "purchaseOrderId" TEXT NOT NULL,
  "partId" TEXT NOT NULL,
  "sourceShoppingListItemId" TEXT,
  "quantity" DECIMAL(65,30) NOT NULL,
  "receivedQuantity" DECIMAL(65,30) NOT NULL DEFAULT 0,
  "supplierSku" TEXT,
  "unitPrice" DECIMAL(65,30),
  "currency" TEXT,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "PurchaseOrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ShoppingList_workspaceId_idx" ON "ShoppingList"("workspaceId");
CREATE INDEX "ShoppingList_workspaceId_name_idx" ON "ShoppingList"("workspaceId", "name");

-- CreateIndex
CREATE INDEX "ShoppingListItem_shoppingListId_idx" ON "ShoppingListItem"("shoppingListId");
CREATE INDEX "ShoppingListItem_partId_idx" ON "ShoppingListItem"("partId");

-- CreateIndex
CREATE INDEX "PurchaseOrder_workspaceId_idx" ON "PurchaseOrder"("workspaceId");
CREATE INDEX "PurchaseOrder_workspaceId_supplierId_idx" ON "PurchaseOrder"("workspaceId", "supplierId");
CREATE INDEX "PurchaseOrder_workspaceId_status_idx" ON "PurchaseOrder"("workspaceId", "status");
CREATE INDEX "PurchaseOrder_workspaceId_sourceShoppingListId_idx" ON "PurchaseOrder"("workspaceId", "sourceShoppingListId");

-- CreateIndex
CREATE INDEX "PurchaseOrderItem_purchaseOrderId_idx" ON "PurchaseOrderItem"("purchaseOrderId");
CREATE INDEX "PurchaseOrderItem_partId_idx" ON "PurchaseOrderItem"("partId");
CREATE INDEX "PurchaseOrderItem_sourceShoppingListItemId_idx" ON "PurchaseOrderItem"("sourceShoppingListItemId");

-- AddForeignKey
ALTER TABLE "ShoppingList"
  ADD CONSTRAINT "ShoppingList_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShoppingListItem"
  ADD CONSTRAINT "ShoppingListItem_shoppingListId_fkey"
  FOREIGN KEY ("shoppingListId") REFERENCES "ShoppingList"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ShoppingListItem"
  ADD CONSTRAINT "ShoppingListItem_partId_fkey"
  FOREIGN KEY ("partId") REFERENCES "Part"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrder"
  ADD CONSTRAINT "PurchaseOrder_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PurchaseOrder"
  ADD CONSTRAINT "PurchaseOrder_supplierId_fkey"
  FOREIGN KEY ("supplierId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PurchaseOrder"
  ADD CONSTRAINT "PurchaseOrder_sourceShoppingListId_fkey"
  FOREIGN KEY ("sourceShoppingListId") REFERENCES "ShoppingList"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrderItem"
  ADD CONSTRAINT "PurchaseOrderItem_purchaseOrderId_fkey"
  FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PurchaseOrderItem"
  ADD CONSTRAINT "PurchaseOrderItem_partId_fkey"
  FOREIGN KEY ("partId") REFERENCES "Part"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PurchaseOrderItem"
  ADD CONSTRAINT "PurchaseOrderItem_sourceShoppingListItemId_fkey"
  FOREIGN KEY ("sourceShoppingListItemId") REFERENCES "ShoppingListItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
