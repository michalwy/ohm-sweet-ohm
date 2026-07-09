-- AlterTable
ALTER TABLE "User" ADD COLUMN "dateFormat" TEXT NOT NULL DEFAULT 'locale';
ALTER TABLE "User" ADD COLUMN "timeFormat" TEXT NOT NULL DEFAULT 'locale';
