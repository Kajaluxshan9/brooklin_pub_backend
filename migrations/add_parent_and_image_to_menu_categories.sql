-- Add parentId and imageUrl columns to menu_categories table
ALTER TABLE menu_categories ADD COLUMN "parentId" uuid;
ALTER TABLE menu_categories ADD COLUMN "imageUrl" text;

-- Add foreign key constraint for parentId
ALTER TABLE menu_categories ADD CONSTRAINT "FK_menu_categories_parentId" FOREIGN KEY ("parentId") REFERENCES menu_categories(id) ON DELETE SET NULL ON UPDATE CASCADE;