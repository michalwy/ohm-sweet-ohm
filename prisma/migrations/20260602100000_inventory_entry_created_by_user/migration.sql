ALTER TABLE "InventoryEntry"
  DROP CONSTRAINT "InventoryEntry_createdByMemberId_fkey";

ALTER TABLE "InventoryEntry"
  RENAME COLUMN "createdByMemberId" TO "createdByUserId";

ALTER TABLE "InventoryEntry"
  ADD CONSTRAINT "InventoryEntry_createdByUserId_fkey"
  FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
