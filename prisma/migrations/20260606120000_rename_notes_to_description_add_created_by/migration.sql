-- Rename notes to description on ShoppingList
-- NOTE: ShoppingList.notes was already renamed to description and createdByUserId column was already added
-- in a partially-applied prior attempt; this migration completes what remains.

-- Add FK constraint for createdByUserId (column already exists)
ALTER TABLE "ShoppingList" ADD CONSTRAINT "ShoppingList_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Rename notes to description on ShoppingListItem
ALTER TABLE "ShoppingListItem" RENAME COLUMN "notes" TO "description";
