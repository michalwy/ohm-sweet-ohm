-- Per-unit build assembly tracking (issue #168): BuildDesignatorAssignment moves from a
-- per-(designator × part) grain with a quantity counter to a per-(designator × unit) grain with a
-- single "assembled" boolean per physical unit. There is no production deployment yet, so existing
-- builds are deleted up front instead of backfilling the old shape.

-- Delete all existing builds; cascades to BuildLineItem, BuildLineAllocation, and
-- BuildDesignatorAssignment.
DELETE FROM "Build";

-- AlterTable
ALTER TABLE "BuildDesignatorAssignment"
DROP COLUMN "quantity",
DROP COLUMN "assembledQuantity",
ADD COLUMN     "unitIndex" INTEGER NOT NULL,
ADD COLUMN     "assembled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "assembledAt" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "BuildDesignatorAssignment_buildLineItemId_designator_unitI_key" ON "BuildDesignatorAssignment"("buildLineItemId", "designator", "unitIndex");
