-- Migration script for Specials table restructuring
-- Date: 2025-10-01
-- Purpose: Update specials table to support new daily and seasonal special requirements

-- Step 1: Drop old enum type if exists and create new one
DO $$ BEGIN
    -- Drop old type if it exists
    DROP TYPE IF EXISTS public."specials_type_enum_old" CASCADE;
    
    -- Rename current type to old
    ALTER TYPE public."specials_type_enum" RENAME TO "specials_type_enum_old";
    
    -- Create new type with only daily and seasonal
    CREATE TYPE public."specials_type_enum" AS ENUM ('daily', 'seasonal');
EXCEPTION
    WHEN undefined_object THEN
        -- Type doesn't exist, create it
        CREATE TYPE public."specials_type_enum" AS ENUM ('daily', 'seasonal');
END $$;

-- Step 2: Create day_of_week enum
DO $$ BEGIN
    CREATE TYPE public."specials_dayofweek_enum" AS ENUM (
        'monday', 'tuesday', 'wednesday', 'thursday', 
        'friday', 'saturday', 'sunday', 'late_night'
    );
EXCEPTION
    WHEN duplicate_object THEN
        NULL; -- Type already exists
END $$;

-- Step 3: Add new columns
ALTER TABLE specials 
ADD COLUMN IF NOT EXISTS "dayOfWeek" "specials_dayofweek_enum",
ADD COLUMN IF NOT EXISTS "displayStartDate" timestamptz,
ADD COLUMN IF NOT EXISTS "displayEndDate" timestamptz,
ADD COLUMN IF NOT EXISTS "specialStartDate" timestamptz,
ADD COLUMN IF NOT EXISTS "specialEndDate" timestamptz,
ADD COLUMN IF NOT EXISTS "imageUrls" text[] DEFAULT '{}';

-- Step 4: Migrate existing single imageUrl to imageUrls array
UPDATE specials 
SET "imageUrls" = ARRAY["imageUrl"]::text[]
WHERE "imageUrl" IS NOT NULL AND "imageUrl" != '';

-- Set empty array for null imageUrl
UPDATE specials 
SET "imageUrls" = '{}'
WHERE "imageUrl" IS NULL OR "imageUrl" = '';

-- Step 5: Update type column to use new enum (delete incompatible types)
-- Delete specials that are not daily or seasonal
DELETE FROM specials 
WHERE type NOT IN ('daily', 'seasonal');

-- Drop the type column and recreate it
ALTER TABLE specials 
DROP COLUMN IF EXISTS type;

ALTER TABLE specials
ADD COLUMN type "specials_type_enum" DEFAULT 'daily' NOT NULL;

-- Step 6: Drop old columns that are no longer needed
ALTER TABLE specials 
DROP COLUMN IF EXISTS "originalPrice",
DROP COLUMN IF EXISTS "specialPrice",
DROP COLUMN IF EXISTS "startDate",
DROP COLUMN IF EXISTS "endDate",
DROP COLUMN IF EXISTS "availableDays",
DROP COLUMN IF EXISTS "startTime",
DROP COLUMN IF EXISTS "endTime",
DROP COLUMN IF EXISTS "imageUrl";

-- Step 7: Clean up old enum type
DROP TYPE IF EXISTS public."specials_type_enum_old" CASCADE;

-- Step 8: Verify the changes
SELECT 
    id, 
    title, 
    type, 
    "dayOfWeek",
    "displayStartDate",
    "displayEndDate",
    "imageUrls",
    "isActive"
FROM specials 
ORDER BY "sortOrder", "createdAt" DESC 
LIMIT 5;

-- Display column information
SELECT 
    column_name, 
    data_type, 
    udt_name,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'specials' 
ORDER BY ordinal_position;
