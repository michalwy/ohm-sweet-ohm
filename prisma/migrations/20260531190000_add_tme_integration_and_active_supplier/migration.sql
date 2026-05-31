-- CreateEnum
CREATE TYPE "SupplierProvider" AS ENUM ('DIGIKEY', 'MOUSER', 'TME');

-- AlterTable
ALTER TABLE "Workspace"
  ADD COLUMN "activeSupplierProvider" "SupplierProvider";

-- CreateTable
CREATE TABLE "WorkspaceTmeIntegration" (
  "workspaceId" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "clientSecret" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "WorkspaceTmeIntegration_pkey" PRIMARY KEY ("workspaceId"),
  CONSTRAINT "WorkspaceTmeIntegration_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
