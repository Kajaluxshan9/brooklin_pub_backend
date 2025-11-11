-- Migration to remove parentId column from menu_categories table
-- Date: 2025-11-11
-- Description: Remove parent category functionality, keeping only primary categories

-- Drop the parentId column from menu_categories table
ALTER TABLE menu_categories DROP COLUMN IF EXISTS parentId;

-- Note: This migration removes the parent-child relationship between categories
-- Categories will now only be grouped by primaryCategoryId
