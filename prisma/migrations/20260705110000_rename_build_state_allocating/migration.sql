-- Issue #185 / ADR 0025: collapse the CREATED/ALLOCATED build states into a single continuously
-- editable ALLOCATING state. There is no production deployment yet, so instead of a
-- value-preserving enum migration we drop all existing build data outright.
DELETE FROM "BuildDesignatorAssignment";
DELETE FROM "BuildLineAllocation";
DELETE FROM "BuildLineItem";
DELETE FROM "Build";

-- AlterEnum
BEGIN;
CREATE TYPE "BuildState_new" AS ENUM ('ALLOCATING', 'STARTED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');
ALTER TABLE "Build" ALTER COLUMN "state" DROP DEFAULT;
ALTER TABLE "Build" ALTER COLUMN "state" TYPE "BuildState_new" USING ("state"::text::"BuildState_new");
ALTER TYPE "BuildState" RENAME TO "BuildState_old";
ALTER TYPE "BuildState_new" RENAME TO "BuildState";
DROP TYPE "BuildState_old";
ALTER TABLE "Build" ALTER COLUMN "state" SET DEFAULT 'ALLOCATING';
COMMIT;
