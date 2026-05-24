ALTER TABLE "PartCategory" RENAME COLUMN "primaryParameterId" TO "valueParameterId";

ALTER INDEX "PartCategory_workspaceId_primaryParameterId_idx" RENAME TO "PartCategory_workspaceId_valueParameterId_idx";

ALTER TABLE "PartCategory" RENAME CONSTRAINT "PartCategory_primaryParameterId_fkey" TO "PartCategory_valueParameterId_fkey";

ALTER TABLE "CategoryParameter" ADD COLUMN "isPrimary" BOOLEAN NOT NULL DEFAULT false;
