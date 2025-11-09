-- Migration to update events table structure
-- Remove old columns and add new ones

-- First, backup the existing events table
CREATE TABLE IF NOT EXISTS events_backup AS SELECT * FROM events;

-- Drop the old events table
DROP TABLE IF EXISTS events;

-- Create the new events table with updated structure
CREATE TABLE events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR NOT NULL,
    description TEXT NOT NULL,
    type VARCHAR CHECK (type IN ('live_music', 'sports_viewing', 'trivia_night', 'karaoke', 'private_party', 'special_event')) DEFAULT 'special_event',
    "displayStartDate" TIMESTAMP NOT NULL,
    "displayEndDate" TIMESTAMP NOT NULL,
    "eventStartDate" TIMESTAMP NOT NULL,
    "eventEndDate" TIMESTAMP NOT NULL,
    "isActive" BOOLEAN DEFAULT true,
    "imageUrls" JSON,
    "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create trigger to update the updatedAt timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW."updatedAt" = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_events_updated_at BEFORE UPDATE ON events FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- Migrate existing data if any (adjust as needed based on your existing data structure)
-- INSERT INTO events (id, title, description, type, "displayStartDate", "displayEndDate", "eventStartDate", "eventEndDate", "isActive", "imageUrls", "createdAt", "updatedAt")
-- SELECT 
--     id, 
--     title, 
--     description, 
--     CASE 
--         WHEN type = 'live_music' THEN 'live_music'
--         WHEN type = 'sports' THEN 'sports_viewing'
--         WHEN type = 'trivia' THEN 'trivia_night'
--         WHEN type = 'karaoke' THEN 'karaoke'
--         WHEN type = 'private_party' THEN 'private_party'
--         ELSE 'special_event'
--     END,
--     "startDateTime",
--     "endDateTime", 
--     "startDateTime",
--     "endDateTime",
--     "isActive",
--     CASE 
--         WHEN "imageUrl" IS NOT NULL THEN json_build_array("imageUrl")
--         ELSE '[]'::json
--     END,
--     "createdAt",
--     "updatedAt"
-- FROM events_backup;

-- Drop the backup table after successful migration
-- DROP TABLE events_backup;