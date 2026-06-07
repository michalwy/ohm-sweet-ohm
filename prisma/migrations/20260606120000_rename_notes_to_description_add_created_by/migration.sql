-- Rename notes to description on ShoppingList and add createdByUserId
-- This migration is idempotent-safe for fresh databases:
-- it adds createdByUserId and renames notes→description on both tables.

-- Add createdByUserId to ShoppingList (idempotent via DO NOTHING pattern)
ALTER TABLE "ShoppingList" ADD COLUMN IF NOT EXISTS "createdByUserId" TEXT;

-- Rename notes to description on ShoppingList (only if notes column still exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ShoppingList' AND column_name = 'notes'
  ) THEN
    ALTER TABLE "ShoppingList" RENAME COLUMN "notes" TO "description";
  END IF;
END $$;

-- Add FK constraint for createdByUserId (idempotent)
ALTER TABLE "ShoppingList" DROP CONSTRAINT IF EXISTS "ShoppingList_createdByUserId_fkey";
ALTER TABLE "ShoppingList" ADD CONSTRAINT "ShoppingList_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Rename notes to description on ShoppingListItem (only if notes column still exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ShoppingListItem' AND column_name = 'notes'
  ) THEN
    ALTER TABLE "ShoppingListItem" RENAME COLUMN "notes" TO "description";
  END IF;
END $$;
