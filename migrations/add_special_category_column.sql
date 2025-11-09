-- Migration: Add special category column to specials table
-- This adds support for regular vs late night daily specials

-- Add the new enum type for special category
DO $$ BEGIN
    CREATE TYPE special_category_enum AS ENUM ('regular', 'late_night');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Add the special category column to the specials table
ALTER TABLE specials 
ADD COLUMN IF NOT EXISTS "specialCategory" special_category_enum DEFAULT 'regular';

-- Update existing daily specials to have 'regular' category by default
UPDATE specials 
SET "specialCategory" = 'regular' 
WHERE type = 'daily' AND "specialCategory" IS NULL;

-- Create an index for better query performance
CREATE INDEX IF NOT EXISTS idx_specials_category_day ON specials(type, "specialCategory", "dayOfWeek") 
WHERE type = 'daily';

-- Add constraint to ensure dayOfWeek is required for daily specials
ALTER TABLE specials 
ADD CONSTRAINT check_daily_special_day 
CHECK (
    (type = 'daily' AND "dayOfWeek" IS NOT NULL) OR 
    (type = 'seasonal')
);

COMMIT;