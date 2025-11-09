-- Migration script to update menu_items table
-- From single imageUrl to multiple imageUrls

-- Step 1: Add the new imageUrls column
ALTER TABLE menu_items ADD COLUMN "imageUrls" text[];

-- Step 2: Migrate existing imageUrl data to imageUrls array
UPDATE menu_items 
SET "imageUrls" = ARRAY["imageUrl"] 
WHERE "imageUrl" IS NOT NULL AND "imageUrl" != '';

-- Step 3: Set empty array for items with no images
UPDATE menu_items 
SET "imageUrls" = '{}' 
WHERE "imageUrl" IS NULL OR "imageUrl" = '';

-- Step 4: Drop the old imageUrl column
ALTER TABLE menu_items DROP COLUMN "imageUrl";

-- Verify the migration
SELECT id, name, "imageUrls" FROM menu_items LIMIT 5;