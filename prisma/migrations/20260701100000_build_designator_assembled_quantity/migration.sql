-- Replace the assembled-at timestamp with a partial-assembly counter so a designator with
-- quantity > 1 (target quantity per build) can be assembled in increments.
ALTER TABLE "BuildDesignatorAssignment" DROP COLUMN "assembledAt";
ALTER TABLE "BuildDesignatorAssignment" ADD COLUMN "assembledQuantity" INTEGER NOT NULL DEFAULT 0;
