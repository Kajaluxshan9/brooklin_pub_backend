-- Migration: Add Primary Category support to menu system
-- Date: 2025-11-11
-- Description: Creates primary_categories table and adds primaryCategoryId to menu_categories

-- Create primary_categories table
CREATE TABLE IF NOT EXISTS primary_categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    "imageUrl" VARCHAR(500),
    "sortOrder" INTEGER DEFAULT 0,
    "isActive" BOOLEAN DEFAULT true,
    "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add primaryCategoryId column to menu_categories
ALTER TABLE menu_categories 
ADD COLUMN IF NOT EXISTS "primaryCategoryId" UUID REFERENCES primary_categories(id) ON DELETE SET NULL;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_menu_categories_primary_category_id 
ON menu_categories("primaryCategoryId");

-- Optional: Migrate existing top-level categories to primary categories
-- Uncomment and adjust as needed for your data
-- INSERT INTO primary_categories (name, description, "imageUrl", "sortOrder", "isActive")
-- SELECT name, description, "imageUrl", "sortOrder", "isActive"
-- FROM menu_categories
-- WHERE "parentId" IS NULL;

COMMENT ON TABLE primary_categories IS 'Primary categories for organizing menu categories (Primary Category > Category > Menu Items)';
COMMENT ON COLUMN menu_categories."primaryCategoryId" IS 'Reference to the primary category this category belongs to';
